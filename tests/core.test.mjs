import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatManager } from '../.test-build/combat/CombatManager.js';
import { AbilityId as A } from '../.test-build/combat/AbilityTypes.js';
import { HealthSystem } from '../.test-build/combat/HealthSystem.js';
import { DomainManager } from '../.test-build/domain/DomainManager.js';
import { DomainMeter } from '../.test-build/domain/DomainMeter.js';
import { GestureRecognizer } from '../.test-build/handTracking/GestureRecognizer.js';
import { evaluateGestures } from '../.test-build/handTracking/GestureDefinitions.js';
import { GameConfig as C } from '../.test-build/config/GameConfig.js';

function advance(combat, clock, duration) {
  for (let elapsed = 0; elapsed < duration;) {
    const dt = Math.min(20, duration - elapsed);
    elapsed += dt; clock.now += dt; combat.update(dt, clock.now);
  }
}
function pose(open = true, xOffset = 0, handedness = 'Right') {
  const landmarks = Array.from({ length: 21 }, () => ({ x: .5 + xOffset, y: .7, z: 0 }));
  landmarks[0] = { x: .5 + xOffset, y: .8, z: 0 };
  for (const [base, x] of [[5,.43],[9,.48],[13,.53],[17,.58]]) {
    landmarks[base] = { x: x + xOffset, y: .6, z: 0 };
    landmarks[base + 1] = { x: x + xOffset, y: .47, z: 0 };
    landmarks[base + 2] = { x: x + xOffset, y: .4, z: 0 };
    landmarks[base + 3] = { x: x + xOffset, y: open || base === 5 ? .32 : .69, z: 0 };
  }
  landmarks[3] = { x: .35 + xOffset, y: .68, z: 0 };
  landmarks[4] = { x: .24 + xOffset, y: .59, z: 0 };
  return { landmarks, score: .99, handedness };
}

