import test from 'node:test';
import assert from 'node:assert/strict';
import {GestureRecorder} from '../.test-build/signs/data/GestureRecorder.js';
import {GESTURE_DEFINITIONS,LEARNED_MODEL,SIGN_TUNING} from '../.test-build/signs/handTracking/GestureDefinitions.js';
import {analyzeFrame} from '../.test-build/signs/handTracking/HandGeometry.js';
function frame(timestampMs,hands=true){
  const landmarks=Array.from({length:21},(_,i)=>({x:(.5+(i%4)*.026)/(4/3),y:.78-Math.floor(i/4)*.035,z:0}));
  return {timestampMs,aspectRatio:4/3,hands:hands?[{landmarks,worldLandmarks:landmarks.map(p=>({...p})),handedness:'Right',handednessScore:.99}]:[]};
}
test('continuous posture recording captures every distinct frame beyond 300 and stop keeps them all',async()=>{
  const saved=[],r=new GestureRecorder(()=>frame(0),async s=>{saved.push(s);},{continuous:true});
  const done=r.record('LAPSE_BLUE');
  for(let i=1;i<=350;i++){r.capture(frame(i*16));r.capture(frame(i*16));}
  r.capture(frame(6000,false));assert.equal(r.recording,true);
  r.stop();assert.equal(r.recording,false);r.capture(frame(6100));
  assert.equal(await done,350);assert.equal(saved.length,350);assert.equal(new Set(saved.map(s=>s.id)).size,350);
  assert.equal(r.busy,false);assert.ok(saved.every(s=>s.label==='LAPSE_BLUE'&&s.hands[0].landmarks.length===21));
  const next=r.record('REVERSAL_RED');r.capture(frame(6200));r.cancel();assert.equal(await next,1);assert.equal(saved.at(-1).label,'REVERSAL_RED');
});
test('stopping waits for in-flight storage and prevents recording a second label before it finishes',async()=>{
  let release;const saved=[];
  const r=new GestureRecorder(()=>frame(0),s=>new Promise(resolve=>{release=()=>{saved.push(s);resolve();};}),{continuous:true});
  const done=r.record('CLEAVE');r.capture(frame(1));await Promise.resolve();r.stop();
  assert.equal(r.busy,true);assert.equal(await r.record('NUE'),0);release();
  assert.equal(await done,1);assert.equal(saved[0].label,'CLEAVE');assert.equal(r.busy,false);
});
test('storage failure stops continuous capture and reports failure instead of counting unsaved instances',async()=>{
  const r=new GestureRecorder(()=>frame(0),async()=>{throw new Error('disk full');},{continuous:true});
  const done=r.record('CLEAVE');const rejected=assert.rejects(done,/disk full/);r.capture(frame(1));r.capture(frame(2));await rejected;
  assert.equal(r.busy,false);assert.equal(r.recording,false);
});
test('camera-off recording is rejected without entering the recording state',async()=>{
  const r=new GestureRecorder(()=>null,async()=>{},{continuous:true});await assert.rejects(r.record('CLEAVE'),/Enable the camera/);assert.equal(r.busy,false);
});
test('the original learned matcher becomes trusted at exactly 300 instances',()=>{
  assert.equal(SIGN_TUNING.learned.trustedSamples,300);
  const f=frame(0),hands=analyzeFrame(f),def=GESTURE_DEFINITIONS.find(d=>d.datasetLabel==='LAPSE_BLUE');
  for(const n of [299,300]){LEARNED_MODEL.train(Array.from({length:n},()=>({label:'LAPSE_BLUE',aspectRatio:f.aspectRatio,hands:f.hands,timestamp:0})));const result=def.evaluate({hands,allHands:hands});assert.equal(result.checks[0].label,n===300?'mode: learned (trusted)':'mode: learned');}
  LEARNED_MODEL.train([]);
});
