const clamp=(v:number)=>Math.min(1,Math.max(0,v));
import { artKey, missingTechniqueArt, TECHNIQUE_ART, TECHNIQUE_SLOTS } from './TechniqueArtManifest';
import { techniqueArt, type PreparedArt } from './TechniqueArtLibrary';
import { containSize, coverWithFocal, DEFAULT_ART_SIZE, motionFrame } from './TechniqueArtLayout';
export interface EffectCue { character: string; action: string; side?: 'player' | 'enemy'; hit?: boolean; blackFlash?: boolean; healing?: boolean; }
interface Cast extends EffectCue { age: number; duration: number; x: number; y: number; art: string; }
const ALIASES: Record<string,string> = { LAPSE_BLUE:'AMPLIFICATION_BLUE',UNLIMITED_VOID:'GOJO_ULTIMATE',PRIMARY_ATTACK:'CLEAVE',SECONDARY_ATTACK:'PIERCING_BLOOD',DOMAIN_EXPANSION:'MEGUMI_ULTIMATE',MALEVOLENT_SHRINE:'SUKUNA_ULTIMATE',SUPERNOVA:'CHOSO_ULTIMATE',UZUMAKI:'GETO_ULTIMATE',SOUL_SPLIT:'CURSED_TOOLS',HEAVENLY_RUSH:'CURSED_TOOLS',KATANA:'CURSED_TOOLS',YUJI_DOMAIN:'YUJI_ULTIMATE',RYU_DOMAIN:'RYU_ULTIMATE',YUTA_ULTIMATE:'MUTUAL_LOVE'};
const DOMAINS:Record<string,string>={GOJO_ULTIMATE:'gojo',SUKUNA_ULTIMATE:'sukuna',MEGUMI_ULTIMATE:'megumi'};
/** Keep the existing character art only for the requested exceptions. */
const PRESERVED_ART=new Set(['DIVINE_DOGS','NUE','MAHORAGA','SUKUNA_ULTIMATE','RIKA']);
export function usesPreservedTechniqueArt(key:string):boolean{return PRESERVED_ART.has(key);}
export function techniqueArtAnchor(key:string):'left'|'center'{return key==='RIKA'?'left':'center';}
export function proceduralEffectStyle(action:string):string{
  if(action==='GUARD'||action==='BLOCK')return'shield';
  if(action==='CLEAVE'||action==='DISMANTLE')return'red-slash';
  if(action==='CURSED_TOOLS')return'multi-slash';
  if(action==='PIERCING_BLOOD')return'fast-beam';
  if(action==='GRANITE_BLAST'||action==='AMPLIFICATION_BLUE')return'blue-blast';
  if(action==='GETO_ULTIMATE')return'spiral';
  if(action==='CURSE_SWALLOW'||action==='HEAL')return'heal-cross';
  if(action==='GOJO_ULTIMATE')return'space';
  if(action==='MEGUMI_ULTIMATE')return'dark-aura';
  if(action==='CHOSO_ULTIMATE')return'blood-explosion';
  if(action==='YUJI_ULTIMATE')return'flurry-impact';
  if(action==='BASIC_PUNCH'||action==='BLACK_FLASH'||action==='CURSED_FISTS'||action==='HOLLOW_PURPLE'||action==='REVERSAL_RED'||action==='RYU_ULTIMATE')return'impact-frame';
  return'energy-burst';
}
export const EFFECT_PREVIEWS: Record<string,string[]> = {
  gojo:['BLOCK','AMPLIFICATION_BLUE','REVERSAL_RED','HOLLOW_PURPLE','GOJO_ULTIMATE'],
  megumi:['DIVINE_DOGS','NUE','MAHORAGA','MEGUMI_ULTIMATE'],sukuna:['CLEAVE','DISMANTLE','SUKUNA_ULTIMATE'],
  choso:['PIERCING_BLOOD','CHOSO_ULTIMATE'],ryu:['GRANITE_BLAST','RYU_ULTIMATE'],yuji:['BASIC_PUNCH','BLACK_FLASH','YUJI_ULTIMATE'],
  toji:['CURSED_TOOLS'],geto:['CURSE_SWARM','CURSE_SWALLOW','GETO_ULTIMATE'],yuta:['CURSED_TOOLS','RIKA','YUTA_ULTIMATE','MUTUAL_LOVE'],
};
/** Centered depth projection, shared by directed techniques; no camera-hand offset. */
export function forwardRadius(progress:number,base:number,reduced=false):number{
  const charge=clamp(progress/.38),rush=clamp((progress-.38)/.48);
  return base*(.25+.75*charge)*(reduced?1:1+3.8*rush*rush);
}
/** One bounded, demand-driven animation layer. It never runs hand inference or alters combat. */
export class CharacterEffects {
  private canvas=document.createElement('canvas');
  private ctx:CanvasRenderingContext2D;
  private observer:ResizeObserver;
  private casts:Cast[]=[];
  private frame=0;
  private last=0;
  private width=960;
  private height=540;
  private quality=1;
  private average=16.7;
  private sampleAt=0;
  private domain:string|null=null;
  private domainAge=0;
  private domainDuration=4200;
  private disposed=false;
  private paintMs=0;
  private frameCount=0;
  /** Manifest key of the active domain's preserved image, if it has one. */
  private domainArt:string|null=null;
  private reduced=matchMedia('(prefers-reduced-motion: reduce)');
  private visibility=()=>{if(document.hidden){cancelAnimationFrame(this.frame);this.frame=0;}else if(this.casts.length||this.domain)this.wake();};
  constructor(stage:HTMLElement){
    this.canvas.className='character-effects';this.canvas.setAttribute('aria-hidden','true');stage.append(this.canvas);
    this.ctx=this.canvas.getContext('2d')!;
    this.observer=new ResizeObserver(([entry])=>{this.width=entry.contentRect.width;this.height=entry.contentRect.height;});this.observer.observe(stage);
    document.addEventListener('visibilitychange',this.visibility);
  }
  get stats():string{return `VFX ${Math.round(this.quality*100)}% · ${this.casts.length} effects · ${this.canvas.width}×${this.canvas.height} · draw ${this.paintMs.toFixed(1)}ms · ${this.frame?'animating':'idle'} · ${techniqueArt.summary()} · ${missingTechniqueArt().length} procedural moves` ;}
  /** Starts loading a character's technique images before they are needed. */
  prefetch(character:string):void{for(const slot of TECHNIQUE_SLOTS)if(slot.character===character&&usesPreservedTechniqueArt(slot.key))techniqueArt.request(slot.key);}
  play(cue:EffectCue):void{
    if(this.disposed)return;
    const action=ALIASES[cue.action]??cue.action;
    const art=artKey(cue.character,cue.blackFlash?'BLACK_FLASH':action);
    if(usesPreservedTechniqueArt(art))techniqueArt.request(art);
    const domain=DOMAINS[action];
    if(domain&&cue.hit!==false){this.domain=domain;this.domainAge=0;this.domainArt=action==='SUKUNA_ULTIMATE'&&TECHNIQUE_ART[art]?.motion==='domain'?art:null;}
    const duration=domain?1300:usesPreservedTechniqueArt(art)&&TECHNIQUE_ART[art]?.motion==='summon'?2100:
      action==='YUJI_ULTIMATE'?1700:action==='CHOSO_ULTIMATE'?1500:action==='PIERCING_BLOOD'?760:
      action==='GUARD'||action==='BLOCK'?850:action==='BASIC_PUNCH'?600:1050;
    if(this.casts.length>=12)this.casts.shift();
    this.casts.push({...cue,action,art,age:0,duration,x:480,y:270});this.wake();
  }
  clear():void{cancelAnimationFrame(this.frame);this.frame=0;this.casts.length=0;this.domain=null;this.domainArt=null;this.ctx.setTransform(1,0,0,1,0,0);this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);}
  dispose():void{this.disposed=true;this.clear();this.observer.disconnect();document.removeEventListener('visibilitychange',this.visibility);this.canvas.remove();}
  private wake():void{if(this.frame||document.hidden)return;this.last=performance.now();this.frame=requestAnimationFrame(this.draw);}
  private draw=(now:number):void=>{
    this.frame=0;if(this.disposed||document.hidden)return;
    const gap=now-this.last;this.last=now;const dt=Math.min(50,gap);
    if(gap<100){this.average+=(gap-this.average)*.04;if(now-this.sampleAt>2000){this.quality=this.average>23?Math.max(.6,this.quality-.15):this.average<18?Math.min(1,this.quality+.05):this.quality;this.sampleAt=now;}}
    const scale=Math.min(devicePixelRatio||1,1.5,1440/Math.max(1,this.width))*this.quality;
    const w=Math.max(1,Math.round(this.width*scale)),h=Math.max(1,Math.round(this.height*scale));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    const paintStart=performance.now();
    const c=this.ctx;c.setTransform(w/960,0,0,h/540,0,0);c.clearRect(0,0,960,540);
    if(this.domain){
      this.domainAge+=dt;const fade=Math.min(clamp(this.domainAge/400),clamp((this.domainDuration-this.domainAge)/650));
      const art=this.domainArt?techniqueArt.get(this.domainArt):null;
      if(art)this.paintDomainArt(c,art,w,h,fade);
      else this.paintDomainEffect(c,this.domain,this.domainAge,fade);
      if(this.domainAge>=this.domainDuration){this.domain=null;this.domainArt=null;}
    }
    // Render directly in the current viewport pixels, without a fixed 16:9 design box.
    c.setTransform(1,0,0,1,0,0);
    let alive=0;
    for(const cast of this.casts){cast.age+=dt;if(cast.age>=cast.duration)continue;this.paint(c,cast);this.casts[alive++]=cast;}this.casts.length=alive;
    this.paintMs+=(performance.now()-paintStart-this.paintMs)*.1;
    this.frameCount++;
    if(this.frameCount%15===0){this.canvas.dataset.drawMs=this.paintMs.toFixed(2);this.canvas.dataset.effects=String(this.casts.length);this.canvas.dataset.quality=String(this.quality);}
    if(this.casts.length||this.domain)this.frame=requestAnimationFrame(this.draw);else {c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);}
  };
  /**
   * Domain image as the combat area's environment: cover-fit around its focal
   * point in real pixels (never stretched), a slow push-in, and a faint larger
   * copy drifting on top for depth.
   */
  private paintDomainArt(c:CanvasRenderingContext2D,art:PreparedArt,w:number,h:number,fade:number):void{
    const k=clamp(this.domainAge/this.domainDuration),still=this.reduced.matches;
    const img={w:art.width,h:art.height},focal=art.entry.focal;
    c.save();c.setTransform(1,0,0,1,0,0);
    const base=coverWithFocal(img,{w,h},focal,still?1:1+.07*k);
    c.globalAlpha=fade;c.drawImage(art.sprite,base.x,base.y,base.w,base.h);
    if(!still){
      const layer=coverWithFocal(img,{w,h},focal,1.22+.05*Math.sin(this.domainAge/900));
      c.globalCompositeOperation='screen';c.globalAlpha=fade*.16;c.drawImage(art.sprite,layer.x,layer.y,layer.w,layer.h);
    }
    c.restore();
  }
  /**
   * A technique image animated by its motion, in the proportion-preserving,
   * centred design space: approach grows from the centre toward the viewer,
   * slash wipes across, summon rises in, impact punches in with a flash.
   */
  private paintArt(c:CanvasRenderingContext2D,art:PreparedArt,a:Cast,p:number):void{
    const e=art.entry,f=motionFrame(e.motion,p,this.reduced.matches);
    const size=e.size??DEFAULT_ART_SIZE[e.motion];
    const w=this.canvas.width,h=this.canvas.height;
    const fit=containSize({w:art.width,h:art.height},{w:w*size,h:h*size});
    const leftRika=techniqueArtAnchor(a.art)==='left';
    const target={x:w*(leftRika?0.27:a.hit===false?0.8:0.5),y:h*(a.hit===false?0.3:0.5)};
    const focal=e.focal??{x:.5,y:.5};
    const copies=Math.max(1,e.copies??1);
    const miss=a.hit===false?.6:1;
    c.save();c.globalCompositeOperation=e.blend??'source-over';
    for(let i=0;i<copies;i++){
      const offset=copies>1?(i-(copies-1)/2)*fit.w*.62:0,mirror=copies>1&&i%2===1;
      const drawAt=(scale:number,alpha:number)=>{
        const dw=fit.w*f.scale*scale,dh=fit.h*f.scale*scale;
        c.save();c.globalAlpha=alpha*miss;c.translate(target.x+offset+f.dx*h,target.y+f.dy*h);
        if(mirror)c.scale(-1,1);
        if(e.angle)c.rotate(e.angle*Math.PI/180);
        if(e.motion==='slash'){c.beginPath();c.rect(-dw*focal.x-1,-dh*focal.y-1,dw*f.reveal+2,dh+2);c.clip();}
        c.drawImage(art.sprite,-dw*focal.x,-dh*focal.y,dw,dh);
        if(f.flash>0){c.globalCompositeOperation='lighter';c.globalAlpha=alpha*miss*f.flash*.8;c.drawImage(art.sprite,-dw*focal.x,-dh*focal.y,dw,dh);}
        c.restore();
      };
      for(const [scale,alpha] of f.echoes)drawAt(scale,f.alpha*alpha);
      drawAt(1,f.alpha);
    }
    c.restore();
  }
  private paint(c:CanvasRenderingContext2D,a:Cast):void{
    const p=clamp(a.age/a.duration);
    if(a.hit===false&&a.action!=='GUARD'&&a.action!=='BLOCK')return;
    const art=usesPreservedTechniqueArt(a.art)?techniqueArt.get(a.art):null;
    if(art&&art.entry.motion!=='domain')this.paintArt(c,art,a,p);
    else this.paintTechnique(c,a,p);
    if(a.healing&&a.action!=='CURSE_SWALLOW')this.paintHealing(c,a,p);
  }
  /** Each technique is drawn as moving canvas geometry; no manga panels are composited. */
  private paintTechnique(c:CanvasRenderingContext2D,a:Cast,p:number):void{
    const action=a.action,w=this.width,h=this.height,x=w*(a.side==='enemy'?.36:.64),y=h*.51;
    const unit=h/540,scale=Math.min(this.canvas.width/Math.max(1,w),this.canvas.height/Math.max(1,h));
    const fade=Math.min(1,p/.045,Math.max(0,(1-p)/.2));
    if(fade<=0)return;
    c.save();c.setTransform(scale,0,0,scale,0,0);c.globalCompositeOperation='source-over';c.lineCap='round';c.lineJoin='round';
    const slash=(sx:number,sy:number,len:number,angle:number,alpha:number,color='#fa2939',thick=7)=>{
      c.save();c.translate(sx,sy);c.rotate(angle);c.globalAlpha=alpha;c.shadowBlur=unit*28;c.shadowColor=color;
      c.strokeStyle=color;c.lineWidth=unit*thick;c.beginPath();c.moveTo(-len/2,0);c.quadraticCurveTo(0,-unit*14,len/2,0);c.stroke();
      c.globalAlpha=alpha*.9;c.strokeStyle='#fff4ed';c.lineWidth=unit*1.5;c.beginPath();c.moveTo(-len*.46,0);c.lineTo(len*.46,0);c.stroke();c.restore();
    };
    const impact=(atX=x,atY=y,alpha=fade)=>{
      const r=unit*(38+68*Math.sin(Math.PI*Math.min(1,p/.55))), pulse=1-Math.abs(Math.sin(p*8));
      c.save();c.translate(atX,atY);c.globalAlpha=alpha*(.38+.62*pulse);
      c.fillStyle='#f5fbff';c.beginPath();for(let i=0;i<12;i++){const an=i*Math.PI/6,rr=i%2?r*.48:r*(.8+Math.sin(i*9+a.age/20)*.16);const px=Math.cos(an)*rr,py=Math.sin(an)*rr;if(!i)c.moveTo(px,py);else c.lineTo(px,py);}c.closePath();c.fill();
      c.globalAlpha=alpha*.78;c.strokeStyle='#c8efff';c.lineWidth=unit*3;c.beginPath();c.arc(0,0,r*1.12,0,Math.PI*2);c.stroke();
      for(let i=0;i<8;i++){const an=i*Math.PI/4+a.age/280;c.globalAlpha=alpha*.65;c.strokeStyle='#fff';c.lineWidth=unit*2;c.beginPath();c.moveTo(Math.cos(an)*r*.65,Math.sin(an)*r*.65);c.lineTo(Math.cos(an)*r*(1.25+p*.45),Math.sin(an)*r*(1.25+p*.45));c.stroke();}c.restore();
    };
    const blueBlast=(atX=x,atY=y,size=1,alpha=fade)=>{
      const r=unit*(32+Math.sin(p*Math.PI)*80)*size;c.save();c.translate(atX,atY);c.globalAlpha=alpha;
      const g=c.createRadialGradient(0,0,unit*2,0,0,r);g.addColorStop(0,'#ffffff');g.addColorStop(.18,'#b7f3ff');g.addColorStop(.5,'#25aaffcc');g.addColorStop(1,'#1458ff00');
      c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();c.strokeStyle='#d7f9ff';c.lineWidth=unit*3;c.shadowBlur=unit*30;c.shadowColor='#39a8ff';c.beginPath();c.arc(0,0,r*.57,0,Math.PI*2);c.stroke();
      for(let i=0;i<14;i++){const an=i*Math.PI/7+a.age/700,inner=r*.7,outer=r*(1.65+(i%3)*.22);c.globalAlpha=alpha*(.2+(i%3)*.12);c.strokeStyle=i%2?'#3e8eff':'#d5f8ff';c.lineWidth=unit*(i%3===0?4:2);c.beginPath();c.moveTo(Math.cos(an)*inner,Math.sin(an)*inner);c.lineTo(Math.cos(an)*outer,Math.sin(an)*outer);c.stroke();}c.restore();
    };
    if(action==='GUARD'||action==='BLOCK'){
      const drop=Math.min(1,p/.34), lower=p>.62?(p-.62)/.38:0, sy=h*(-.3+drop*.72+lower*.42);
      c.save();c.translate(w*.5,sy);c.globalAlpha=fade*(p>.86?1-(p-.86)/.14:1);c.shadowBlur=unit*28;c.shadowColor='#55caff';
      const g=c.createLinearGradient(-unit*115,-unit*125,unit*115,unit*125);g.addColorStop(0,'#9defffdd');g.addColorStop(.35,'#256fbcdd');g.addColorStop(1,'#102846ee');
      c.fillStyle=g;c.strokeStyle='#d6faff';c.lineWidth=unit*6;c.beginPath();c.moveTo(-unit*96,-unit*115);c.lineTo(unit*96,-unit*115);c.lineTo(unit*82,unit*12);c.quadraticCurveTo(unit*65,unit*100,0,unit*136);c.quadraticCurveTo(-unit*65,unit*100,-unit*82,unit*12);c.closePath();c.fill();c.stroke();
      c.globalAlpha*=.5;c.strokeStyle='#fff';c.lineWidth=unit*3;c.beginPath();c.moveTo(0,-unit*82);c.lineTo(0,unit*92);c.moveTo(-unit*60,-unit*12);c.lineTo(unit*60,-unit*12);c.stroke();c.restore();
    }else if(action==='CLEAVE'||action==='DISMANTLE'){
      const len=w*(.34+.78*Math.min(1,p/.3)),grow=Math.min(1,p/.24);slash(x,y,len,-.58,fade*(1-grow*.28),'#ef243a',19);slash(x,y+unit*8,len*.89,-.58,fade*.85,'#ff344a',6);
    }else if(action==='CURSED_TOOLS'){
      for(let i=0;i<9;i++){const delay=i*.045,q=clamp((p-delay)/.32),sx=x+(i%3-1)*w*.13,sy=y+(Math.floor(i/3)-1)*h*.14;slash(sx,sy,w*(.13+.05*q),-.65+(i%2)*1.2,fade*(1-q*.45),'#f0f5ff',4);}
    }else if(action==='PIERCING_BLOOD'){
      const travel=clamp(p/.72),tail=w*(.2+.9*travel),beamY=y-unit*24;
      c.globalAlpha=fade;c.shadowBlur=unit*22;c.shadowColor='#ff243d';c.strokeStyle='#8d071d';c.lineWidth=unit*17;c.beginPath();c.moveTo(x-tail,beamY);c.lineTo(x+tail*.42,beamY);c.stroke();
      c.strokeStyle='#ff253c';c.lineWidth=unit*8;c.beginPath();c.moveTo(x-tail,beamY);c.lineTo(x+tail*.42,beamY);c.stroke();
      c.strokeStyle='#fff0ee';c.lineWidth=unit*2.5;c.beginPath();c.moveTo(x-tail,beamY);c.lineTo(x+tail*.42,beamY);c.stroke();
      for(let i=0;i<8;i++){const px=x+Math.sin(i*8+a.age/30)*tail*.28,py=beamY+Math.cos(i*6+a.age/34)*unit*(8+i);c.globalAlpha=fade*.65;c.fillStyle='#d71331';c.beginPath();c.arc(px,py,unit*(2+i%3),0,Math.PI*2);c.fill();}
    }else if(action==='GRANITE_BLAST'||action==='AMPLIFICATION_BLUE'){
      const travel=clamp(p/.62),dir=a.side==='enemy'?-1:1;
      blueBlast(x-dir*w*.16*travel,y,action==='GRANITE_BLAST'?1.28:1,fade);
      if(action==='GRANITE_BLAST'){c.globalAlpha=fade*.68;c.strokeStyle='#73cfff';c.lineWidth=unit*16;c.shadowBlur=unit*34;c.shadowColor='#228eff';c.beginPath();c.moveTo(x-dir*w*.04,y);c.lineTo(x-dir*w*(.25+.72*travel),y);c.stroke();}
    }else if(action==='GETO_ULTIMATE'){
      const radius=unit*(18+145*clamp(p/.75)),turns=4.4,spin=a.age/260;c.save();c.translate(x,y);c.globalAlpha=fade;c.shadowBlur=unit*23;c.shadowColor='#a050ff';
      for(let layer=0;layer<3;layer++){c.beginPath();for(let i=0;i<=180;i++){const q=i/180,angle=q*Math.PI*2*turns+spin+layer*2.1,r=radius*q*(.7+layer*.16),px=Math.cos(angle)*r,py=Math.sin(angle)*r*.72;if(!i)c.moveTo(px,py);else c.lineTo(px,py);}c.strokeStyle=['#f1dcff','#aa55ff','#352052'][layer];c.lineWidth=unit*(layer===0?5:2);c.stroke();}c.restore();
    }else if(action==='CURSE_SWALLOW'||action==='HEAL'){
      this.paintHealing(c,a,p,scale);
    }else if(action==='CHOSO_ULTIMATE'){
      const radius=unit*(14+170*clamp(p/.72)),burst=clamp(p/.09);c.save();c.translate(x,y);c.globalAlpha=fade;c.shadowBlur=unit*32;c.shadowColor='#f20d36';
      const g=c.createRadialGradient(0,0,unit*2,0,0,radius);g.addColorStop(0,'#fff0ef');g.addColorStop(.18,'#ff4d59');g.addColorStop(.55,'#be102acc');g.addColorStop(1,'#6b001900');c.fillStyle=g;c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.fill();
      for(let i=0;i<30;i++){const an=i*2.399+a.age/460,dist=radius*(.45+((i*37)%53)/100)*burst,sz=unit*(2+i%5);c.globalAlpha=fade*(1-p*.6);c.fillStyle=i%3?'#e01b39':'#ffb3ad';c.beginPath();c.arc(Math.cos(an)*dist,Math.sin(an)*dist,sz,0,Math.PI*2);c.fill();}c.restore();
    }else if(action==='YUJI_ULTIMATE'){
      for(let i=0;i<4;i++){const beat=i*.2,q=(p-beat)/.28;if(q>=0&&q<=1)impact(x+(i%2?1:-1)*w*.075,y+(i%2?1:-1)*h*.06,fade*(1-q*.45));}
    }else if(action==='BASIC_PUNCH'||action==='BLACK_FLASH'||action==='CURSED_FISTS'||action==='HOLLOW_PURPLE'||action==='REVERSAL_RED'||action==='RYU_ULTIMATE'){
      impact(x,y,fade);
      if(action==='BLACK_FLASH'){c.globalAlpha=fade*.72;c.strokeStyle='#fa2847';c.lineWidth=unit*5;for(let i=0;i<4;i++){const an=i*Math.PI/2+a.age/120;c.beginPath();c.moveTo(x+Math.cos(an)*unit*22,y+Math.sin(an)*unit*22);c.lineTo(x+Math.cos(an)*unit*150,y+Math.sin(an)*unit*150);c.stroke();}}
      if(action==='HOLLOW_PURPLE'){blueBlast(x,y,.82,fade*.8);c.globalAlpha=fade*.4;c.strokeStyle='#bb70ff';c.lineWidth=unit*8;c.beginPath();c.moveTo(x-w*.3,y);c.lineTo(x+w*.3,y);c.stroke();}
    }else if(action==='MEGUMI_ULTIMATE'){
      this.paintDomainEffect(c,'megumi',a.age,fade);
    }else{
      blueBlast(x,y,.7,fade*.65);impact(x,y,fade*.55);
    }
    if(a.blackFlash){
      c.save();c.globalCompositeOperation='lighter';c.globalAlpha=fade*.82;c.strokeStyle='#fb173d';c.shadowBlur=unit*18;c.shadowColor='#fb173d';c.lineWidth=unit*5;
      for(let i=0;i<5;i++){const an=i*1.257+a.age/95,inner=unit*16,outer=unit*(125+(i%2)*42);c.beginPath();c.moveTo(x+Math.cos(an)*inner,y+Math.sin(an)*inner);c.lineTo(x+Math.cos(an+.08)*outer,y+Math.sin(an+.08)*outer);c.stroke();}c.restore();
    }
    c.restore();
  }
  private paintHealing(c:CanvasRenderingContext2D,a:Cast,p:number,scale=Math.min(this.canvas.width/Math.max(1,this.width),this.canvas.height/Math.max(1,this.height))):void{
    const x=this.width*(a.side==='enemy'?.36:.64),y=this.height*.55,unit=this.height/540,fade=Math.min(1,p/.08,Math.max(0,(1-p)/.3));
    if(fade<=0)return;c.save();c.setTransform(scale,0,0,scale,0,0);c.globalCompositeOperation='lighter';
    for(let i=0;i<11;i++){const delay=(i%5)*.11,q=clamp((p-delay)/.72),px=x+Math.sin(i*7.13)*unit*(35+(i%4)*13),py=y+unit*90-q*unit*(120+(i%3)*28);c.save();c.translate(px,py);c.rotate((i%2?1:-1)*(p*1.8+i*.4));c.globalAlpha=fade*(.5+.5*Math.sin(q*Math.PI));c.shadowBlur=unit*16;c.shadowColor='#4dff9a';c.fillStyle=i%3?'#46ed91':'#bcffd9';const size=unit*(7+i%3);c.fillRect(-size/2,-size*1.5,size,size*3);c.fillRect(-size*1.5,-size/2,size*3,size);c.restore();}c.restore();
  }
  private paintDomainEffect(c:CanvasRenderingContext2D,id:string,time:number,fade:number):void{
    if(id==='sukuna')return;
    c.save();c.globalAlpha=fade;
    if(id==='gojo'){
      const g=c.createRadialGradient(480,270,12,480,270,620);g.addColorStop(0,'#17294766');g.addColorStop(.55,'#071020aa');g.addColorStop(1,'#01030be8');c.fillStyle=g;c.fillRect(0,0,960,540);
      for(let i=0;i<180;i++){const drift=(time*.007*(i%3+1)),x=((i*137.508+drift)%960),y=(i*73.73+i*i*1.91)%540,size=i%13===0?2:1;c.globalAlpha=fade*(i%6===0?.85:.48);c.fillStyle=i%7===0?'#c9e8ff':'#7796dd';c.fillRect(x,y,size,size);}
      c.globalAlpha=fade*.35;c.translate(480,270);for(let i=0;i<5;i++){c.save();c.rotate(time/4200+i*.62);c.strokeStyle=i%2?'#a6c9ff':'#eef8ff';c.lineWidth=i===0?2:1;c.beginPath();c.ellipse(0,0,130+i*36,55+i*23,0,0,Math.PI*2);c.stroke();c.restore();}
      c.globalAlpha=fade*.25;c.fillStyle='#f1f7ff';c.beginPath();c.arc(0,0,18,0,Math.PI*2);c.fill();
    }else if(id==='megumi'){
      const pulse=.5+.5*Math.sin(time/360),g=c.createRadialGradient(480,310,60,480,270,650);g.addColorStop(0,`rgba(15,23,30,${.25+pulse*.08})`);g.addColorStop(.7,'#02050bd9');g.addColorStop(1,'#010208f5');c.fillStyle=g;c.fillRect(0,0,960,540);
      for(let i=0;i<11;i++){const x=i*105-40,phase=time/900+i*.81;c.globalAlpha=fade*(.35+.3*Math.sin(phase));c.fillStyle='#03060d';c.beginPath();c.moveTo(x,540);c.bezierCurveTo(x+55,410,x-44,350+Math.sin(phase)*24,x+29,230+i%3*45);c.bezierCurveTo(x+110,360,x+14,405,x+88,540);c.fill();}
      for(let i=0;i<8;i++){const q=(time/1800+i/8)%1;c.globalAlpha=fade*(1-q)*.35;c.strokeStyle='#b2d5ca';c.lineWidth=1;c.beginPath();c.ellipse((i*167)%960,490,30+q*100,7+q*18,0,0,Math.PI*2);c.stroke();}
    }else{
      const colors=id==='yuta'?['#e9f8ff22','#587ba555']:id==='yuji'?['#dc263822','#090b1888']:['#5579ff22','#060817aa'];
      const g=c.createRadialGradient(480,270,25,480,270,600);g.addColorStop(0,colors[0]);g.addColorStop(1,colors[1]);c.fillStyle=g;c.fillRect(0,0,960,540);
      for(let i=0;i<45;i++){const an=i*2.399+time/1700,r=((i*43+time*.045)%450),px=480+Math.cos(an)*r,py=270+Math.sin(an)*r*.58;c.globalAlpha=fade*.4;c.fillStyle='#d8f0ff';c.fillRect(px,py,1.5,1.5);}
    }
    c.restore();
  }
}