test('HP clamps damage to actual remaining HP', () => {
  const hp = new HealthSystem(100);
  assert.equal(hp.damage(120), 100); assert.equal(hp.current, 0);
  assert.equal(hp.damage(5), 0); hp.reset(); hp.damage(-20);
  assert.equal(hp.current, 100); hp.damage(NaN); assert.equal(hp.current, 100);
});
test('meter clamps to range and resets', () => {
  const meter = new DomainMeter(); meter.add(-30); assert.equal(meter.get(), 0);
  meter.add(150); assert.equal(meter.get(), 100); meter.reset(); assert.equal(meter.get(), 0);
});
test('windup applies damage and meter only on hit; cooldown rejects repeats', () => {
  const c = new CombatManager(), clock = { now: 0 };
  assert.equal(c.tryActivate(A.PRIMARY_ATTACK, 0).ok, true);
  assert.equal(c.meter.get(), 0); assert.equal(c.opponentHp.current, 100);
  assert.equal(c.tryActivate(A.SECONDARY_ATTACK, 0).ok, false);
  advance(c, clock, C.combat.primary.windupMs);
  assert.equal(c.opponentHp.current, 95); assert.equal(c.meter.get(), 10);
  assert.equal(c.tryActivate(A.PRIMARY_ATTACK, clock.now).reason, 'cooldown');
  advance(c, clock, 1000);
  assert.equal(c.tryActivate(A.PRIMARY_ATTACK, clock.now).ok, true);
});
test('secondary adds 20 meter; rejected attacks emit no activation', () => {
  const c = new CombatManager(), events = []; c.on(e => events.push(e.type));
  assert.equal(c.tryActivate(A.DOMAIN_EXPANSION, 0).ok, false);
  assert.ok(!events.includes('ability_start'));
  c.tryActivate(A.SECONDARY_ATTACK, 0); c.update(420, 420);
  assert.equal(c.meter.get(), 20); assert.equal(c.opponentHp.current, 88);
});
test('Domain gates input, consumes meter, resumes and ends cleanly', () => {
  const c = new CombatManager(), clock = { now: 0 };
  c.meter.add(100); assert.equal(c.tryActivate(A.DOMAIN_EXPANSION, 0).ok, true);
  assert.equal(c.meter.get(), 0); assert.equal(c.match, 'cinematic');
  assert.equal(c.tryActivate(A.PRIMARY_ATTACK, 0).reason, 'busy');
  assert.equal(c.tryActivate(A.DOMAIN_EXPANSION, 0).ok, false);
  advance(c, clock, C.domain.cinematicMs);
  assert.equal(c.domain.isActive, true); assert.equal(c.match, 'playing');
  assert.equal(c.playerHp.current, 100);
  advance(c, clock, C.domain.durationMs);
  assert.equal(c.domain.isActive, false);
  assert.equal(c.opponentHp.current, 80);
});
test('domain tick accounting handles large deltas and final partial duration', () => {
  const d = new DomainManager(); d.beginCinematic(); d.update(C.domain.cinematicMs);
  const tick = d.update(C.domain.durationMs + 1000);
  assert.equal(tick.tickDamage, 20); assert.equal(tick.ended, true);
});
test('lethal player hit ends match before opponent retaliates on same frame', () => {
  const c = new CombatManager(); c.playerHp.current = 1; c.opponentHp.current = 1;
  c.update(3400, 3400); c.tryActivate(A.PRIMARY_ATTACK, 3400); c.update(500, 3900);
  assert.equal(c.match, 'victory'); assert.equal(c.playerHp.current, 1);
  assert.equal(c.tryActivate(A.SECONDARY_ATTACK, 4000).reason, 'ended');
});
test('idle player loses; restart clears cooldowns, pending hits, domain and HP', () => {
  const c = new CombatManager(), clock = { now: 0 };
  advance(c, clock, 55000); assert.equal(c.match, 'defeat');
  c.reset(); c.tryActivate(A.SECONDARY_ATTACK, clock.now); c.reset();
  advance(c, clock, 500); assert.equal(c.opponentHp.current, 100);
  assert.equal(c.playerHp.current, 100); assert.equal(c.meter.get(), 0);
  assert.equal(c.cooldowns.remainingMs(A.SECONDARY_ATTACK), 0);
});
test('held gesture fires once over several seconds and release rearms', () => {
  const recognizer = new GestureRecognizer(); const events = []; let now = 0;
  recognizer.onConfirmed(id => events.push(id));
  for (let i = 0; i < 250; i++) recognizer.update([pose()], 20, now += 20);
  assert.deepEqual(events, [A.PRIMARY_ATTACK]);
  for (let i = 0; i < 12; i++) recognizer.update([], 20, now += 20);
  for (let i = 0; i < 30; i++) recognizer.update([pose()], 20, now += 20);
  assert.deepEqual(events, [A.PRIMARY_ATTACK, A.PRIMARY_ATTACK]);
});
test('brief tracking loss does not rearm and interrupted hold cannot confirm', () => {
  const r = new GestureRecognizer(); const events = []; let now = 0;
  r.onConfirmed(id => events.push(id));
  for (let i = 0; i < 10; i++) r.update([pose()], 20, now += 20);
  r.update([], 20, now += 20);
  for (let i = 0; i < 10; i++) r.update([pose()], 20, now += 20);
  assert.equal(events.length, 0);
  for (let i = 0; i < 20; i++) r.update([pose()], 20, now += 20);
  r.update([], 20, now += 20);
  for (let i = 0; i < 60; i++) r.update([pose()], 20, now += 20);
  assert.equal(events.length, 1);
});
test('Shadow Garden uses a closed clasp, not two open palms', () => {
  const r = new GestureRecognizer(), events = []; r.onConfirmed(id => events.push(id));
  const hands=[pose(false,0,'Left'),pose(false,.09)];
  hands.forEach(h=>h.landmarks[8].y=.69);
  assert.equal(evaluateGestures([pose(true),pose(true,.09)]).find(e=>e.id===A.DOMAIN_EXPANSION).passed,false);
  for (let i = 0; i < 40; i++) r.update(hands, 20, i * 20);
  assert.deepEqual(events, [A.DOMAIN_EXPANSION]);
  assert.ok(evaluateGestures([pose(false)]).find(e => e.id === A.SECONDARY_ATTACK).passed);
});
test('geometry is scale and translation tolerant for each single-hand pose', () => {
  for (const open of [true, false]) for (const scale of [.55, 1, 1.3]) {
    const hand = pose(open); hand.landmarks = hand.landmarks.map(p => ({x: p.x * scale + .05, y: p.y * scale, z: p.z * scale}));
    assert.ok(evaluateGestures([hand]).find(e => e.id === (open ? A.PRIMARY_ATTACK : A.SECONDARY_ATTACK)).passed);
  }
});
test('simulated match strategies can earn and use Domain before victory', () => {
  for (const strategy of ['primary', 'secondary', 'mixed']) {
    const c = new CombatManager(), clock = { now: 0 }; let domains = 0;
    for (let i = 0; i < 2500 && !['victory','defeat'].includes(c.match); i++) {
      if (c.meter.isFull() && c.domain.canActivate()) {
        if (c.tryActivate(A.DOMAIN_EXPANSION, clock.now).ok) domains++;
      } else if (strategy === 'primary') c.tryActivate(A.PRIMARY_ATTACK, clock.now);
      else if (strategy === 'secondary') c.tryActivate(A.SECONDARY_ATTACK, clock.now);
      else { c.tryActivate(A.SECONDARY_ATTACK, clock.now); c.tryActivate(A.PRIMARY_ATTACK, clock.now); }
      advance(c, clock, 20);
    }
    assert.equal(c.match, 'victory', strategy); assert.ok(domains >= 1, strategy);
    console.log(`${strategy}: victory in ${(clock.now / 1000).toFixed(1)}s, ${c.playerHp.current} HP, ${domains} Domain`);
  }
});

