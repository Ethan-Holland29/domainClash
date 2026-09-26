import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PoseLibrary,describe} from '../.test-build/progress/calibration/PoseLibrary.js';
import {mainFrame} from '../.test-build/progress/handTracking/MainSigns.js';
import {GestureRecognizer} from '../.test-build/progress/handTracking/GestureRecognizer.js';
import {GESTURE_DEFINITIONS,LEARNED_MODEL} from '../.test-build/signs/handTracking/GestureDefinitions.js';
import {createSample} from '../.test-build/signs/data/GestureSampleFactory.js';
import {serializeDataset,parseDataset} from '../.test-build/signs/data/GestureDatasetImportExport.js';
import {playUICue,installUISounds} from '../.test-build/progress/ui/UISounds.js';

globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
function hands(){return [1,.65].map((scale,index)=>({
  handedness:index?'Unknown':'Right',handednessScore:.92,
  landmarks:Array.from({length:21},(_,i)=>({x:.2+index*.35+(i%4)*.025*scale,y:.75-Math.floor(i/4)*.04*scale,z:i*.001})),
  worldLandmarks:Array.from({length:21},(_,i)=>({x:i*.002,y:i*.003,z:-i*.001})),
}));}
function memoryDataset(initial=[]){let stored=structuredClone(initial);return {
  all:async()=>structuredClone(stored),
  import:async(samples,mode)=>{stored=mode==='replace'?structuredClone(samples):[...stored,...structuredClone(samples)];},
};}
test('shipped MediaPipe runtime and every WASM file match main’s pinned 1.0.1 dependency',()=>{
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
  assert.equal(pkg.dependencies['@mediapipe/tasks-vision'],'1.0.1');
  const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  for(const file of fs.readdirSync('node_modules/@mediapipe/tasks-vision/wasm')){
    assert.equal(hash('public/tracking/wasm/'+file),hash('node_modules/@mediapipe/tasks-vision/wasm/'+file));
  }
  assert.equal(hash('public/tracking/vision-bundle.js'),hash('node_modules/@mediapipe/tasks-vision/vision_bundle.cjs'));
});
test('recordings preserve main’s unequal two-hand geometry, handedness, world points and aspect',async()=>{
  const source=hands(),frame=mainFrame(source,200,16/9);
  const sample=createSample('LAPSE_BLUE',frame,[]);
  const [decoded]=parseDataset(serializeDataset([sample]));
  assert.equal(decoded.hands[1].handedness,'Unknown');
  assert.ok(Math.abs(decoded.aspectRatio-16/9)<.000001);
  for(let h=0;h<2;h++)for(let i=0;i<21;i++){
    assert.ok(Math.abs(decoded.hands[h].landmarks[i].x-(1-source[h].landmarks[i].x))<.000001);
    assert.ok(Math.abs(decoded.hands[h].worldLandmarks[i].x+source[h].worldLandmarks[i].x)<.000001);
  }
  const library=new PoseLibrary(),store=memoryDataset();await library.connectDataset(store);
  await library.saveSamples('AMPLIFICATION_BLUE',[sample],false);
  assert.deepEqual((await store.all())[0],sample);
  LEARNED_MODEL.train([]);
});
test('main backups take precedence over lossy legacy poses and preserve other labels on replacement',async()=>{
  const frame=mainFrame(hands(),100,16/9);
  const samples=Array.from({length:100},()=>createSample('LAPSE_BLUE',frame,[]));
  const none=createSample('NONE',frame,[]),other=createSample('CLEAVE',frame,[]);
  const store=memoryDataset([none,other]),library=new PoseLibrary();
  library.replace({AMPLIFICATION_BLUE:Array.from({length:25},()=>describe(hands(),16/9))});
  await library.connectDataset(store);
  await library.importBackup(serializeDataset(samples));
  assert.equal(library.count('AMPLIFICATION_BLUE'),100);
  assert.equal(library.data.AMPLIFICATION_BLUE.length,25,'original backup is retained');
  assert.equal((await store.all()).length,102);
  await library.saveSamples('AMPLIFICATION_BLUE',samples.slice(0,20),false);
  assert.equal(library.count('AMPLIFICATION_BLUE'),20);
  assert.deepEqual((await store.all()).filter(s=>s.label!=='LAPSE_BLUE'),[none,other]);
  await assert.rejects(library.importBackup('{"format":"domainclash-gesture-dataset","samples":[]}'));
  assert.equal((await store.all()).length,22,'invalid imports leave stored samples untouched');
  LEARNED_MODEL.train([]);
});
test('live recognition evaluates each move only once per frame and still confirms after holding',()=>{
  const def=GESTURE_DEFINITIONS.find(d=>d.id==='unlimited-void'),original=def.evaluate;
  let evaluations=0,confirmed=0;
  def.evaluate=()=>{evaluations++;return {score:1,checks:[]};};
  try{
    const recognizer=new GestureRecognizer(()=>({moves:['GOJO_ULTIMATE'],aspect:16/9}));
    recognizer.onEvent(e=>{if(e.type==='confirmed')confirmed++;});
    for(let t=0;t<1500;t+=50)recognizer.update([],t);
    assert.equal(evaluations,30);assert.equal(confirmed,1);
    assert.equal(recognizer.getState().debug[0].debug.score,recognizer.core.snapshot().gestures[0].score);
  }finally{def.evaluate=original;}
});
test('camera requests main’s resolution without a frame cap and waits for a usable frame',async()=>{
  const {CameraManager}=await import('../.test-build/camera/CameraManager.js');
  const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator'),media=globalThis.HTMLMediaElement;
  const video={srcObject:null,readyState:0,videoWidth:0,play:async()=>{}};
  const track={readyState:'live',muted:false,stop(){this.readyState='ended';}};
  let constraints;
  globalThis.HTMLMediaElement={HAVE_CURRENT_DATA:2};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async c=>{constraints=c;return {getTracks:()=>[track],getVideoTracks:()=>[track]};}}}});
  try{
    const camera=new CameraManager(video);let ready=false;
    const pending=camera.start().then(()=>{ready=true;});
    await new Promise(r=>setTimeout(r,10));assert.equal(ready,false);
    video.readyState=2;video.videoWidth=1280;await pending;
    assert.deepEqual(constraints.video,{facingMode:'user',width:{ideal:1280},height:{ideal:720}});
    assert.equal(camera.isReady(),true);camera.stop();assert.equal(camera.isActive(),false);
  }finally{globalThis.HTMLMediaElement=media;if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
});
class FakeAudio {
  state='running';currentTime=10;destination={};tones=[];closed=false;
  createOscillator(){const tone={frequency:{setValueAtTime(v){tone.pitch=v;},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(t){tone.startAt=t;},stop(t){tone.stopAt=t;}};this.tones.push(tone);return tone;}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
  close(){this.closed=true;return Promise.resolve();}
}
test('fighter selection has a distinct rising chime while buttons have one short tap',()=>{
  const click=new FakeAudio(),fighter=new FakeAudio();playUICue(click,'click');playUICue(fighter,'fighter');
  assert.deepEqual(click.tones.map(t=>t.pitch),[240]);assert.deepEqual(fighter.tones.map(t=>t.pitch),[440,660,880]);
  assert.equal(click.tones[0].type,'triangle');assert.equal(fighter.tones[0].type,'sine');
  assert.ok(click.tones[0].stopAt-click.tones[0].startAt<.1);
});
test('delegated sounds cover dynamic controls once, skip disabled and programmatic clicks, and clean up',()=>{
  const previous={Element:globalThis.Element,AudioContext:globalThis.AudioContext};let audio,created=0;
  class Control{disabled=false;portrait=false;closest(selector){return selector.includes('disabled')?(this.disabled?this:null):this;}matches(){return this.portrait;}}
  globalThis.Element=Control;globalThis.AudioContext=class extends FakeAudio{constructor(){super();audio=this;created++;}};
  const handlers=new Map(),root={contains:()=>true,addEventListener:(t,h)=>handlers.set(t,h),removeEventListener:t=>handlers.delete(t)};
  try{
    const cleanup=installUISounds(root),control=new Control();
    handlers.get('click')({isTrusted:false,target:control});assert.equal(created,0);
    control.disabled=true;handlers.get('click')({isTrusted:true,target:control});assert.equal(created,0);
    control.disabled=false;handlers.get('click')({isTrusted:true,target:control});
    control.portrait=true;handlers.get('click')({isTrusted:true,target:control});
    assert.equal(created,1);assert.equal(audio.tones.length,4);
    cleanup();assert.equal(audio.closed,true);assert.equal(handlers.size,0);
  }finally{Object.assign(globalThis,previous);}
});
