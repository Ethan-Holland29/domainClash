import {CHARACTERS} from '../characters/Characters';
import {PORTRAITS} from '../characters/Portraits';
import palette from './characters.json';

// Adapted from the supplied winTransition.js. Reuse real, local roster assets.
export const WIN_DURATION = 2200;
export const WIN_REGISTRY = Object.fromEntries(CHARACTERS.map(c=>{
 const colors=palette.characters.find(p=>p.id===c.id)!;
 return [c.id,{name:c.name,image:PORTRAITS[c.id].image,primary:colors.aura??'#84928B',secondary:colors.accent}];
}));
export class WinTransitionController {
 readonly canvas=document.createElement('canvas');
 private ctx:CanvasRenderingContext2D|null;
 private cache=new Map<string,HTMLImageElement>();
 private loading=new Map<string,Promise<void>>();
 private frame=0;private timer=0;private done:(()=>void)|null=null;
 private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 private observer:ResizeObserver;private disposed=false;
 private skipVignette=false;private streaks=18;private lastFrame=0;
 playing=false;
 onSound:(id:string)=>void=()=>{};
 constructor(){
  this.canvas.hidden=true;this.canvas.setAttribute('role','status');
  this.canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:200;pointer-events:none';
  document.body.append(this.canvas);this.ctx=this.canvas.getContext('2d',{alpha:true});
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(document.documentElement);
  document.addEventListener('visibilitychange',this.visibility);
 }
 private visibility=()=>{if(document.hidden&&this.playing)this.finish();};
 private resize(){const scale=Math.min(1,1280/innerWidth,800/innerHeight);this.canvas.width=Math.max(1,Math.round(innerWidth*scale));this.canvas.height=Math.max(1,Math.round(innerHeight*scale));}
 preload(ids:string[]){return Promise.all([...new Set(ids)].map(id=>{
  if(this.loading.has(id))return this.loading.get(id)!;
  const config=WIN_REGISTRY[id];if(!config||this.disposed)return Promise.resolve();
  const job=(async()=>{const image=new Image();image.decoding='async';image.src=config.image;
   try{await image.decode();if(!this.disposed&&image.naturalWidth)this.cache.set(id,image);}catch{/* A text-only result remains available. */}
  })();this.loading.set(id,job);return job;
 }));}
 play(id:string,onComplete:()=>void=()=>{},age=0){
  this.cancel();const config=WIN_REGISTRY[id];
  if(!config||!this.ctx||document.hidden||age>=WIN_DURATION||this.disposed){onComplete();return;}
  const duration=this.reduced.matches?900:WIN_DURATION;
  if(age>=duration){onComplete();return;}
  this.done=onComplete;this.playing=true;this.skipVignette=false;this.streaks=18;this.lastFrame=0;
  this.canvas.hidden=false;this.canvas.setAttribute('aria-label',`${config.name} wins`);this.resize();
  this.onSound(id);const start=performance.now()-age;const image=this.cache.get(id);
  this.timer=window.setTimeout(()=>this.finish(),duration-age+100);
  const draw=(now:number)=>{
   if(!this.playing)return;const began=performance.now(),c=this.ctx!,w=this.canvas.width,h=this.canvas.height;
   const t=Math.min(1,(now-start)/duration),eased=1-Math.pow(1-t,3),fade=Math.min(1,(1-t)/.15);
   if(this.lastFrame&&now-this.lastFrame>34){this.skipVignette=true;this.streaks=6;}this.lastFrame=now;
   c.clearRect(0,0,w,h);c.globalAlpha=fade;c.fillStyle='#030610';c.fillRect(0,0,w,h);
   if(!this.reduced.matches&&t<.15){c.globalAlpha=fade*(1-t/.15)*.55;c.fillStyle=config.secondary;c.fillRect(0,0,w,h);}
   if(image){
    const zoom=this.reduced.matches?1:1.15-.15*eased;
    const scale=Math.min(w*.82/image.naturalWidth,h*.95/image.naturalHeight)*zoom;
    const iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;
    c.globalAlpha=fade*Math.min(1,eased*2);c.drawImage(image,(w-iw)/2,(h-ih)/2,iw,ih);
   }
   c.globalAlpha=fade;
   if(!this.skipVignette){const g=c.createRadialGradient(w/2,h/2,h*.15,w/2,h/2,Math.max(w,h)*.65);g.addColorStop(0,'#00000000');g.addColorStop(1,config.primary+'BB');c.fillStyle=g;c.fillRect(0,0,w,h);}
   if(!this.reduced.matches){c.strokeStyle=config.secondary;c.lineWidth=2;c.globalAlpha=fade*.4;
    for(let i=0;i<this.streaks;i++){const y=((i*73+t*h*.4)%(h+90))-45,x=(i*137)%w;c.beginPath();c.moveTo(x,y);c.lineTo(x+60,y-25);c.stroke();}}
   if(t>.22){c.globalAlpha=fade*Math.min(1,(t-.22)/.2);const y=h*.83+(this.reduced.matches?0:(1-eased)*40);
    c.fillStyle='#030610DD';c.fillRect(0,y-12,w,h-y+12);c.fillStyle=config.primary;c.fillRect(0,y-12,w,5);
    c.fillStyle='#FFFFFF';c.textAlign='center';c.font=`900 ${Math.max(16,Math.min(42,w*.047))}px sans-serif`;c.fillText(config.name.toUpperCase()+' WINS',w/2,y+42,w*.92);}
   c.globalAlpha=1;
   if(performance.now()-began>8){this.skipVignette=true;this.streaks=0;}
   if(t>=1)this.finish();else this.frame=requestAnimationFrame(draw);
  };this.frame=requestAnimationFrame(draw);
 }
 private finish(){const done=this.done;this.cancel();done?.();}
 cancel(){cancelAnimationFrame(this.frame);clearTimeout(this.timer);this.frame=0;this.timer=0;this.done=null;this.playing=false;this.canvas.hidden=true;this.ctx?.clearRect(0,0,this.canvas.width,this.canvas.height);}
 dispose(){this.disposed=true;this.cancel();this.observer.disconnect();document.removeEventListener('visibilitychange',this.visibility);this.cache.clear();this.loading.clear();this.canvas.remove();}
}