test('malformed landmarks are rejected without crashing', () => {
  assert.ok(evaluateGestures([{ landmarks: [], score: 1, handedness: 'Left' }]).every(e => !e.passed));
  const hand = pose(); hand.landmarks[8].x = NaN;
  assert.ok(evaluateGestures([hand]).every(e => !e.passed));
});
test('camera denial has a useful error and failed playback stops stream', async () => {
  const { CameraManager, CameraError } = await import('../.test-build/camera/CameraManager.js');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
      mediaDevices: { getUserMedia: async () => { throw new DOMException('Denied', 'NotAllowedError'); } },
    }});
    const video = { srcObject: null, play: async () => { throw Error('play failed'); } };
    const camera = new CameraManager(video);
    await assert.rejects(camera.start(), e => e instanceof CameraError && e.kind === 'permission');
    let stopped = false;
    navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop: () => { stopped = true; } }] });
    await assert.rejects(camera.start()); assert.equal(stopped, true); assert.equal(video.srcObject, null);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  }
});
test('audio unlock generates distinct cues, supports mute and closes cleanly', async () => {
  const { AudioManager } = await import('../.test-build/audio/AudioManager.js');
  const old = globalThis.AudioContext;
  const frequencies = []; const gains = []; let closed = false;
  const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  globalThis.AudioContext = class {
    state = 'running'; currentTime = 0; sampleRate = 44100; destination = {};
    createGain() { const node = { gain: { ...param, value: 1 }, connect() {} }; gains.push(node); return node; }
    createOscillator() { return { frequency: { setValueAtTime: value => frequencies.push(value) }, connect() {}, start() {}, stop() {} }; }
    createBuffer(_, size) { return { getChannelData: () => new Float32Array(size) }; }
    createBufferSource() { return { connect() {}, start() {} }; }
    async close() { closed = true; }
  };
  try {
    const audio = new AudioManager(); audio.play('primary'); assert.equal(frequencies.length, 0);
    await audio.unlock(); const signatures = [];
    for (const cue of ['primary','secondary','hit','domain']) { frequencies.length = 0; audio.play(cue); signatures.push(frequencies.join(',')); }
    assert.equal(new Set(signatures).size, 4);
    audio.setMuted(true); assert.equal(gains[0].gain.value, 0);
    audio.setMuted(false); assert.equal(gains[0].gain.value, C.audio.masterVolume);
    audio.close(); assert.equal(closed, true); assert.equal(audio.isReady(), false);
  } finally { globalThis.AudioContext = old; }
});

