import {GESTURE_EVALUATORS} from '../handTracking/GestureDefinitions';
import {GESTURE_DEFINITIONS} from './mainSigns/GestureDefinitions';
import {analyzeHand} from './mainSigns/HandGeometry';
import {fingerExtension,palmSize} from './KevinGeometry';
import type {TrackedHand} from '../handTracking/HandTypes';
import type {GestureType,GestureEvaluation} from '../handTracking/GestureTypes';
export const progressSigns:GestureType[]=['BASIC_PUNCH','CLEAVE','PIERCING_BLOOD','DIVINE_DOGS','NUE','MAHORAGA'];
const mainMap:Partial<Record<GestureType,string>>={GOJO_ULTIMATE:'UNLIMITED_VOID',SUKUNA_ULTIMATE:'MALEVOLENT_SHRINE',MEGUMI_ULTIMATE:'CHIMERA_SHADOW_GARDEN'};
// No recorded datasets ship in any source branch. These are explicitly labeled
// shortcut reuses for moves that none of the branches supplies a recorded sign for.
const reusedMain:Partial<Record<GestureType,string>>={RYU_ULTIMATE:'RYU_ISHIGORI_DOMAIN',YUTA_ULTIMATE:'AUTHENTIC_MUTUAL_LOVE',GETO_ULTIMATE:'RYU_ISHIGORI_DOMAIN'};
export const SIGN_HINTS:Record<GestureType|'HOLLOW_PURPLE',string>={
 BASIC_PUNCH:'One closed fist. Relax your hand before repeating.',
 CLEAVE:'One flat blade hand: extend all four fingers and hold them together.',
 PIERCING_BLOOD:'Two tight fists, knuckles pressed together at chest height.',
 DIVINE_DOGS:'One hand: index and middle together; ring and little finger curled.',
 NUE:'Cross both wrists; extend and spread the fingers on both hands.',
 MAHORAGA:'Two closed fists touching side by side; keep both wrists visible.',
 GOJO_ULTIMATE:'Cross one hand’s index and middle fingers; fold ring and little finger.',
 SUKUNA_ULTIMATE:'Raise both index fingers with tips touching; bend the other fingers.',
 MEGUMI_ULTIMATE:'Clasp hands with palms inward, fingers curled and interlocked, wrists below.',
 REVERSAL_RED:'Make a thumb/index circle; extend middle, ring and little finger.',
 AMPLIFICATION_BLUE:'Choose Blue in Gesture focus, then close a fist with the thumb tucked. Auto keeps this sign for Punch.',
 GRANITE_BLAST:'Shortcut: point one index finger; fold middle, ring and little finger.',
 RYU_ULTIMATE:'Shortcut: open both hands; touch index tips and thumb tips into a diamond.',
 YUJI_ULTIMATE:'Choose Straight Hands in Gesture focus, then make a fist with thumb extended. Auto keeps fists for Punch.',
 CURSED_TOOLS:'Shortcut: extend index and little finger; fold middle and ring finger.',
 CURSE_SWALLOW:'Shortcut: thumb/index circle; extend the other three fingers.',
 GETO_ULTIMATE:'Shortcut: open both hands and touch index and thumb tips into a diamond.',
 RIKA:'Shortcut: show one open palm with fingers spread wide.',
 YUTA_ULTIMATE:'Shortcut: hold one flat palm upright with fingers together, and a fist beside it.',
 CHOSO_ULTIMATE:'Shortcut: raise both index fingers side by side; curl the remaining fingers.',
 HOLLOW_PURPLE:'Unlock with two Red and two Blue uses and full meter, then use its button.',
};
export function signHint(id:string):string{return SIGN_HINTS[id as keyof typeof SIGN_HINTS]??'Use your recorded sign.';}
function shortcut(hands:TrackedHand[],gesture:GestureType):GestureEvaluation{
 const h=hands[0],p=h?.landmarks;
 const dist=(a:number,b:number)=>p?Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y):0;
 const scale=h?palmSize(h):1;
 const e=[5,9,13,17].map(base=>h?fingerExtension(h,base):0),fist=e.every(v=>v<.38),thumb=dist(4,5)/scale;
 let matched=false;
 if(hands.length===1){
  if(gesture==='AMPLIFICATION_BLUE')matched=fist&&thumb<.65;
  if(gesture==='YUJI_ULTIMATE')matched=fist&&thumb>=.65;
  if(gesture==='REVERSAL_RED'||gesture==='CURSE_SWALLOW')matched=dist(4,8)/scale<.4&&e[1]>.5&&e[2]>.5&&e[3]>.5&&e[0]<.5;
  if(gesture==='CURSED_TOOLS')matched=e[0]>.5&&e[3]>.5&&e[1]<.38&&e[2]<.38;
  if(gesture==='GRANITE_BLAST')matched=e[0]>.5&&e[1]<.38&&e[2]<.38&&e[3]<.38;
  if(gesture==='RIKA')matched=e.every(v=>v>.5)&&dist(8,20)/scale>.8;
 }
 if(gesture==='CHOSO_ULTIMATE'&&hands.length===2)matched=hands.every(hand=>fingerExtension(hand,5)>.5&&[9,13,17].every(base=>fingerExtension(hand,base)<.38))&&Math.abs(hands[0].landmarks[0].x-hands[1].landmarks[0].x)<.35;
 return {gesture,matched:!!matched,debug:{checks:{shortcut:!!matched},score:matched?1:0}};
}
export function fallbackSigns(hands:TrackedHand[],aspect:number,allowed:GestureType[]):GestureEvaluation[]{
 if(hands.some(h=>h.landmarks.length!==21||h.landmarks.some(p=>![p.x,p.y,p.z].every(Number.isFinite))))return [];
 const analysis=hands.map(h=>analyzeHand({...h,worldLandmarks:h.worldLandmarks??[]},aspect));
 return [...allowed].sort((a,b)=>Number(progressSigns.includes(b))-Number(progressSigns.includes(a))).map(gesture=>{
  if(progressSigns.includes(gesture))return GESTURE_EVALUATORS[gesture](hands);
  const label=mainMap[gesture]??reusedMain[gesture],definition=GESTURE_DEFINITIONS.find(d=>d.datasetLabel===label);
  if(definition){const r=definition.evaluate({hands:analysis,allHands:analysis});return {gesture,matched:r.score>=.75,requiredHoldMs:definition.holdMs,debug:{score:r.score,checks:Object.fromEntries(r.checks.map(c=>[c.label,c.score>=.75]))}};}
  return shortcut(hands,gesture);
 });
}
