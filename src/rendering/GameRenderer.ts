import type { NetDomain } from "../multiplayer/MultiplayerClient";
import { drawRegular } from "./RegularEffects";
import { MoveById, isDomain, EffectAliases } from "../combat/MoveCatalog";
import { drawExpandedDomain } from "./ExpandedDomains";
import { AbilityId } from '../combat/AbilityTypes';
import { CombatManager } from '../combat/CombatManager';
import type { TrackedHand } from '../handTracking/HandTypes';
import { coverTransform, containTransform, handAnchor, projectLandmark, type Point } from './CameraProjection';
import { drawBlood, drawCleave, drawDomain, type Cast } from './TechniqueEffects';
import { clamp, electric, glow, ring, Sparks } from './VfxPrimitives';

/** Camera and VFX share a single compositing surface, including crop, mirror and shake. */
export class GameRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly video: HTMLVideoElement;
  private hands: TrackedHand[] = [];
  private casts: Cast[] = [];
  private networkViews: {combat:CombatManager;owner:number}[] | null = null;
  private networkSeat = 0;
  private split=false;
  private remoteFrame:ImageBitmap|null=null;
  private remoteVideo:HTMLVideoElement|null=null;
  setRemoteVideo(video:HTMLVideoElement|null):void{this.remoteVideo=video;}
  private incomingCasts=new WeakSet<Cast>();
  setSplit(value:boolean):void {this.split=value;this.reset();if(!value){this.setRemoteFrame(null);this.remoteVideo=null;}}
  setRemoteFrame(frame:ImageBitmap|null):void {this.remoteFrame?.close();this.remoteFrame=frame;}

  private sparks = new Sparks();
  private pointer = {x:.5,y:.58};
  private domainOrigin: Point = {x:0,y:0};
  private lastImpact: Point = {x:0,y:0};
  private time = 0;
  private shake = 0;
  private hurt = 0;
  private title = '';
  private subtitle = '';
  private titleLife = 0;
  private debug = false;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement) { this.canvas=canvas;this.video=video; }
  setHands(hands: TrackedHand[]): void { this.hands=hands; }
  setDebug(value: boolean): void { this.debug=value; }
  setPointer(x: number,y: number): void { this.pointer={x:clamp(this.split?x*2:x),y:clamp(y)}; }
  private anchor(id: AbilityId) {
    return handAnchor(id,this.hands,this.canvas.clientWidth/(this.split?2:1),this.canvas.clientHeight,
      this.video.videoWidth||640,this.video.videoHeight||480,this.pointer);
  }
  reset(): void { this.casts=[];this.sparks.clear();this.shake=this.hurt=this.titleLife=0;this.time=0; }
  clearNetwork():void {this.networkViews=null;}
  setNetworkDomains(domains:NetDomain[],now:number,seat:number):void {
    this.networkSeat=seat;
    this.networkViews=domains.map(d=>{const combat=new CombatManager();combat.domain.abilityId=d.id;combat.domain.phase=now<d.activeAt?'cinematic':'active';combat.domain.cinematicRemainingMs=Math.max(0,d.activeAt-now);combat.domain.remainingMs=Math.max(0,d.endAt-Math.max(now,d.activeAt));return {combat,owner:d.owner};});
  }
  announce(title:string,subtitle:string):void {this.title=title;this.subtitle=subtitle;this.titleLife=2;}
  startAbility(id: AbilityId, incoming=false): void {
    const anchor=incoming?{origin:{x:this.canvas.clientWidth*.9,y:this.canvas.clientHeight*.2},direction:{x:-.8,y:.6},scale:45}:this.anchor(id);
    if(!isDomain(id)){this.casts=[];this.sparks.clear();}
    const cast={id,age:0,anchor,seed:Math.random()*1000};this.casts.push(cast);if(incoming)this.incomingCasts.add(cast);
    this.casts=this.casts.slice(-8);
    if(isDomain(id)&&!incoming) this.domainOrigin={...anchor.origin};
    this.lastImpact={x:clamp(anchor.origin.x+anchor.direction.x*350,30,this.canvas.clientWidth-30),y:clamp(anchor.origin.y+anchor.direction.y*350,30,this.canvas.clientHeight-30)};
    const blood=id===AbilityId.SECONDARY_ATTACK, domain=isDomain(id);
    this.title=domain?'DOMAIN EXPANSION':MoveById[id].name.toUpperCase();
    this.subtitle=MoveById[id].name.toUpperCase();
    this.titleLife=domain?2.4:.45;
    this.sparks.burst(anchor.origin,blood?'#ff3158':'#a5fff2',domain?65:35,domain?180:320);
  }
  onHit(): void { this.shake=5;this.sparks.burst(this.lastImpact,'#fcebe4',22,180); }
  onPlayerHurt(): void { this.hurt=.5;this.shake=9; }
  onDomainActive(id: AbilityId): void { this.title=MoveById[id].name.toUpperCase();this.subtitle='DOMAIN ACTIVE';this.titleLife=2.4; }
  onDomainEnd(): void { this.title='DOMAIN RELEASED';this.subtitle='';this.titleLife=1; }

  draw(combat: CombatManager, dt: number): void {
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,1.5);
    if(!w||!h)return;
    if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)) {this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);}
    const ctx=this.canvas.getContext('2d');if(!ctx)return;
    this.time+=dt;this.titleLife=Math.max(0,this.titleLife-dt);this.shake=Math.max(0,this.shake-dt*25);this.hurt=Math.max(0,this.hurt-dt);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.save();
    if(!this.reducedMotion)ctx.translate(Math.sin(this.time*87)*this.shake,Math.cos(this.time*113)*this.shake*.5);
    const paneWidth=this.split?w/2:w;
    ctx.save();ctx.beginPath();ctx.rect(0,0,paneWidth,h);ctx.clip();
    {const w=paneWidth;
    const cameraLive=this.video.readyState>=2&&this.video.videoWidth>0&&!!this.video.srcObject;
    if(cameraLive) {
      const back=coverTransform(w,h,this.video.videoWidth,this.video.videoHeight);
      ctx.save();ctx.translate(w,0);ctx.scale(-1,1);ctx.filter='blur(16px) brightness(0.3) saturate(0.6)';
      ctx.drawImage(this.video,back.x-20,back.y-20,back.width+40,back.height+40);ctx.restore();
      const rect=containTransform(w,h,this.video.videoWidth,this.video.videoHeight);
      ctx.save();ctx.translate(w,0);ctx.scale(-1,1);ctx.filter='contrast(1.07) saturate(0.88)';
      ctx.drawImage(this.video,rect.x,rect.y,rect.width,rect.height);ctx.restore();
      const grade=ctx.createLinearGradient(0,0,0,h);grade.addColorStop(0,'#06111d55');grade.addColorStop(.4,'#00000000');grade.addColorStop(1,'#05071288');
      ctx.fillStyle=grade;ctx.fillRect(0,0,w,h);
    } else this.drawIdle(ctx,w,h);
    for(const hand of this.hands)this.drawAura(ctx,hand,w,h);
    }ctx.restore();
    if(this.split){
      ctx.save();ctx.beginPath();ctx.rect(w/2,0,w/2,h);ctx.clip();
      ctx.fillStyle='#080f1c';ctx.fillRect(w/2,0,w/2,h);
      const liveVideo=this.remoteVideo&&this.remoteVideo.readyState>=2&&this.remoteVideo.videoWidth?this.remoteVideo:null;
      const remote=liveVideo??this.remoteFrame;
      if(remote){
        const r=containTransform(w/2,h,liveVideo?liveVideo.videoWidth:this.remoteFrame!.width,liveVideo?liveVideo.videoHeight:this.remoteFrame!.height);
        ctx.drawImage(remote,w/2+r.x,r.y,r.width,r.height);
      }else{ctx.fillStyle='#a6b5c9';ctx.font='500 13px Segoe UI';ctx.textAlign='center';ctx.fillText('WAITING FOR OPPONENT CAMERA',w*.75,h*.55,w*.43);}
      ctx.restore();ctx.strokeStyle='#72e7d5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();
      ctx.font='700 12px Segoe UI';ctx.textAlign='center';ctx.fillStyle='#e4fff9';ctx.fillText('YOU',w*.25,h-55);ctx.fillText('OPPONENT',w*.75,h-55);
    }
    for(const original of this.casts) {
      const cast = EffectAliases[original.id] ? {...original,id:EffectAliases[original.id]!} : original;
      // Charge remains attached to the fingertip until the beam fires. Released cuts travel independently.
      if(cast.id===AbilityId.SECONDARY_ATTACK&&cast.age<.15&&!this.incomingCasts.has(cast)&&this.hands.length)cast.anchor=this.anchor(cast.id);
      original.age+=dt;cast.age=original.age;
      if(cast.id===AbilityId.PRIMARY_ATTACK)drawCleave(ctx,{...cast,age:cast.age*2.5},w,h);
      else if(cast.id===AbilityId.SECONDARY_ATTACK)drawBlood(ctx,{...cast,age:cast.age*3},w,h);
      else if(!isDomain(cast.id))drawRegular(ctx,cast,w,h);
    }
    this.casts=this.casts.filter(c=>c.age<.5);
    const renderDomain=(view:CombatManager,origin:Point)=>{
      if(view.domain.abilityId===AbilityId.DOMAIN_EXPANSION)drawDomain(ctx,view,origin,this.time,w,h);
      else drawExpandedDomain(ctx,view,origin,this.time,w,h);
    };
    if(this.networkViews){
      this.networkViews.forEach((view)=>{ctx.save();if(this.networkViews!.length===2){ctx.beginPath();ctx.rect(view.owner===this.networkSeat?0:w/2,0,w/2,h);ctx.clip();}renderDomain(view.combat,view.owner===this.networkSeat?this.domainOrigin:{x:w*.8,y:h*.3});ctx.restore();});
    }else renderDomain(combat,this.domainOrigin);
    this.sparks.draw(ctx,dt);
    if(this.hurt>0) {ctx.fillStyle=`rgba(145,0,34,${this.hurt*.3})`;ctx.fillRect(0,0,w,h);}
    ctx.restore();
    if(this.titleLife>0) {
      ctx.save();ctx.globalAlpha=Math.min(1,this.titleLife*2);ctx.textAlign='center';
      ctx.font=`900 ${Math.min(w*.057,52)}px 'Segoe UI',sans-serif`;ctx.fillStyle='#f3f6ff';ctx.shadowColor='#000';ctx.shadowBlur=18;
      ctx.fillText(this.title,w/2,h*.29,w*.88);
      ctx.font=`600 ${Math.max(9,Math.min(12,w*.021))}px 'Segoe UI',sans-serif`;ctx.fillStyle='#b6ebe3';ctx.fillText(this.subtitle,w/2,h*.29+28,w*.8);ctx.restore();
    }
  }

  private drawAura(ctx: CanvasRenderingContext2D,hand: TrackedHand,w: number,h: number): void {
    const vw=this.video.videoWidth||640,vh=this.video.videoHeight||480;
    const project=(i:number)=>projectLandmark(hand.landmarks[i],w,h,vw,vh);
    const wrist=project(0),middle=project(9),p={x:(wrist.x+middle.x)/2,y:(wrist.y+middle.y)/2};
    const radius=Math.hypot(wrist.x-middle.x,wrist.y-middle.y);
    glow(ctx,p,radius*1.3,'#428eec',.22);
    for(let i=0;i<3;i++)ring(ctx,p,radius*(.7+i*.12),'#669cf9',.2,.45+i*.2,this.time*(i%2?-.8:.7));
    const tips=[4,8,12,16,20];
    tips.forEach((tip,i)=>{
      const end=project(tip);glow(ctx,end,9,'#a0d9ff',.35);
      if(i%2===0)electric(ctx,p,end,Math.floor(this.time*12)+i,'#528cf5',.5,9);
    });
    if(this.debug) {
      ctx.save();ctx.strokeStyle='#a8fce8';ctx.fillStyle='#ffffff';ctx.lineWidth=1;
      for(const base of [1,5,9,13,17]) {ctx.beginPath();ctx.moveTo(wrist.x,wrist.y);for(let i=base;i<base+4;i++){const q=project(i);ctx.lineTo(q.x,q.y);}ctx.stroke();}
      hand.landmarks.forEach((_,i)=>{const q=project(i);ctx.beginPath();ctx.arc(q.x,q.y,2,0,Math.PI*2);ctx.fill();});ctx.restore();
    }
  }

  private drawIdle(ctx: CanvasRenderingContext2D,w:number,h:number):void {
    const g=ctx.createRadialGradient(w*.5,h*.5,20,w*.5,h*.5,w*.8);
    g.addColorStop(0,'#142032');g.addColorStop(.5,'#090e19');g.addColorStop(1,'#020408');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#8bd8d909';ctx.lineWidth=1;
    for(let i=0;i<w;i+=55){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,h);ctx.stroke();}
    for(let i=0;i<h;i+=55){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(w,i);ctx.stroke();}
    const p={x:this.pointer.x*w,y:this.pointer.y*h};
    for(let i=0;i<4;i++)ring(ctx,p,45+i*27,'#517b99',.14,.5,this.time*.1+i*.6);
    glow(ctx,p,100,'#5b8ddd',.2);
    if(!this.casts.length&&!this.titleLife) {
      ctx.textAlign='center';ctx.fillStyle='#9eb2c2';ctx.font='500 11px Segoe UI';
      ctx.fillText('CAMERA OFF · MOVE POINTER TO POSITION EFFECTS',w/2,h*.75,w*.85);
    }
  }
}