test('camera projection mirrors once and retains the entire 4:3 image', async () => {
  const { containTransform, projectLandmark } = await import('../.test-build/rendering/CameraProjection.js');
  const fit = containTransform(1280, 720, 640, 480);
  assert.deepEqual(fit, {x:160,y:0,width:960,height:720});
  assert.deepEqual(projectLandmark({x:.25,y:.5,z:0},1280,720,640,480), {x:880,y:360});
  assert.deepEqual(projectLandmark({x:0,y:0,z:0},1280,720,640,480), {x:1120,y:0});
});
test('landmarks remain aligned at portrait and wide viewports', async () => {
  const { containTransform, projectLandmark } = await import('../.test-build/rendering/CameraProjection.js');
  for (const [w,h] of [[390,500],[1920,700],[640,480]]) {
    const fit=containTransform(w,h,640,480);
    assert.deepEqual(projectLandmark({x:.5,y:.5,z:0},w,h,640,480), {x:w/2,y:h/2});
    const p=projectLandmark({x:.2,y:.8,z:0},w,h,640,480);
    assert.ok(Math.abs(p.x-(w-fit.x-.2*fit.width))<1e-8);
    assert.ok(Math.abs(p.y-(fit.y+.8*fit.height))<1e-8);
  }
});
test('Cleave anchors to palm and blood to the fingertip with mirrored direction', async () => {
  const { handAnchor,projectLandmark } = await import('../.test-build/rendering/CameraProjection.js');
  const hand=pose(false); hand.landmarks[8].x=.65;
  const blood=handAnchor(A.SECONDARY_ATTACK,[hand],1280,720,640,480,{x:.5,y:.5});
  assert.deepEqual(blood.origin,projectLandmark(hand.landmarks[8],1280,720,640,480));
  assert.ok(blood.direction.x<0);
  const slash=handAnchor(A.PRIMARY_ATTACK,[pose()],1280,720,640,480,{x:.5,y:.5});
  assert.notDeepEqual(slash.origin,blood.origin);
});
test('Domain originates between two hands and keyboard preview has a deterministic source', async () => {
  const { handAnchor,projectLandmark } = await import('../.test-build/rendering/CameraProjection.js');
  const a=pose(true,0),b=pose(true,.2,'Left');
  const anchor=handAnchor(A.DOMAIN_EXPANSION,[a,b],1280,720,640,480,{x:.5,y:.5});
  const pa=projectLandmark(a.landmarks[9],1280,720,640,480),pb=projectLandmark(b.landmarks[9],1280,720,640,480);
  assert.deepEqual(anchor.origin,{x:(pa.x+pb.x)/2,y:(pa.y+pb.y)/2});
  assert.deepEqual(handAnchor(A.PRIMARY_ATTACK,[],1000,500,640,480,{x:.3,y:.6}).origin,{x:300,y:300});
});
test('free cast mode cannot kill either fighter and still enforces cast timing', () => {
  const c=new CombatManager(),clock={now:0};c.practiceMode=true;
  for(let i=0;i<100;i++){c.tryActivate(A.SECONDARY_ATTACK,clock.now);advance(c,clock,2200);}
  assert.equal(c.match,'playing');assert.equal(c.playerHp.current,100);assert.equal(c.opponentHp.current,100);
  assert.equal(c.tryActivate(A.SECONDARY_ATTACK,clock.now).ok,true);
  assert.equal(c.tryActivate(A.SECONDARY_ATTACK,clock.now).ok,false);
  c.reset();c.practiceMode=false;advance(c,clock,55000);assert.equal(c.match,'defeat');
});
import { Moves, isDomain } from '../.test-build/combat/MoveCatalog.js';
import { DomainSounds } from '../.test-build/audio/DomainSounds.js';
import { pageMoves } from '../.test-build/ui/MoveDock.js';
import { drawExpandedDomain } from '../.test-build/rendering/ExpandedDomains.js';

