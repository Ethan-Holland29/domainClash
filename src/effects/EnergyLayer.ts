import type {HandOrigin,MoveLook} from './MovePalette';
import {VfxBudget,VFX_LIMITS} from './VfxBudget';
import {quadVertex,energyFragment,particleVertex,particleFragment} from './shaders';

const shapes=['impact','slashes','blood','claws','lightning','wheel','void','shrine','garden','repel','attract','granite','restore','combo','blade','swallow','uzumaki','spirit','copy','supernova','purple','fracture'];
const styles=['embers','streaks','droplets','smoke','stars'];
const rgb=(hex:string)=>new Float32Array([parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255]);
interface Program {handle:WebGLProgram; uniforms:Record<string,WebGLUniformLocation|null>;attribute:number;}

/** Fixed buffers, one active release per player and no frame-dependent JS allocations. */
export class EnergyLayer {
 readonly canvas=document.createElement('canvas');
 private gl:WebGLRenderingContext|null=null;private fallback:CanvasRenderingContext2D|null=null;
 private energy:Program|null=null;private points:Program|null=null;
 private quad:WebGLBuffer|null=null;private buffer:WebGLBuffer|null=null;
 private particles=new Float32Array(VFX_LIMITS.perPlayer*4);
 private angles=new Float32Array(VFX_LIMITS.perPlayer);private speeds=new Float32Array(VFX_LIMITS.perPlayer);
 private colors=new Map<MoveLook,Float32Array[]>();
 private look:MoveLook|null=null;private chargeLook:MoveLook|null=null;
 private origin:HandOrigin={x:.5,y:.6};private chargeOrigin:HandOrigin={x:.5,y:.6};
 private began=0;private chargeAt=-Infinity;private chargeProgress=0;private count=0;private granted=0;
 private shake:Animation|null=null;
 private x=0;private y=0;private radius=100;private aspect=4/3;private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 private observer:ResizeObserver;private width=1;private height=1;private lost=false;
 private video:HTMLVideoElement;private mirrored:boolean;private budget:VfxBudget;private seat:number;
 constructor(stage:HTMLElement,video:HTMLVideoElement,mirrored:boolean,budget:VfxBudget,seat:number){
  this.video=video;this.mirrored=mirrored;this.budget=budget;this.seat=seat;
  this.canvas.className='move-vfx';this.canvas.setAttribute('aria-hidden','true');
  this.canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;object-fit:fill;transform:none!important';
  stage.append(this.canvas);
  for(let i=0;i<VFX_LIMITS.perPlayer;i++){this.angles[i]=i*2.399963;this.speeds[i]=.55+(i%13)/13;}
  this.initialize();
  this.observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;this.width=r.width;this.height=r.height;this.resize();});this.observer.observe(stage);
  this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.stop();});
  this.canvas.addEventListener('webglcontextrestored',()=>{this.initialize();this.resize();});
 }
 private program(vertex:string,fragment:string,attribute:string,names:string[]):Program {
  const gl=this.gl!;
  const compile=(type:number,source:string)=>{const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(error??'Shader compile failed');}return shader;};
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment),handle=gl.createProgram()!;
  gl.attachShader(handle,vs);gl.attachShader(handle,fs);gl.linkProgram(handle);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(handle,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(handle)??'Shader link failed');
  return {handle,attribute:gl.getAttribLocation(handle,attribute),uniforms:Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(handle,n)]))};
 }
 private initialize(){
  this.lost=false;
  this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
  if(!this.gl){this.fallback=this.canvas.getContext('2d');return;}
  try{
   const gl=this.gl;
   this.energy=this.program(quadVertex,energyFragment,'position',['resolution','center','primary','secondary','ambient','time','progress','charge','mode','radius','opacity','detail','aura']);
   this.points=this.program(particleVertex,particleFragment,'particle',['resolution','primary','secondary','style']);
   this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.particles.byteLength,gl.DYNAMIC_DRAW);
   gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
  }catch(error){console.warn('Energy shader unavailable; effects disabled on this device.',error);this.lost=true;}
 }
 private resize(){
  // Adapt only the VFX buffer. Never write video dimensions or sender settings.
  const scale=Math.min(1,900/Math.max(1,this.width),650/Math.max(1,this.height))*Math.max(.5,Math.sqrt(this.budget.quality));
  const w=Math.max(1,Math.round(this.width*scale)),h=Math.max(1,Math.round(this.height*scale));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.gl?.viewport(0,0,w,h);}
 }
 private palette(look:MoveLook){let value=this.colors.get(look);if(!value){value=[rgb(look.color),rgb(look.accent),rgb(look.ambient)];this.colors.set(look,value);}return value;}
 play(look:MoveLook,origin:HandOrigin,now:number,age=0){
  this.stop();if(this.lost||age>=look.duration)return;
  this.look=look;this.origin.x=origin.x;this.origin.y=origin.y;this.began=now-age;
  this.palette(look);this.granted=this.reduced.matches?0:this.budget.claim(this.seat,look.tier);this.count=this.granted;this.resize();
  if(look.shake&&!this.reduced.matches&&age<180){const n=look.shake;this.shake=this.canvas.parentElement!.animate([{transform:'translate(0,0)'},{transform:`translate(${n}px,${-n}px)`},{transform:`translate(${-n}px,${n/2}px)`},{transform:`translate(${n/2}px,0)`},{transform:'translate(0,0)'}],{duration:180-age});}
 }
 charge(look:MoveLook|null,origin:HandOrigin|null,progress:number,now:number){
  if(this.lost||!look||!origin||!look.aura){this.chargeLook=null;return;}
  this.chargeLook=look;this.chargeOrigin.x=origin.x;this.chargeOrigin.y=origin.y;this.chargeProgress=progress;this.chargeAt=now;this.palette(look);
 }
 get active(){return !this.lost&&(!!this.look||!!this.chargeLook);}
 get renderer(){return this.gl&&!this.lost?'WebGL':this.fallback?'Canvas fallback':'Unavailable';}
 private anchor(origin:HandOrigin){
  const w=this.canvas.width,h=this.canvas.height;
  if(this.video.videoWidth&&this.video.videoHeight)this.aspect=this.video.videoWidth/this.video.videoHeight;
  const vw=Math.min(w,h*this.aspect),vh=vw/this.aspect;
  this.x=(w-vw)/2+(this.mirrored?1-origin.x:origin.x)*vw;this.y=(h-vh)/2+origin.y*vh;
  this.radius=Math.min(w,h)*.23;
 }
 draw(now:number){
  if(this.lost)return;
  if(this.chargeLook&&now-this.chargeAt>500)this.chargeLook=null;
  if(this.look&&now-this.began>Math.min(this.look.duration,this.reduced.matches?350:Infinity)){this.look=null;this.count=0;this.budget.release(this.seat);}
  const look=this.look??this.chargeLook;if(!look){this.clear();return;}
  this.resize();this.anchor(this.look?this.origin:this.chargeOrigin);
  const charging=!this.look,t=charging?this.chargeProgress:Math.min(1,(now-this.began)/look.duration);
  const opacity=charging?.24+this.chargeProgress*.42:Math.min(1,(now-this.began)/35)*Math.pow(1-t,.55);
  const gl=this.gl;
  if(!gl||!this.energy||!this.points){this.drawFallback(look,t,opacity);return;}
  gl.clear(gl.COLOR_BUFFER_BIT);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  const p=this.energy,u=p.uniforms,colors=this.palette(look);
  gl.useProgram(p.handle);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(p.attribute);gl.vertexAttribPointer(p.attribute,2,gl.FLOAT,false,0,0);
  gl.uniform2f(u.resolution,this.canvas.width,this.canvas.height);gl.uniform2f(u.center,this.x,this.y);
  gl.uniform3fv(u.primary,colors[0]);gl.uniform3fv(u.secondary,colors[1]);gl.uniform3fv(u.ambient,colors[2]);
  gl.uniform1f(u.time,this.reduced.matches?0:now*.001);gl.uniform1f(u.progress,t);gl.uniform1f(u.charge,charging||this.reduced.matches?1:0);
  gl.uniform1f(u.mode,shapes.indexOf(look.shape));gl.uniform1f(u.radius,this.radius*(charging?.42:1));gl.uniform1f(u.opacity,opacity);
  gl.uniform1f(u.detail,this.budget.quality);gl.uniform1f(u.aura,look.aura?1:0);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(p.attribute);
  if(charging||this.reduced.matches)return;
  this.count=Math.min(this.count,Math.floor(VFX_LIMITS[look.tier]*this.budget.quality));this.budget.reduce(this.seat,this.count);
  const inward=look.shape==='attract'||look.shape==='swallow'||look.shape==='uzumaki';
  const portal=look.shape==='garden'||look.shape==='claws';
  for(let i=0;i<this.count;i++){
   const k=i*4,a=this.angles[i]+(inward?t*2.:0),r=this.radius*(inward?1-t:t)*this.speeds[i]*1.8;
   this.particles[k]=this.x+Math.cos(a)*r;this.particles[k+1]=this.y+Math.sin(a)*r*(portal?.3:1);
   this.particles[k+2]=(look.particleStyle==='smoke'?28:look.particleStyle==='droplets'?9:13)*(1-t*.5);
   this.particles[k+3]=opacity*(.5+(i%5)*.1);
  }
  const points=this.points,v=points.uniforms;gl.useProgram(points.handle);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.particles);
  gl.enableVertexAttribArray(points.attribute);gl.vertexAttribPointer(points.attribute,4,gl.FLOAT,false,0,0);gl.uniform2f(v.resolution,this.canvas.width,this.canvas.height);
  gl.uniform3fv(v.primary,colors[0]);gl.uniform3fv(v.secondary,colors[1]);gl.uniform1f(v.style,styles.indexOf(look.particleStyle));
  gl.blendFuncSeparate(gl.ONE,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.POINTS,0,this.count);gl.disableVertexAttribArray(points.attribute);
 }
 private drawFallback(look:MoveLook,t:number,opacity:number){
  const c=this.fallback;if(!c)return;c.clearRect(0,0,this.canvas.width,this.canvas.height);c.globalAlpha=opacity;
  c.fillStyle=look.color;c.beginPath();c.arc(this.x,this.y,Math.max(2,this.radius*.18*(1-t)),0,Math.PI*2);c.fill();
  c.strokeStyle=look.accent;c.lineWidth=3;c.beginPath();c.arc(this.x,this.y,this.radius*(.2+t),0,Math.PI*2);c.stroke();
 }
 private clear(){this.gl?.clear(this.gl.COLOR_BUFFER_BIT);this.fallback?.clearRect(0,0,this.canvas.width,this.canvas.height);}
 stop(){this.shake?.cancel();this.shake=null;this.look=null;this.chargeLook=null;this.count=0;this.budget.release(this.seat);this.clear();}
 dispose(){this.stop();this.observer.disconnect();const gl=this.gl;if(gl){gl.deleteBuffer(this.quad);gl.deleteBuffer(this.buffer);if(this.energy)gl.deleteProgram(this.energy.handle);if(this.points)gl.deleteProgram(this.points.handle);}this.canvas.remove();}
}
