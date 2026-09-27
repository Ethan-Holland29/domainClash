const clamp=(v:number)=>Math.min(1,Math.max(0,v));
import { artKey, missingTechniqueArt, TECHNIQUE_ART, TECHNIQUE_SLOTS } from './TechniqueArtManifest';
import { techniqueArt, type PreparedArt } from './TechniqueArtLibrary';
import { containSize, coverWithFocal, DEFAULT_ART_SIZE, motionFrame } from './TechniqueArtLayout';
export interface EffectCue { character: string; action: string; side?: 'player' | 'enemy'; hit?: boolean; blackFlash?: boolean; }
interface Cast extends EffectCue { age: number; duration: number; x: number; y: number; art: string; }
const ALIASES: Record<string,string> = { LAPSE_BLUE:'AMPLIFICATION_BLUE',UNLIMITED_VOID:'GOJO_ULTIMATE',PRIMARY_ATTACK:'CLEAVE',SECONDARY_ATTACK:'PIERCING_BLOOD',DOMAIN_EXPANSION:'MEGUMI_ULTIMATE',MALEVOLENT_SHRINE:'SUKUNA_ULTIMATE',SUPERNOVA:'CHOSO_ULTIMATE',UZUMAKI:'GETO_ULTIMATE',SOUL_SPLIT:'CURSED_TOOLS',HEAVENLY_RUSH:'CURSED_TOOLS',KATANA:'CURSED_TOOLS',YUJI_DOMAIN:'YUJI_ULTIMATE',RYU_DOMAIN:'RYU_ULTIMATE',YUTA_ULTIMATE:'MUTUAL_LOVE'};
const DOMAINS:Record<string,string>={GOJO_ULTIMATE:'gojo',SUKUNA_ULTIMATE:'sukuna',MEGUMI_ULTIMATE:'megumi',MUTUAL_LOVE:'yuta',YUJI_ULTIMATE:'yuji',RYU_ULTIMATE:'ryu'};
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
  /** Manifest key of the active domain's image, if it has one. */
  private domainArt:string|null=null;
  private reduced=matchMedia('(prefers-reduced-motion: reduce)');
  private visibility=()=>{if(document.hidden){cancelAnimationFrame(this.frame);this.frame=0;}else if(this.casts.length||this.domain)this.wake();};
  constructor(stage:HTMLElement){
    this.canvas.className='character-effects';this.canvas.setAttribute('aria-hidden','true');stage.append(this.canvas);
    this.ctx=this.canvas.getContext('2d')!;
    this.observer=new ResizeObserver(([entry])=>{this.width=entry.contentRect.width;this.height=entry.contentRect.height;});this.observer.observe(stage);
    document.addEventListener('visibilitychange',this.visibility);
  }
  get stats():string{return `VFX ${Math.round(this.quality*100)}% · ${this.casts.length} effects · ${this.canvas.width}×${this.canvas.height} · draw ${this.paintMs.toFixed(1)}ms · ${this.frame?'animating':'idle'} · ${techniqueArt.summary()} · technique art missing for ${missingTechniqueArt().length}/${TECHNIQUE_SLOTS.length}: ${missingTechniqueArt().map(s=>s.name).join(', ')}`;}
  /** Starts loading a character's technique images before they are needed. */
  prefetch(character:string):void{techniqueArt.request('BLOCK');for(const slot of TECHNIQUE_SLOTS)if(slot.character===character)techniqueArt.request(slot.key);}
  play(cue:EffectCue):void{
    if(this.disposed)return;
    const action=ALIASES[cue.action]??cue.action;
    const art=artKey(cue.character,cue.blackFlash?'BLACK_FLASH':action);
    techniqueArt.request(art);
    const domain=DOMAINS[action];
    if(domain&&cue.hit!==false){this.domain=domain;this.domainAge=0;this.domainArt=TECHNIQUE_ART[art]?.motion==='domain'?art:null;}
    const duration=domain?1300:TECHNIQUE_ART[art]?.motion==='summon'?2100:action==='HOLLOW_PURPLE'?1700:1400;
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
    const target={x:w*(a.hit===false?.8:.5),y:h*(a.hit===false?.3:.5)};
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
    const art=techniqueArt.get(a.art);
    if(art&&art.entry.motion!=='domain')this.paintArt(c,art,a,p);
  }
}
