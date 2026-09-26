import {MOVE_LOOKS,type MoveLook,type HandOrigin} from './MovePalette';
import type {CombatAction} from '../combat/CombatManager';

class MoveLayer {
 private canvas=document.createElement('canvas');private ctx:CanvasRenderingContext2D;
 private frame=0;private stage:HTMLElement;private video:HTMLVideoElement;private mirrored:boolean;
 constructor(stage:HTMLElement,video:HTMLVideoElement,mirrored:boolean){this.stage=stage;this.video=video;this.mirrored=mirrored;this.canvas.className='move-vfx';this.canvas.setAttribute('aria-hidden','true');this.canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;object-fit:fill;transform:none!important';stage.append(this.canvas);this.ctx=this.canvas.getContext('2d')!;}
 stop(){cancelAnimationFrame(this.frame);this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);}
 play(look:MoveLook,origin:HandOrigin){
  this.stop();const rect=this.stage.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
  const scale=Math.min(1.5,960/rect.width,720/rect.height);const w=this.canvas.width=Math.round(rect.width*scale),h=this.canvas.height=Math.round(rect.height*scale);
  const aspect=this.video.videoWidth/this.video.videoHeight||4/3,vw=Math.min(w,h*aspect),vh=vw/aspect;
  const x=(w-vw)/2+(this.mirrored?1-origin.x:origin.x)*vw,y=(h-vh)/2+origin.y*vh;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start=performance.now(),duration=reduced?Math.min(look.duration,350):look.duration;
  const draw=(now:number)=>{const t=(now-start)/duration;this.ctx.clearRect(0,0,w,h);if(t>=1)return;this.paint(look,t,w,h,x,y,reduced);this.frame=requestAnimationFrame(draw);};this.frame=requestAnimationFrame(draw);
 }
 private paint(p:MoveLook,t:number,w:number,h:number,x:number,y:number,reduced:boolean){
  const c=this.ctx,size=Math.min(w,h),r=size*.24,fade=Math.min(1,t*12)*(1-t),turn=t*Math.PI*2;
  c.save();c.globalAlpha=fade;c.globalCompositeOperation='lighter';c.strokeStyle=p.color;c.fillStyle=p.color;c.lineCap='round';c.lineJoin='round';
  const line=(points:number[][],width=3,color=p.color)=>{c.beginPath();points.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
  const ring=(px:number,py:number,radius:number,width=3)=>{c.beginPath();c.arc(px,py,Math.max(0,radius),0,Math.PI*2);c.strokeStyle=p.color;c.lineWidth=width;c.stroke();};
  const orb=(px:number,py:number,radius:number)=>{const g=c.createRadialGradient(px,py,0,px,py,Math.max(1,radius));g.addColorStop(0,p.accent);g.addColorStop(.15,p.color);g.addColorStop(1,p.color+'00');c.fillStyle=g;c.fillRect(px-radius,py-radius,radius*2,radius*2);};
  const spark=(count=24,inward=false)=>{for(let i=0;i<count;i++){const a=i*2.39996,d=r*(inward?1-t:t)*(1+(i%5)*.18);const px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;line([[px,py],[px+Math.cos(a)*12,py+Math.sin(a)*12]],i%3+1,i%3?p.color:p.accent);}};
  orb(x,y,r*(.5+Math.sin(t*Math.PI)*.4));
  if(reduced){ring(x,y,r*.7,4);c.restore();return;}
  switch(p.shape){
   case 'impact':ring(x,y,r*t*1.7,8*(1-t));spark(18);break;
   case 'slashes':for(let i=0;i<3;i++){const d=(i-1)*r*.6;line([[x-r+d,y-r],[x+r+d,y+r]],14,p.color);line([[x-r+d,y-r],[x+r+d,y+r]],3,p.accent);}break;
   case 'claws':for(let side=-1;side<=1;side+=2)for(let i=0;i<3;i++){const a=x+side*r*.4+i*12;line([[a-side*r,y-r],[a,y+r*.25],[a+side*r*.3,y+r*.65]],5,i===1?p.accent:p.color);}break;
   case 'blood':case 'granite':case 'purple':{
    const endX=x<w/2?w:0,endY=h*.22;
    const width=p.shape==='blood'?8:p.shape==='granite'?24:45;
    line([[x,y],[endX,endY]],width*(1-t*.7),p.color);line([[x,y],[endX,endY]],Math.max(2,width*.2),p.accent);
    orb(x,y,r*(p.shape==='purple'?1.2:.7));spark(p.shape==='blood'?28:18);if(p.shape==='granite')for(let i=0;i<5;i++)ring(x+(endX-x)*i/5,y+(endY-y)*i/5,10+i*4,2);break;
   }
   case 'lightning':for(let side=-1;side<=1;side+=2){const pts=[[x,y]];for(let i=1;i<9;i++)pts.push([x+side*i*r*.25,y-r*.3+Math.sin(i*8+t*22)*r*.22-i*r*.06]);line(pts,10,p.color);line(pts,2,p.accent);}break;
   case 'wheel':ring(x,y,r,6);ring(x,y,r*.45,3);for(let i=0;i<8;i++){const a=i*Math.PI/4+turn*.35;line([[x+Math.cos(a)*r*.45,y+Math.sin(a)*r*.45],[x+Math.cos(a)*r,y+Math.sin(a)*r]],5);orb(x+Math.cos(a)*r,y+Math.sin(a)*r,15);}break;
   case 'void':{
    c.globalCompositeOperation='source-over';c.fillStyle='#01030dde';c.beginPath();c.arc(x,y,r*1.15,0,Math.PI*2);c.fill();c.globalCompositeOperation='lighter';
    for(let i=0;i<6;i++){c.save();c.translate(x,y);c.rotate(i*.42+turn*.08);c.scale(1,.38);ring(0,0,r*(.8+i*.09),2);c.restore();}spark(48);break;
   }
   case 'shrine':{
    const roof=y-r*.6;line([[x-r,roof+12],[x,roof-12],[x+r,roof+12]],12);line([[x-r*.65,roof],[x-r*.65,y+r*.7]],8);line([[x+r*.65,roof],[x+r*.65,y+r*.7]],8);line([[x-r*.8,roof+r*.3],[x+r*.8,roof+r*.3]],6);
    for(let i=0;i<5;i++)line([[x-r*1.4,y-r+i*r*.5],[x+r*1.4,y-r*.7+i*r*.5]],1,p.accent);spark(20);break;
   }
   case 'garden':for(let i=0;i<5;i++){c.save();c.translate(x,y+i*12);c.scale(1,.3);ring(0,0,r*(t+i*.2),8);c.restore();}for(let i=0;i<6;i++){const px=x+Math.sin(i*7)*r,py=y+Math.cos(i*7)*r*.3;orb(px-5,py,5);orb(px+5,py,5);}break;
   case 'repel':for(let i=0;i<3;i++)ring(x,y,r*((t+i*.2)%1)*1.8,5);spark(30);break;
   case 'attract':case 'swallow':case 'uzumaki':{
    const n=p.shape==='uzumaki'?5:3;for(let k=0;k<n;k++){const pts=[];for(let i=0;i<65;i++){const a=i*.12+turn*(p.shape==='attract'?-1:1)+k*2*Math.PI/n,d=r*i/65;pts.push([x+Math.cos(a)*d,y+Math.sin(a)*d]);}line(pts,p.shape==='uzumaki'?7:3,k%2?p.accent:p.color);}spark(18,true);break;
   }
   case 'restore':for(let i=0;i<8;i++){const px=x+Math.sin(i*5)*r,py=y+r*(.8-t*2)+(i%3)*24;line([[px-7,py],[px+7,py]],3);line([[px,py-7],[px,py+7]],3,p.accent);}ring(x,y,r*.6,2);break;
   case 'combo':for(let i=0;i<4;i++){const a=i*1.6,px=x+Math.cos(a)*r*.6,py=y+Math.sin(a)*r*.6,beat=Math.max(0,Math.min(1,t*4-i));if(beat>0){ring(px,py,beat*r*.5,6);line([[px-r*.3,py-r*.3],[px+r*.3,py+r*.3]],5);}}break;
   case 'blade':c.save();c.translate(x,y);c.rotate(-.7+turn*.18);line([[-r,0],[r,0]],12,p.color);line([[-r,0],[r,0]],3,p.accent);line([[-r*.45,-r*.25],[-r*.45,r*.25]],6);c.restore();spark(10);break;
   case 'spirit':{
    const pts=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;pts.push([x+Math.cos(a)*r*.8,y+Math.sin(a)*r*(.7+.1*Math.sin(a*6+turn))]);}line(pts,5);orb(x-r*.25,y-r*.15,14);orb(x+r*.25,y-r*.15,14);line([[x-r*.4,y+r*.2],[x,y+r*.4],[x+r*.4,y+r*.2]],4,p.accent);break;
   }
   case 'copy':for(let i=0;i<5;i++){c.save();c.translate(x,y);c.rotate(turn*.15+i*.25);const d=r*(.3+i*.16);line([[0,-d],[d,0],[0,d],[-d,0],[0,-d]],3,i%2?p.accent:p.color);c.restore();}break;
   case 'supernova':for(let i=0;i<9;i++){const a=i*Math.PI*2/9,d=r*(.2+t*1.5),px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;orb(px,py,r*.22);line([[x,y],[px,py]],2);}ring(x,y,r*t*1.4,4);break;
  }
  c.restore();
 }
 dispose(){this.stop();this.canvas.remove();}
}

