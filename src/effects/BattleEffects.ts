import {moveLook,BLACK_FLASH_LOOK,type MoveLook,type HandOrigin} from './MovePalette';
import type {CombatAction} from '../combat/CombatManager';
import {EnergyLayer} from './EnergyLayer';
import {VfxBudget,VFX_LIMITS} from './VfxBudget';
export class BattleEffects {
 private local:EnergyLayer;private remote:EnergyLayer;private context:AudioContext|null=null;private master:GainNode|null=null;
 private budget=new VfxBudget();private frame=0;private lastFrame=0;private fps=60;private nextDebug=0;
 private debug=document.createElement('output');private debugButton=document.createElement('button');
 debugState:()=>string=()=>'';
 private animate=(now:number)=>{
  this.frame=0;
  if(document.hidden){this.clear();return;}
  if(this.lastFrame){const dt=now-this.lastFrame;this.budget.sample(dt);if(dt>0&&dt<250)this.fps=this.fps*.9+1000/dt*.1;}this.lastFrame=now;
  this.local.draw(now);this.remote.draw(now);
  if(!this.debug.hidden&&now>this.nextDebug){this.nextDebug=now+250;this.debug.textContent=`VFX ${this.local.renderer} · ${Math.round(this.fps)} FPS\nParticles ${this.budget.total}/${VFX_LIMITS.global} (you ${this.budget.local}, opponent ${this.budget.remote})\nDetail ${Math.round(this.budget.quality*100)}% · video untouched\n${this.debugState()}`;}
  if(this.local.active||this.remote.active||!this.debug.hidden)this.frame=requestAnimationFrame(this.animate);else this.lastFrame=0;
 };
 private wake(){if(!this.frame)this.frame=requestAnimationFrame(this.animate);}
 private voices:AudioScheduledSourceNode[]=[];private noise:AudioBuffer|null=null;private muted=false;private button:HTMLButtonElement;
 private unlock=()=>{if(!this.muted)void this.audio()?.resume();};
 constructor(localStage:HTMLElement,remoteStage:HTMLElement){
  this.local=new EnergyLayer(localStage,localStage.querySelector('video')!,true,this.budget,0);this.remote=new EnergyLayer(remoteStage,remoteStage.querySelector('video')!,false,this.budget,1);
  this.debug.hidden=true;this.debug.className='vfx-debug';this.debug.style.cssText='position:fixed;bottom:12px;left:12px;z-index:100;background:#070b14ed;color:#b9f5e9;padding:12px;border:1px solid #456;font:12px/1.5 monospace;white-space:pre;pointer-events:none';document.body.append(this.debug);
  this.debugButton.textContent='VFX stats';this.debugButton.setAttribute('aria-pressed','false');this.debugButton.onclick=()=>{this.debug.hidden=!this.debug.hidden;this.debugButton.setAttribute('aria-pressed',String(!this.debug.hidden));this.wake();};document.querySelector('.topbar')!.append(this.debugButton);
  try{this.muted=localStorage.getItem('domainclash.sound-muted')==='true';}catch{}
  this.button=document.createElement('button');this.button.id='battle-sound';this.button.onclick=()=>{this.muted=!this.muted;try{localStorage.setItem('domainclash.sound-muted',String(this.muted));}catch{}this.refresh();if(this.muted)this.silence();else this.unlock();};this.refresh();document.querySelector('.topbar')!.append(this.button);
  window.addEventListener('pointerdown',this.unlock);window.addEventListener('keydown',this.unlock);
 }
 private refresh(){this.button.textContent=this.muted?'Sound: off':'Sound: on';this.button.setAttribute('aria-pressed',String(!this.muted));}
 private audio(){if(this.context)return this.context;try{this.context=new AudioContext();const compressor=this.context.createDynamicsCompressor();this.master=this.context.createGain();this.master.gain.value=.2;this.master.connect(compressor);compressor.connect(this.context.destination);this.noise=this.context.createBuffer(1,this.context.sampleRate,this.context.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}catch{return null;}return this.context;}
 private silence(){for(const voice of this.voices)try{voice.stop();}catch{}this.voices=[];}
 play(action:CombatAction,origin:HandOrigin={x:.5,y:.6},remote=false,characterId?:string,age=0,blackFlash=false,follow=true){const look=blackFlash?BLACK_FLASH_LOOK:moveLook(action,characterId);if(!look||age>=look.duration)return;(remote?this.remote:this.local).play(look,origin,performance.now(),age,!remote&&follow);this.nextDebug=0;this.wake();const banner=document.querySelector<HTMLElement>('#technique-reveal');if(banner){banner.style.background=`linear-gradient(100deg,${look.color}aa,#081528bb,transparent)`;banner.style.borderColor=look.accent;banner.style.animationDuration=`${Math.max(450,look.duration)}ms`;}this.sound(look);}
 track(origin:HandOrigin|null){this.local.track(origin,performance.now());}
 charge(action:CombatAction|null,origin:HandOrigin|null,progress:number,characterId:string){this.local.charge(action?moveLook(action,characterId):null,origin,progress,performance.now());if(action)this.wake();}
 winSound(characterId:string){const base=moveLook('BASIC_PUNCH',characterId);if(base)this.sound({...base,duration:1100,notes:base.notes.map((n,i)=>n*(1+i*.5)),noise:.08,wave:'triangle'});}
 private sound(p:MoveLook){
  if(this.muted||document.hidden)return;const ac=this.audio();if(!ac||ac.state!=='running')return;this.silence();
  const start=ac.currentTime,duration=Math.min(.85,p.duration/1000);
  p.notes.forEach((note,i)=>{const at=start+i*duration*.11,osc=ac.createOscillator(),gain=ac.createGain();osc.type=p.wave;osc.frequency.setValueAtTime(note,at);osc.frequency.exponentialRampToValueAtTime(Math.max(30,note*.45),at+duration*.65);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.15,at+.008);gain.gain.exponentialRampToValueAtTime(.001,at+duration*.65);osc.connect(gain);gain.connect(this.master!);osc.start(at);osc.stop(at+duration*.7);osc.onended=()=>{osc.disconnect();gain.disconnect();};this.voices.push(osc);});
  if(p.noise&&this.noise){const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();source.buffer=this.noise;filter.type='bandpass';filter.frequency.value=p.notes[0]*3;filter.Q.value=.7;gain.gain.setValueAtTime(p.noise*.3,start);gain.gain.exponentialRampToValueAtTime(.001,start+duration*.6);source.connect(filter);filter.connect(gain);gain.connect(this.master!);source.start(start);source.stop(start+duration*.65);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};this.voices.push(source);}
 }
 clear(){cancelAnimationFrame(this.frame);this.frame=0;this.lastFrame=0;this.local.stop();this.remote.stop();this.silence();}
 dispose(){this.clear();this.local.dispose();this.remote.dispose();this.button.remove();this.debugButton.remove();this.debug.remove();window.removeEventListener('pointerdown',this.unlock);window.removeEventListener('keydown',this.unlock);void this.context?.close();}
}
