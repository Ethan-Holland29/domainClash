import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureRecognizer } from '../.test-build/progress/handTracking/GestureRecognizer.js';
import { PoseLibrary,describe } from '../.test-build/progress/calibration/PoseLibrary.js';
import { canonicalRecordingLabel,signDefinition,mainFrame,samplesFromPoses } from '../.test-build/progress/handTracking/MainSigns.js';
import { GESTURE_DEFINITIONS,LEARNED_MODEL } from '../.test-build/signs/handTracking/GestureDefinitions.js';
import { DEFAULT_GESTURE_CONFIG } from '../.test-build/signs/handTracking/GestureRecognizer.js';
import { analyzeFrame } from '../.test-build/signs/handTracking/HandGeometry.js';
import { GestureKnnModel } from '../.test-build/signs/handTracking/GestureKnnModel.js';
import { DEBUGGER_CHARACTER } from '../.test-build/progress/characters/DebugCharacter.js';
import { CHARACTERS } from '../.test-build/progress/characters/Characters.js';
import { characterGestures } from '../.test-build/progress/characters/CharacterTypes.js';
import { ALL_GESTURES, DEFAULT_GESTURE_CONFIG as PROGRESS_GESTURE_CONFIG, GESTURE_LABELS } from '../.test-build/progress/handTracking/GestureTypes.js';

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
  const recognizer=new GestureRecognizer(()=>[]);assert.deepEqual(recognizer.core.config,DEFAULT_GESTURE_CONFIG);
  assert.equal(signDefinition('YUTA_ULTIMATE').datasetLabel,'YUTA_ULTIMATE');
  assert.equal(signDefinition('RYU_ULTIMATE').taughtOnly,true);
});
test('recording labels accept move names and legacy IDs while keeping stable matcher labels',()=>{
  assert.equal(canonicalRecordingLabel('Amplification: Blue'),'LAPSE_BLUE');
  assert.equal(canonicalRecordingLabel('AMPLIFICATION_BLUE'),'LAPSE_BLUE');
  assert.equal(canonicalRecordingLabel('Supernova'),'CHOSO_ULTIMATE');
  assert.equal(canonicalRecordingLabel('CHOSO_ULTIMATE'),'CHOSO_ULTIMATE');
  assert.equal(canonicalRecordingLabel('Straight Hands'),'YUJI_ULTIMATE');
  assert.equal(canonicalRecordingLabel('Cursed Fists'),'CURSED_FISTS');
  assert.equal(canonicalRecordingLabel('Hollow Purple'),'HOLLOW_PURPLE');
  assert.equal(signDefinition('AMPLIFICATION_BLUE').datasetLabel,'LAPSE_BLUE');
  assert.equal(signDefinition('CHOSO_ULTIMATE').datasetLabel,'CHOSO_ULTIMATE');
});
test('trusted Piercing Blood recordings from a continuous session calibrate their pose variation',()=>{
  const samples=Array.from({length:40},(_,i)=>{
    const hands=mainFrame([hand(),hand()],i*100,4/3).hands;
    // Small natural finger-position variation across adjacent live frames.
    hands[1].landmarks[8].x+=i*.001;
    return {label:'PIERCING_BLOOD',timestamp:i*100,aspectRatio:4/3,hands};
  });
  const model=new GestureKnnModel();model.train(samples);
  assert.ok(model.spreadFor('PIERCING_BLOOD')>0,'continuous recordings spanning multiple two-second windows should not get zero tolerance');
  assert.equal(signDefinition('PIERCING_BLOOD').holdMs,350);
});
test('Debugger can recognize every gesture but is excluded from the normal fighter roster',()=>{
  assert.deepEqual(characterGestures(DEBUGGER_CHARACTER),ALL_GESTURES);
  assert.equal(CHARACTERS.some(character=>character.id==='debugger'),false);
});
test('Hollow Purple and Cursed Fists are recordable by their owners and have hand-sign guide labels',()=>{
  assert.ok(characterGestures(CHARACTERS.find(character=>character.id==='gojo')).includes('HOLLOW_PURPLE'));
  assert.ok(characterGestures(CHARACTERS.find(character=>character.id==='yuji')).includes('CURSED_FISTS'));
  assert.equal(GESTURE_LABELS.HOLLOW_PURPLE,'Hollow Purple');
  assert.equal(GESTURE_LABELS.CURSED_FISTS,'Cursed Fists');
  assert.equal(PROGRESS_GESTURE_CONFIG.CURSED_FISTS.requiredHands,2);
});
test('Block is a two-hand crossed-fist signal available to every fighter',()=>{
  assert.equal(GESTURE_LABELS.GUARD,'Block');
  assert.equal(PROGRESS_GESTURE_CONFIG.GUARD.requiredHands,2);
  assert.equal(signDefinition('GUARD').id,'GUARD','the recognizer emits the ID as the move input, so it must match battle’s canonical move ID');
  assert.equal(signDefinition('GUARD').datasetLabel,'GUARD');
  for(const character of CHARACTERS)assert.ok(characterGestures(character).includes('GUARD'),character.name);
  const closedFist= (wristX,fistX) => ({
    hand:{landmarks:Array.from({length:21},()=>({x:wristX,y:.5,z:0})),worldLandmarks:[],handedness:'Right',handednessScore:.99},
    aspectRatio:1,fingers:{thumb:{extended:.1},index:{extended:.1},middle:{extended:.1},ring:{extended:.1},pinky:{extended:.1}},
    palmCenter:{x:wristX,y:.5},palmSize:.05,tipCenter:{x:fistX,y:.5},knuckleCenter:{x:fistX,y:.5},worldPalmSize:.05,palmNormal:{x:0,y:0,z:1},
  });
  const hands=[closedFist(.48,.42),closedFist(.52,.58)];
  const block=signDefinition('GUARD').evaluate({hands,allHands:hands});
  assert.equal(block.score,1,'two fists with wrists close together are sufficient; fist silhouettes need not overlap');
  assert.equal(signDefinition('GUARD').evaluate({hands:hands.slice(0,1),allHands:hands.slice(0,1)}).score,0,'a single fist cannot trigger Block');
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
  const r=new GestureRecognizer(h=>library.evaluate(h,4/3,['AMPLIFICATION_BLUE']));const events=[];r.onEvent(e=>events.push(e));
  for(let t=0;t<1500;t+=50)r.update(hands,t);
  assert.equal(events.filter(e=>e.type==='confirmed').length,1);
  r.suspend();for(let t=2000;t<3000;t+=50)r.update(hands,t);
  assert.equal(events.filter(e=>e.type==='confirmed').length,1);
  for(let t=3000;t<3600;t+=50)r.update([],t);
  for(let t=3600;t<4600;t+=50)r.update(hands,t);
  assert.equal(events.filter(e=>e.type==='confirmed').length,2);
  LEARNED_MODEL.train([]);
});
test('imported recordings under Blue display names train the move the combat recognizer expects',()=>{
  const library=new PoseLibrary(),hands=[hand()];
  library.setImportedSamples([
    ...Array.from({length:25},(_,i)=>({label:'Amplification: Blue',aspectRatio:4/3,hands:mainFrame(hands,i,4/3).hands,timestamp:i*100})),
  ]);
  assert.equal(library.available('AMPLIFICATION_BLUE'),true);
  assert.equal(library.evaluate(hands,4/3,['AMPLIFICATION_BLUE'])[0].matched,true);
  library.setImportedSamples(Array.from({length:25},(_,i)=>({label:'Supernova',aspectRatio:4/3,hands:mainFrame(hands,i,4/3).hands,timestamp:i*100})));
  assert.equal(library.available('CHOSO_ULTIMATE'),true);
  assert.equal(library.evaluate(hands,4/3,['CHOSO_ULTIMATE'])[0].matched,true);
  LEARNED_MODEL.train([]);
});
test('tracking stalls cancel unfinished holds and built-in signs do not require recordings',()=>{
  const library=new PoseLibrary();assert.equal(library.available('GOJO_ULTIMATE'),true);assert.equal(library.available('AMPLIFICATION_BLUE'),false);
  const hands=[hand()],pose=describe(hands,4/3);library.replace({AMPLIFICATION_BLUE:Array.from({length:25},()=>pose)});
  const r=new GestureRecognizer(h=>library.evaluate(h,4/3,['AMPLIFICATION_BLUE']));let fired=0;r.onEvent(e=>{if(e.type==='confirmed')fired++;});
  r.update(hands,0);r.update(hands,100);r.update(hands,2000);assert.equal(fired,0);
  LEARNED_MODEL.train([]);
});

test('live fast path uses the original recognizer once with identical confirmation and release behavior',()=>{
  const library=new PoseLibrary(),hands=[hand()],pose=describe(hands,4/3);
  library.replace({AMPLIFICATION_BLUE:Array.from({length:25},()=>pose)});
  const legacy=new GestureRecognizer(h=>library.evaluate(h,4/3,['AMPLIFICATION_BLUE']));
  let duplicateEvaluations=0;
  const fast=new GestureRecognizer(()=>{duplicateEvaluations++;return [];},()=>({moves:['AMPLIFICATION_BLUE'],aspect:4/3}));
  const expected=[],actual=[];legacy.onEvent(e=>expected.push(e));fast.onEvent(e=>actual.push(e));
  for(let t=0;t<2600;t+=33){const visible=t<1000||t>1500?hands:[];const a=legacy.update(visible,t),b=fast.update(visible,t);assert.equal(b.phase,a.phase);assert.equal(b.holdProgress,a.holdProgress);}
  assert.deepEqual(actual,expected);assert.equal(duplicateEvaluations,0);assert.equal(actual.filter(e=>e.type==='confirmed').length,2);
  LEARNED_MODEL.train([]);
});