test('three-card pages expose the full catalog, with no empty last slots',()=>{
 const seen=new Set();for(let p=0;p<Math.ceil(Moves.length/3);p++){const page=pageMoves(p);assert.equal(page.length,3);page.forEach(m=>seen.add(m.id));}
 assert.equal(seen.size,Moves.length);assert.equal(Moves.length,31);
});
test('every domain keeps its identity through activation, ending, and cooldown',()=>{
 for(const m of Moves.filter(m=>isDomain(m.id))){
  const c=new CombatManager();c.practiceMode=true;const events=[];c.on(e=>events.push(e));c.meter.add(100);
  assert.equal(c.tryActivate(m.id,0).ok,true,m.name);assert.equal(c.domain.abilityId,m.id);
  assert.equal(c.cooldowns.remainingMs(m.id),m.cooldownMs);
  c.update(2400,2400);assert.equal(c.domain.remainingMs,m.durationMs);
  c.meter.add(100);assert.equal(c.tryActivate(m.id===A.UNLIMITED_VOID?A.MALEVOLENT_SHRINE:A.UNLIMITED_VOID,2400).ok,false);
  c.update(m.durationMs,2400+m.durationMs);assert.equal(c.domain.canActivate(),true);
  assert.equal(c.tryActivate(m.id,2400+m.durationMs).reason,'cooldown');
  c.update(m.cooldownMs,m.cooldownMs+2400+m.durationMs);assert.equal(c.tryActivate(m.id,m.cooldownMs+2400+m.durationMs).ok,true);
  assert.ok(events.some(e=>e.type==='domain_active'&&e.abilityId===m.id));assert.ok(events.some(e=>e.type==='domain_end'&&e.abilityId===m.id));
 }
});
test('gesture recognition covers all pages and does not depend on the preview dock',()=>{
 const r=new GestureRecognizer();const cast=[];r.onConfirmed(id=>cast.push(id));
 for(let page=0;page<6;page++){
  pageMoves(page);for(let i=0;i<12;i++)r.update([],20,page*3000+i*20);
  for(let i=0;i<40;i++)r.update([pose()],20,page*3000+300+i*20);
 }
 assert.deepEqual(cast,Array(6).fill(A.PRIMARY_ATTACK));
});
test('new domain sound motifs are all distinct and bounded',()=>{
 const profiles=Object.values(DomainSounds);assert.equal(profiles.length,16);assert.equal(new Set(profiles.map(p=>JSON.stringify(p))).size,16);
 for(const p of profiles){assert.ok(p.notes.length>=4);assert.ok(p.duration+p.spacing*p.notes.length<3);assert.ok(p.notes.every(n=>n>20&&n<5000));}
});
test('all eleven new domain renderers draw distinct geometry through entry, active and fade',()=>{
 const signatures=new Set();
 for(const m of Moves.filter(m=>isDomain(m.id)&&m.id!==A.DOMAIN_EXPANSION)){
  const calls=[];const grad={addColorStop(){}};
  const ctx=new Proxy({}, {get(_t,k){if(String(k).startsWith('create'))return()=>grad;return(...args)=>{assert.ok(args.every(a=>typeof a!=='number'||Number.isFinite(a)),`${m.name}: ${String(k)}`);calls.push([k,...args]);};},set(){return true;}});
  const c=new CombatManager();c.domain.beginCinematic(m.id);
  for(const dt of [0,1200,1200,m.durationMs-450]){c.domain.update(dt);drawExpandedDomain(ctx,c,{x:320,y:220},1.1,640,480);}
  assert.ok(calls.length>50,m.name);signatures.add(JSON.stringify(calls));
 }
 assert.equal(signatures.size,11);
});
test('Shrine, Void, Yuta, Yuji and Ryu silhouettes recognize mirrored and scaled landmarks',()=>{
 const fingers=(bits,offset=0)=>{const h=pose(true,offset);[8,12,16,20].forEach((tip,i)=>h.landmarks[tip].y=bits[i]?.32:.69);return h;};
 const fixtures=[
  [A.MALEVOLENT_SHRINE,[fingers([0,1,1,0]),fingers([0,1,1,0],.09)]],
  [A.UNLIMITED_VOID,[fingers([1,1,0,0])]],
  [A.MUTUAL_LOVE,[fingers([1,1,1,1]),fingers([0,0,0,0],.09)]],
  [A.YUJI_DOMAIN,[fingers([1,0,0,0]),fingers([1,0,0,0],.09)]],
  [A.RYU_DOMAIN,[fingers([1,0,0,1]),fingers([1,0,0,1],.09)]],
 ];
 for(const [id,hands] of fixtures)for(const scale of [.6,1,1.4])for(const mirror of [false,true]){
  const sample=hands.map(h=>({...h,landmarks:h.landmarks.map(p=>({x:(mirror?1-p.x:p.x)*scale,y:p.y*scale,z:p.z*scale}))}));
  assert.ok(evaluateGestures(sample).find(e=>e.id===id).passed,id);
 }
});
test('intricate sign approximations accept their intended silhouettes and reject missing hands',()=>{
 const bend=(offset=0)=>{const h=pose(true,offset);[8,12,16,20].forEach((t,i)=>h.landmarks[t].y=[.43,.45,.69,.45][i]);return h;};
 const rotate=(h,angle)=>{const o=h.landmarks[0];return {...h,landmarks:h.landmarks.map(p=>({x:o.x+(p.x-o.x)*Math.cos(angle)-(p.y-o.y)*Math.sin(angle),y:o.y+(p.x-o.x)*Math.sin(angle)+(p.y-o.y)*Math.cos(angle),z:p.z}))};};
 const fist=()=>{const h=pose(false);h.landmarks[8].y=.69;return h;};
 const mahito=[pose(),pose(true,.09)];mahito[0].landmarks[4]={x:.45,y:.65,z:0};mahito[1].landmarks[4]={x:.48,y:.65,z:0};
 const pinch=pose();pinch.landmarks[4]={...pinch.landmarks[8]};const flat=pose(true,.1);flat.landmarks=flat.landmarks.map(p=>({...p,y:p.y+.2}));
 const fixtures=[
  [A.IRON_MOUNTAIN,[rotate(bend(),.8),rotate(bend(.09),-.8)]],
  [A.SELF_EMBODIMENT,mahito],
  [A.CAPTIVATING_SKANDHA,[bend(),bend(.25)]],
  [A.WOMB_PROFUSION,[rotate(pose(false),.8),rotate(pose(false,.09),-.8)]],
  [A.DEATH_GAMBLE,[pinch,flat]],
  [A.URO_DOMAIN,[rotate(fist(),.8),rotate(fist(),-.8)]],
 ];
 for(const [id,hands] of fixtures){
  const result=evaluateGestures(hands).find(e=>e.id===id);assert.ok(result.passed,`${id}: ${JSON.stringify(result.checks)}`);
  assert.equal(evaluateGestures(hands.slice(0,1)).find(e=>e.id===id).passed,false,id);
 }
});

