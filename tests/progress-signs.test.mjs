import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureRecognizer } from '../.test-build/progress/handTracking/GestureRecognizer.js';
import { PoseLibrary,describe } from '../.test-build/progress/calibration/PoseLibrary.js';
import { signDefinition,mainFrame,samplesFromPoses } from '../.test-build/progress/handTracking/MainSigns.js';
import { GESTURE_DEFINITIONS,LEARNED_MODEL } from '../.test-build/signs/handTracking/GestureDefinitions.js';
import { DEFAULT_GESTURE_CONFIG } from '../.test-build/signs/handTracking/GestureRecognizer.js';
import { analyzeFrame } from '../.test-build/signs/handTracking/HandGeometry.js';

globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
function hand(aspect=4/3){
  const landmarks=Array.from({length:21},(_,i)=>({x:(.5+(i%4)*.026)/aspect,y:.78-Math.floor(i/4)*.035,z:0}));
  return {landmarks,worldLandmarks:landmarks.map(p=>({...p,x:p.x*.1,y:p.y*.1})),handedness:'Right',handednessScore:.99};
}
test('progress signs preserve main definitions, labels and accuracy thresholds',()=>{
  const pairs={AMPLIFICATION_BLUE:'lapse-blue',REVERSAL_RED:'reversal-red',GOJO_ULTIMATE:'unlimited-void',CLEAVE:'cleave',PIERCING_BLOOD:'piercing-blood',SUKUNA_ULTIMATE:'malevolent-shrine',MEGUMI_ULTIMATE:'chimera-shadow-garden'};
  for(const [id,mainId]of Object.entries(pairs)){
    const actual=signDefinition(id),expected=GESTURE_DEFINITIONS.find(d=>d.id===mainId);
    assert.equal(actual.evaluate,expected.evaluate);assert.equal(actual.datasetLabel,expected.datasetLabel);
  }
  const recognizer=new GestureRecognizer(()=>({moves:[],aspect:4/3}));assert.deepEqual(recognizer.core.config,DEFAULT_GESTURE_CONFIG);
  assert.equal(signDefinition('YUTA_ULTIMATE').datasetLabel,'YUTA_ULTIMATE');
  assert.equal(signDefinition('RYU_ULTIMATE').taughtOnly,true);
});
test('progress camera adapter retains metric landmarks, handedness and aspect ratio',()=>{
  const source=hand(),frame=mainFrame([source],80,16/9);
  assert.equal(frame.hands[0].worldLandmarks.length,21);
  assert.equal(frame.hands[0].worldLandmarks[0].x,-source.worldLandmarks[0].x);
  assert.equal(frame.hands[0].landmarks[0].x,1-source.landmarks[0].x);
  assert.equal(frame.aspectRatio,16/9);assert.equal(frame.timestampMs,80);
});
test('progress backups train main matcher without changing a recorded sign’s shape',()=>{
  const hands=[hand()],pose=describe(hands,4/3);
  LEARNED_MODEL.train(samplesFromPoses('AMPLIFICATION_BLUE',Array.from({length:25},()=>pose)));
  const analyzed=analyzeFrame(mainFrame(hands,0,4/3));
  assert.ok(signDefinition('AMPLIFICATION_BLUE').evaluate({hands:analyzed,allHands:analyzed}).score>=.7);
  LEARNED_MODEL.train([]);
});
test('progress Record, Diagnose and live combat share main’s learned matcher and release latch',()=>{
  const library=new PoseLibrary(),hands=[hand()],pose=describe(hands,4/3);
  library.replace({AMPLIFICATION_BLUE:Array.from({length:25},()=>pose)});
  assert.equal(library.available('AMPLIFICATION_BLUE'),true);
  assert.equal(library.evaluate(hands,4/3,['AMPLIFICATION_BLUE'])[0].matched,true);
  const r=new GestureRecognizer(()=>({moves:['AMPLIFICATION_BLUE'],aspect:4/3}));const events=[];r.onEvent(e=>events.push(e));
  for(let t=0;t<1500;t+=50)r.update(hands,t);
  assert.equal(events.filter(e=>e.type==='confirmed').length,1);
  r.suspend();for(let t=2000;t<3000;t+=50)r.update(hands,t);
  assert.equal(events.filter(e=>e.type==='confirmed').length,1);
  for(let t=3000;t<3600;t+=50)r.update([],t);
  for(let t=3600;t<4600;t+=50)r.update(hands,t);
  assert.equal(events.filter(e=>e.type==='confirmed').length,2);
  LEARNED_MODEL.train([]);
});
test('tracking stalls cancel unfinished holds and built-in signs do not require recordings',()=>{
  const library=new PoseLibrary();assert.equal(library.available('GOJO_ULTIMATE'),true);assert.equal(library.available('AMPLIFICATION_BLUE'),false);
  const hands=[hand()],pose=describe(hands,4/3);library.replace({AMPLIFICATION_BLUE:Array.from({length:25},()=>pose)});
  const r=new GestureRecognizer(()=>({moves:['AMPLIFICATION_BLUE'],aspect:4/3}));let fired=0;r.onEvent(e=>{if(e.type==='confirmed')fired++;});
  r.update(hands,0);r.update(hands,100);r.update(hands,2000);assert.equal(fired,0);
  LEARNED_MODEL.train([]);
});
