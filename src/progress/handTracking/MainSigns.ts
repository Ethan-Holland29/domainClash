import { GESTURE_DEFINITIONS, withLearning } from '../../signs/handTracking/GestureDefinitions';
import { DEFAULT_GESTURE_CONFIG } from '../../signs/handTracking/GestureRecognizer';
import { analyzeFrame, wristDistanceInPalms } from '../../signs/handTracking/HandGeometry';
import { filterHands, DEFAULT_HAND_FILTER_CONFIG } from '../../signs/handTracking/HandFilter';
import type { GestureDefinition, GestureContext } from '../../signs/handTracking/GestureTypes';
import type { HandFrame } from '../../signs/handTracking/HandTypes';
import type { TrainingSample } from '../../signs/handTracking/GestureKnnModel';
import type { TrackedHand } from './HandTypes';
import { GESTURE_LABELS, type GestureType, type GestureEvaluation } from './GestureTypes';

const originalIds: Partial<Record<GestureType,string>> = {
  AMPLIFICATION_BLUE:'lapse-blue',REVERSAL_RED:'reversal-red',GOJO_ULTIMATE:'unlimited-void',
  CLEAVE:'cleave',PIERCING_BLOOD:'piercing-blood',DIVINE_DOGS:'divine-dogs',NUE:'nue',
  SUKUNA_ULTIMATE:'malevolent-shrine',MEGUMI_ULTIMATE:'chimera-shadow-garden',
};
const recordingLabelAliases: Record<string, string> = {
  AMPLIFICATION_BLUE: 'LAPSE_BLUE',
  BLUE: 'LAPSE_BLUE',
  SUPERNOVA: 'CHOSO_ULTIMATE',
  CHOSO_ULTIMATE: 'CHOSO_ULTIMATE',
  'STRAIGHT_HANDS': 'YUJI_ULTIMATE',
  'HOLLOW_PURPLE': 'HOLLOW_PURPLE',
  'CURSED_FISTS': 'CURSED_FISTS',
};
/** Map display/legacy spellings back to the stable storage labels used by the recognizer. */
export function canonicalRecordingLabel(label: string): string {
  const normalized = label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return recordingLabelAliases[normalized] ?? label;
}
export function signDefinition(gesture:GestureType):GestureDefinition {
  const original=GESTURE_DEFINITIONS.find(d=>d.id===originalIds[gesture]);
  if(original)return {...original,id:gesture,...(gesture==='PIERCING_BLOOD'?{holdMs:350}:{})};
  if(gesture==='GUARD')return {
    // Keep the recognized gesture ID identical to the battle move ID. The
    // progress recognizer emits definition.id (not definition.action), and
    // combat only accepts the canonical uppercase GUARD move.
    id:'GUARD',datasetLabel:'GUARD',name:GESTURE_LABELS.GUARD,action:'GUARD',
    sign:'Cross your forearms at the wrists, make two fists, and hold them crossed.',
    evaluate(ctx:GestureContext){
      const [a,b]=ctx.hands;
      const extended=(hand:typeof a)=>hand?Object.values(hand.fingers).filter(finger=>finger.extended>.5).length:5;
      const bothFists=ctx.hands.length===2&&extended(a)<=1&&extended(b)<=1;
      // MediaPipe only sees the hands, not the crossed forearms. In the
      // pictured guard pose the wrists meet while the fists remain apart, so
      // requiring the hand bounding boxes to overlap rejects the real pose.
      // Use the two closed fists plus nearby wrists as the stable camera cue.
      const wristGap=!!a&&!!b?wristDistanceInPalms(a,b):Infinity;
      const fistGap=!!a&&!!b?Math.hypot(a.knuckleCenter.x-b.knuckleCenter.x,a.knuckleCenter.y-b.knuckleCenter.y)/((a.palmSize+b.palmSize)/2||1):0;
      const wristsCrossed=!!a&&!!b&&wristGap<2.6&&fistGap>.75;
      const checks=[
        {label:'Two closed fists',score:bothFists?1:0,detail:`${ctx.hands.length} hand(s), ${extended(a)} and ${extended(b)} extended finger(s)`},
        {label:'Wrists crossed',score:wristsCrossed?1:0,detail:`wrists ${Number.isFinite(wristGap)?wristGap.toFixed(2):'—'} palm widths apart; fists ${fistGap.toFixed(2)} apart`},
      ];
      return {score:checks.every(check=>check.score===1)?1:0,checks};
    },
  };
  if(gesture==='BASIC_PUNCH')return withLearning({
    id:'BASIC_PUNCH',datasetLabel:'BASIC_PUNCH',name:GESTURE_LABELS.BASIC_PUNCH,
    action:'PRIMARY_ATTACK',sign:'One hand, closed fist.',
    evaluate(ctx:GestureContext){
      const hand=ctx.hands[0];
      const extended=hand?Object.values(hand.fingers).filter(finger=>finger.extended>.5).length:5;
      const score=ctx.hands.length===1&&extended<=1?1:0;
      return {score,checks:[{label:'One closed fist',score,detail:`${ctx.hands.length} hand(s), ${extended} extended finger(s)`}]};
    },
  });
  // New progress techniques retain their own identity and are taught through recordings.
  return withLearning({id:gesture,datasetLabel:gesture,name:GESTURE_LABELS[gesture],
    action:gesture.endsWith('ULTIMATE')?'DOMAIN_EXPANSION':'PRIMARY_ATTACK',
    taughtOnly:true,sign:'Record your own distinct sign for this move.',
    evaluate:()=>({score:0,checks:[{label:'Record this sign first',score:0,detail:'Use the Record tab.'}]})});
}
export function mainFrame(hands:TrackedHand[],now:number,aspect:number){
  const frame:HandFrame={timestampMs:now,aspectRatio:Number.isFinite(aspect)&&aspect>0?aspect:4/3,
    hands:hands.map(h=>({
      landmarks:h.landmarks.map(p=>({x:1-p.x,y:p.y,z:p.z})),
      worldLandmarks:(h.worldLandmarks??[]).map(p=>({x:-p.x,y:p.y,z:p.z})),
      handedness:h.handedness,handednessScore:h.handednessScore,
    }))};
  return frame;
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