test('new one-hand regular signs are distinct from Cleave, Blood and each other',()=>{
 const fist=pose(false);fist.landmarks[8].y=.69;fist.landmarks[4]={x:.44,y:.62,z:0};
 const flash=structuredClone(fist);flash.landmarks[4]={x:.24,y:.59,z:0};
 const purple=pose(false);purple.landmarks[20].y=.32;
 const red=pose(true);red.landmarks[8]={x:.4,y:.65,z:0};red.landmarks[4]={x:.39,y:.64,z:0};
 for(const [id,h] of [[A.LAPSE_BLUE,fist],[A.BLACK_FLASH,flash],[A.HOLLOW_PURPLE,purple],[A.REVERSAL_RED,red]]){
  const r=new GestureRecognizer(),events=[];r.onConfirmed(id=>events.push(id));for(let i=0;i<40;i++)r.update([h],20,i*20);assert.deepEqual(events,[id]);
 }
});
test('regular visuals replace the previous cast and expire in half a second',async()=>{
 const old=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:false});
 try{const {GameRenderer}=await import('../.test-build/rendering/GameRenderer.js');const r=new GameRenderer({clientWidth:640,clientHeight:480},{videoWidth:640,videoHeight:480});r.startAbility(A.PRIMARY_ATTACK);r.startAbility(A.SECONDARY_ATTACK);assert.equal(r.casts.length,1);assert.equal(r.casts[0].id,A.SECONDARY_ATTACK);
  const {drawRegular}=await import('../.test-build/rendering/RegularEffects.js');let drew=false;const ctx=new Proxy({}, {get(){return()=>{drew=true;};}});drawRegular(ctx,{id:A.BLACK_FLASH,age:.51,anchor:{origin:{x:0,y:0},direction:{x:1,y:0},scale:30},seed:0},640,480);assert.equal(drew,false);
 }finally{globalThis.matchMedia=old;}
});
test('local regular recovery cannot be bypassed by changing techniques',()=>{
 const c=new CombatManager();c.practiceMode=true;c.tryActivate(A.PRIMARY_ATTACK,0);c.update(200,200);assert.equal(c.tryActivate(A.REVERSAL_RED,200).reason,'cooldown');c.update(800,1000);assert.equal(c.tryActivate(A.REVERSAL_RED,1000).ok,true);
});


test('cancelling camera permission while pending cannot revive the camera',async()=>{
 const {CameraManager}=await import('../.test-build/camera/CameraManager.js');
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator');let resolve,stopped=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolve=r)}}});
 try{
  const video={srcObject:null,play:async()=>{throw Error('Cancelled camera must not play');}};
  const camera=new CameraManager(video),pending=camera.start();camera.stop();
  resolve({getTracks:()=>[{stop:()=>stopped++}]});await pending;
  assert.equal(stopped,1);assert.equal(video.srcObject,null);assert.equal(camera.isActive(),false);
 }finally{if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator;}
});