export class BattleEffects {
 private local:MoveLayer;private remote:MoveLayer;private context:AudioContext|null=null;private master:GainNode|null=null;
 private voices:AudioScheduledSourceNode[]=[];private noise:AudioBuffer|null=null;private muted=false;private button:HTMLButtonElement;
 private unlock=()=>{if(!this.muted)void this.audio()?.resume();};
 constructor(localStage:HTMLElement,remoteStage:HTMLElement){
  this.local=new MoveLayer(localStage,localStage.querySelector('video')!,true);this.remote=new MoveLayer(remoteStage,remoteStage.querySelector('video')!,false);
  try{this.muted=localStorage.getItem('domainclash.sound-muted')==='true';}catch{}
  this.button=document.createElement('button');this.button.id='battle-sound';this.button.onclick=()=>{this.muted=!this.muted;try{localStorage.setItem('domainclash.sound-muted',String(this.muted));}catch{}this.refresh();if(this.muted)this.silence();else this.unlock();};this.refresh();document.querySelector('.topbar')!.append(this.button);
  window.addEventListener('pointerdown',this.unlock);window.addEventListener('keydown',this.unlock);
 }
 private refresh(){this.button.textContent=this.muted?'Sound: off':'Sound: on';this.button.setAttribute('aria-pressed',String(!this.muted));}
 private audio(){if(this.context)return this.context;try{this.context=new AudioContext();const compressor=this.context.createDynamicsCompressor();this.master=this.context.createGain();this.master.gain.value=.2;this.master.connect(compressor);compressor.connect(this.context.destination);this.noise=this.context.createBuffer(1,this.context.sampleRate,this.context.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}catch{return null;}return this.context;}
 private silence(){for(const voice of this.voices)try{voice.stop();}catch{}this.voices=[];}
 play(action:CombatAction,origin:HandOrigin={x:.5,y:.6},remote=false){const look=MOVE_LOOKS[action];if(!look)return;(remote?this.remote:this.local).play(look,origin);const banner=document.querySelector<HTMLElement>('#technique-reveal');if(banner){banner.style.background=`linear-gradient(100deg,${look.color}aa,#081528bb,transparent)`;banner.style.borderColor=look.accent;banner.style.animationDuration=`${Math.max(450,look.duration)}ms`;}this.sound(look);}
 private sound(p:MoveLook){
  if(this.muted||document.hidden)return;const ac=this.audio();if(!ac||ac.state!=='running')return;this.silence();
  const start=ac.currentTime,duration=Math.min(.85,p.duration/1000);
  p.notes.forEach((note,i)=>{const at=start+i*duration*.11,osc=ac.createOscillator(),gain=ac.createGain();osc.type=p.wave;osc.frequency.setValueAtTime(note,at);osc.frequency.exponentialRampToValueAtTime(Math.max(30,note*.45),at+duration*.65);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.15,at+.008);gain.gain.exponentialRampToValueAtTime(.001,at+duration*.65);osc.connect(gain);gain.connect(this.master!);osc.start(at);osc.stop(at+duration*.7);osc.onended=()=>{osc.disconnect();gain.disconnect();};this.voices.push(osc);});
  if(p.noise&&this.noise){const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();source.buffer=this.noise;filter.type='bandpass';filter.frequency.value=p.notes[0]*3;filter.Q.value=.7;gain.gain.setValueAtTime(p.noise*.3,start);gain.gain.exponentialRampToValueAtTime(.001,start+duration*.6);source.connect(filter);filter.connect(gain);gain.connect(this.master!);source.start(start);source.stop(start+duration*.65);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};this.voices.push(source);}
 }
 clear(){this.local.stop();this.remote.stop();this.silence();}
 dispose(){this.clear();this.local.dispose();this.remote.dispose();this.button.remove();window.removeEventListener('pointerdown',this.unlock);window.removeEventListener('keydown',this.unlock);void this.context?.close();}
}
