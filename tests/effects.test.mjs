import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterEffects, EFFECT_PREVIEWS, proceduralEffectStyle, techniqueArtAnchor, usesPreservedTechniqueArt } from '../.test-build/progress/rendering/CharacterEffects.js';

function environment(){
  let id=0,now=performance.now();const frames=new Map(),listeners=new Map();
  const context=new Proxy({}, {get(target,key){if(key in target)return target[key];if(key==='createRadialGradient'||key==='createLinearGradient')return()=>({addColorStop(){}});return(...args)=>{for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v),`${String(key)} received non-finite geometry`);};},set(t,k,v){t[k]=v;return true;}});
  const canvas=()=>({width:300,height:150,dataset:{},setAttribute(){},getContext(){return context;},remove(){}});
  globalThis.document={hidden:false,createElement:canvas,addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
  globalThis.devicePixelRatio=3;globalThis.matchMedia=()=>({matches:false});
  globalThis.ResizeObserver=class{constructor(fn){this.fn=fn;}observe(){this.fn([{contentRect:{width:1920,height:1080}}]);}disconnect(){}};
  globalThis.Image=class{complete=true;naturalWidth=300;naturalHeight=600;decode(){return Promise.resolve();}};
  globalThis.requestAnimationFrame=f=>{frames.set(++id,f);return id;};globalThis.cancelAnimationFrame=n=>frames.delete(n);
  const stages=[];const vfx=new CharacterEffects({append:c=>stages.push(c)});
  function advance(count=1){for(let i=0;i<count;i++){now+=16.67;const pending=[...frames.values()];frames.clear();pending.forEach(f=>f(now));}}
  return{vfx,frames,listeners,advance,canvas:stages[0]};
}
test('every roster effect completes with finite geometry and returns to zero animation callbacks',async()=>{
  const e=environment();
  for(const [character,actions] of Object.entries(EFFECT_PREVIEWS))for(const action of actions){e.vfx.play({character,action});await new Promise(resolve=>setImmediate(resolve));e.advance(280);assert.equal(e.frames.size,0,action);}
  assert.ok(e.canvas.width<=1440);e.vfx.dispose();assert.equal(e.listeners.size,0);
});
test('effect bursts are bounded, visibility pauses work, and clearing cancels all animation',()=>{
  const e=environment();for(let i=0;i<100;i++)e.vfx.play({character:'gojo',action:'HOLLOW_PURPLE'});
  assert.match(e.vfx.stats,/12 effects/);assert.equal(e.frames.size,1);
  document.hidden=true;e.listeners.get('visibilitychange')();assert.equal(e.frames.size,0);
  document.hidden=false;e.listeners.get('visibilitychange')();assert.equal(e.frames.size,1);
  e.vfx.clear();assert.equal(e.frames.size,0);assert.match(e.vfx.stats,/0 effects/);
  e.vfx.dispose();e.vfx.play({character:'gojo',action:'GOJO_ULTIMATE'});assert.equal(e.frames.size,0);
});

test('directed attacks originate at screen center for both players and grow toward viewer', async()=>{
  const {forwardRadius}=await import('../.test-build/progress/rendering/CharacterEffects.js');
  const e=environment();
  for(const side of ['player','enemy']){
    e.vfx.play({character:'gojo',action:'REVERSAL_RED',side});
    const cast=e.vfx.casts.at(-1);assert.equal(cast.x,480);assert.equal(cast.y,270);
  }
  assert.ok(forwardRadius(.8,64)>forwardRadius(.4,64)*3);
  assert.equal(forwardRadius(.8,64,true),64);
  e.vfx.dispose();
});

test('techniques use animated motifs and only requested exception art remains',()=>{
  assert.equal(proceduralEffectStyle('CLEAVE'),'red-slash');
  assert.equal(proceduralEffectStyle('CURSED_TOOLS'),'multi-slash');
  assert.equal(proceduralEffectStyle('GRANITE_BLAST'),'blue-blast');
  assert.equal(proceduralEffectStyle('PIERCING_BLOOD'),'fast-beam');
  assert.equal(proceduralEffectStyle('GETO_ULTIMATE'),'spiral');
  assert.equal(proceduralEffectStyle('CURSE_SWALLOW'),'heal-cross');
  assert.equal(proceduralEffectStyle('BASIC_PUNCH'),'impact-frame');
  assert.equal(proceduralEffectStyle('GOJO_ULTIMATE'),'space');
  assert.equal(proceduralEffectStyle('MEGUMI_ULTIMATE'),'dark-aura');
  assert.equal(proceduralEffectStyle('CHOSO_ULTIMATE'),'blood-explosion');
  assert.deepEqual(['DIVINE_DOGS','NUE','MAHORAGA','SUKUNA_ULTIMATE','RIKA','CLEAVE'].filter(usesPreservedTechniqueArt).sort(),['DIVINE_DOGS','MAHORAGA','NUE','RIKA','SUKUNA_ULTIMATE']);
  assert.equal(techniqueArtAnchor('RIKA'),'left');
  assert.equal(techniqueArtAnchor('CLEAVE'),'center');
  const e=environment();
  e.vfx.play({character:'yuji',action:'YUJI_ULTIMATE'});assert.equal(e.vfx.domain,null,'Straight Hands is a flurry, not a domain');
  e.vfx.clear();e.vfx.play({character:'sukuna',action:'SUKUNA_ULTIMATE'});assert.equal(e.vfx.domain,'sukuna','Malevolent Shrine keeps its original domain visual');
  e.vfx.dispose();
});
