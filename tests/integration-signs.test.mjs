import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fallbackSigns,progressSigns,SIGN_HINTS} from '../src/integration/Signs.ts';
import {GESTURE_EVALUATORS} from '../src/handTracking/GestureDefinitions.ts';
import {ALL_GESTURES} from '../src/handTracking/GestureTypes.ts';
import {PoseLibrary,describe} from '../src/calibration/PoseLibrary.ts';

const hand={landmarks:Array.from({length:21},(_,i)=>({x:.4+(i%4)*.02,y:.7-i*.013,z:0})),handedness:'Left',handednessScore:1};
test('all progress evaluators are unchanged through integration, for zero, one and two hands',()=>{
 for(const hands of [[],[hand],[hand,{...hand,handedness:'Right'}]]){
  const integrated=fallbackSigns(hands,4/3,ALL_GESTURES);
  for(const id of progressSigns)assert.deepEqual(integrated.find(e=>e.gesture===id),GESTURE_EVALUATORS[id](hands));
 }
});
test('every existing kit gesture has a hint and usable built-in evaluator, invalid landmarks cannot trigger',()=>{
 assert.equal(fallbackSigns([],4/3,ALL_GESTURES).length,ALL_GESTURES.length);
 assert.ok(fallbackSigns([],4/3,ALL_GESTURES).every(e=>!e.matched));
 for(const id of ALL_GESTURES)assert.ok(SIGN_HINTS[id]?.length>10,id);
 assert.deepEqual(fallbackSigns([{...hand,landmarks:[{x:NaN,y:0,z:0}]}],4/3,ALL_GESTURES),[]);
});
test('recorded signs override only their own built-in sign; other moves remain enabled',()=>{
 const library=new PoseLibrary();library.data={REVERSAL_RED:[describe([hand],4/3)]};
 const result=library.evaluate([hand],4/3,['REVERSAL_RED','CLEAVE']);
 assert.equal(result[0].gesture,'REVERSAL_RED');assert.equal(result[0].matched,true);
 assert.deepEqual(result[1],GESTURE_EVALUATORS.CLEAVE([hand]));
});
