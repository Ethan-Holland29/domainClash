import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {WinTransitionController,WIN_REGISTRY,WIN_DURATION} from '../src/effects/WinTransition.ts';
import {CHARACTERS} from '../src/characters/Characters.ts';
import {Match} from '../server/match.mjs';

test('winner registry covers the current roster using existing local assets',()=>{
 assert.deepEqual(Object.keys(WIN_REGISTRY),CHARACTERS.map(c=>c.id));
 for(const c of Object.values(WIN_REGISTRY))assert.ok(existsSync('public'+c.image));
});
test('transition cancellation, replacement, expiry and failed preload are safe',async()=>{
 const originals=new Map();const set=(key,value)=>{originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
 let raf=null,decodes=0,gradientCalls=0;
 const context={clearRect(){},fillRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},createRadialGradient(){gradientCalls++;return {addColorStop(){}};}};
 const listeners=new Map();let canvas;
 set('document',{hidden:false,documentElement:{},body:{append(){}},createElement(){return canvas={hidden:true,style:{},setAttribute(){},getContext(){return context;},remove(){}};},addEventListener(n,f){listeners.set(n,f);},removeEventListener(n){listeners.delete(n);}});
 set('window',{setTimeout:()=>1});set('innerWidth',1920);set('innerHeight',1080);set('matchMedia',()=>({matches:false}));
 set('ResizeObserver',class{observe(){}disconnect(){}});set('requestAnimationFrame',fn=>{raf=fn;return 1;});set('cancelAnimationFrame',()=>{raf=null;});
 set('Image',class{naturalWidth=500;naturalHeight=800;async decode(){decodes++;throw Error('missing image');}});
 try{
  const c=new WinTransitionController();await c.preload(['gojo','gojo']);await c.preload(['gojo']);assert.equal(decodes,1);
  let completed=0;c.play('gojo',()=>completed++);assert.equal(c.playing,true);assert.ok(canvas.width<=1280);
  const first=raf;c.cancel();first(performance.now()+3000);assert.equal(completed,0);assert.equal(canvas.hidden,true);
  c.play('gojo',()=>completed++);c.play('sukuna',()=>completed++);raf(performance.now()+WIN_DURATION+1);assert.equal(completed,1);
  c.play('gojo',()=>completed++,WIN_DURATION);assert.equal(completed,2);assert.equal(c.playing,false);
  c.play('gojo');c.skipVignette=true;const before=gradientCalls;raf(performance.now()+100);assert.equal(gradientCalls,before);
  document.hidden=true;listeners.get('visibilitychange')();assert.equal(c.playing,false);
  c.dispose();assert.equal(listeners.size,0);
 }finally{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
test('authoritative winner timestamp is shared with both seats and remains stable',()=>{
 const match=new Match(100);match.join(100);match.finish(1,'Knockout');
 assert.equal(match.snapshot(0).finishedAt,100);assert.equal(match.snapshot(1).winner,1);
 match.now=200;match.finish(0,'duplicate');assert.equal(match.snapshot(1).finishedAt,100);assert.equal(match.winner,1);
});