test('split-screen anchors use the left pane and remote bitmap resources are released',async()=>{
 const old=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:false});
 try{
  const {GameRenderer}=await import('../.test-build/rendering/GameRenderer.js');
  const r=new GameRenderer({clientWidth:1000,clientHeight:600},{videoWidth:640,videoHeight:480});
  r.setSplit(true);r.setHands([pose()]);r.startAbility(A.PRIMARY_ATTACK);
  assert.ok(r.casts[0].anchor.origin.x<500);
  r.startAbility(A.SECONDARY_ATTACK,true);assert.ok(r.casts[0].anchor.origin.x>500);
  let closed=0;r.setRemoteFrame({close:()=>closed++});r.setRemoteFrame({close:()=>closed++});assert.equal(closed,1);r.setSplit(false);assert.equal(closed,2);
 }finally{globalThis.matchMedia=old;}
});


test('delayed worker results remain visible between arrivals and confirm a held sign once',async()=>{
 const {TrackingInput}=await import('../.test-build/handTracking/TrackingInput.js');
 const input=new TrackingInput(),recognizer=new GestureRecognizer(),events=[];
 recognizer.onConfirmed(id=>events.push(id));
 let frame={hands:[],timestampMs:-1};
 for(let now=0;now<=4000;now+=10){
  if(now>=450&&(now-450)%500===0)frame={hands:[pose()],timestampMs:now-450,receivedAtMs:now};
  input.update(frame,now,now,recognizer);
  if(now>=450)assert.equal(input.hands.length,1,'A processing delay must not erase a newly delivered hand');
 }
 assert.deepEqual(events,[A.PRIMARY_ATTACK]);
});

test('stalled or repeated worker frames cannot finish a sign or rearm a held cast',async()=>{
 const {TrackingInput}=await import('../.test-build/handTracking/TrackingInput.js');
 const input=new TrackingInput(),recognizer=new GestureRecognizer(),events=[];recognizer.onConfirmed(id=>events.push(id));
 const first={hands:[pose()],timestampMs:10,receivedAtMs:460};
 for(let now=460;now<2200;now+=20)input.update(first,now,now,recognizer);
 assert.equal(events.length,0);assert.equal(input.hands.length,0);
 for(let i=0;i<5;i++)input.update({hands:[pose()],timestampMs:2200+i*500,receivedAtMs:2650+i*500},2650+i*500,2650+i*500,recognizer);
 assert.deepEqual(events,[A.PRIMARY_ATTACK]);
 const last={hands:[pose()],timestampMs:4200,receivedAtMs:4650};
 input.update(last,7000,7000,recognizer);assert.equal(input.hands.length,0);
 for(let i=0;i<5;i++)input.update({hands:[pose()],timestampMs:7100+i*500,receivedAtMs:7550+i*500},7550+i*500,7550+i*500,recognizer);
 assert.deepEqual(events,[A.PRIMARY_ATTACK],'An inference stall is not a deliberate release');
 input.update({hands:[],timestampMs:9700,receivedAtMs:10150},10150,10150,recognizer);
 for(let i=0;i<5;i++)input.update({hands:[pose()],timestampMs:10200+i*500,receivedAtMs:10650+i*500},10650+i*500,10650+i*500,recognizer);
 assert.deepEqual(events,[A.PRIMARY_ATTACK,A.PRIMARY_ATTACK]);
});

test('tracking drops excessively delayed results and ignores out-of-order frames',async()=>{
 const {TrackingInput}=await import('../.test-build/handTracking/TrackingInput.js');
 const input=new TrackingInput(),r=new GestureRecognizer(),events=[];r.onConfirmed(id=>events.push(id));
 input.update({hands:[pose()],timestampMs:1,receivedAtMs:3000},3000,3000,r);assert.equal(input.hands.length,0);
 input.update({hands:[pose()],timestampMs:4000,receivedAtMs:4050},4050,4050,r);
 input.update({hands:[],timestampMs:3900,receivedAtMs:4060},4060,4060,r);
 assert.equal(input.hands.length,1);assert.equal(events.length,0);
});
