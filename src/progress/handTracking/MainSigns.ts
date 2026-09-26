import { GESTURE_DEFINITIONS, withLearning } from '../../signs/handTracking/GestureDefinitions';
import { DEFAULT_GESTURE_CONFIG } from '../../signs/handTracking/GestureRecognizer';
import { analyzeFrame } from '../../signs/handTracking/HandGeometry';
import { filterHands, DEFAULT_HAND_FILTER_CONFIG } from '../../signs/handTracking/HandFilter';
import { definitionFor as existingDefinition, toSignFrame } from '../../handTracking/MergedGestureRecognizer';
import type { GestureDefinition } from '../../signs/handTracking/GestureTypes';
import type { TrainingSample } from '../../signs/handTracking/GestureKnnModel';
import type { TrackedHand } from './HandTypes';
import { GESTURE_LABELS, type GestureType, type GestureEvaluation } from './GestureTypes';

const originalIds: Partial<Record<GestureType,string>> = {
  AMPLIFICATION_BLUE:'lapse-blue',REVERSAL_RED:'reversal-red',GOJO_ULTIMATE:'unlimited-void',
  CLEAVE:'cleave',PIERCING_BLOOD:'piercing-blood',DIVINE_DOGS:'divine-dogs',NUE:'nue',
  SUKUNA_ULTIMATE:'malevolent-shrine',MEGUMI_ULTIMATE:'chimera-shadow-garden',
};
export function signDefinition(gesture:GestureType):GestureDefinition {
  const original=GESTURE_DEFINITIONS.find(d=>d.id===originalIds[gesture]);
  if(original)return {...original,id:gesture};
  if(gesture==='BASIC_PUNCH')return existingDefinition('BASIC_PUNCH');
  // New progress techniques retain their own identity and are taught through recordings.
  return withLearning({id:gesture,datasetLabel:gesture,name:GESTURE_LABELS[gesture],
    action:gesture.endsWith('ULTIMATE')?'DOMAIN_EXPANSION':'PRIMARY_ATTACK',
    taughtOnly:true,sign:'Record your own distinct sign for this move.',
    evaluate:()=>({score:0,checks:[{label:'Record this sign first',score:0,detail:'Use the Record tab.'}]})});
}
export function mainFrame(hands:TrackedHand[],now:number,aspect:number){
  return toSignFrame(hands.map(h=>({...h,score:h.handednessScore})),now,Number.isFinite(aspect)&&aspect>0?aspect:4/3);
}
export function evaluateMain(hands:TrackedHand[],aspect:number,allowed:GestureType[]):GestureEvaluation[]{
  const frame=mainFrame(hands,0,aspect),allHands=analyzeFrame(frame);
  const trusted=filterHands(allHands,frame.aspectRatio,DEFAULT_HAND_FILTER_CONFIG).hands;
  const results=allowed.map(gesture=>({gesture,result:signDefinition(gesture).evaluate({hands:trusted,allHands})})).sort((a,b)=>b.result.score-a.result.score);
  return results.map(({gesture,result},i)=>({gesture,aspectRatio:frame.aspectRatio,
    matched:i===0&&result.score>=DEFAULT_GESTURE_CONFIG.enterThreshold&&result.score-(results[1]?.result.score??0)>=DEFAULT_GESTURE_CONFIG.ambiguityMargin,
    debug:{score:result.score,error:1-result.score,limit:1-DEFAULT_GESTURE_CONFIG.enterThreshold,
      checks:Object.fromEntries(result.checks.map(c=>[c.label,c.score>=DEFAULT_GESTURE_CONFIG.enterThreshold]))}}));
}
/** Reconstruct progress's wrist-relative backups into main's normalized sample format. */
export function samplesFromPoses(gesture:GestureType,poses:number[][][]):TrainingSample[]{
  return poses.map((pose,index)=>({label:signDefinition(gesture).datasetLabel,aspectRatio:1,timestamp:index*100,
    hands:pose.map(hand=>({landmarks:Array.from({length:21},(_,i)=>({
      x:1-(.4+(hand[63]+hand[i*3])*.1),y:.5+(hand[64]+hand[i*3+1])*.1,z:hand[i*3+2]*.1,
    }))}))}));
}
