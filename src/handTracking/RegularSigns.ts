import { AbilityId } from '../combat/AbilityTypes';
import { MoveById } from '../combat/MoveCatalog';
import { fingerExtension,dist2d,palmSize } from './HandGeometry';
import type { TrackedHand } from './HandTypes';
import type { GestureEval } from './GestureTypes';
export function evaluateRegularSigns(hands:TrackedHand[]):GestureEval[]{
 const h=hands[0];if(!h)return [];
 const e=[5,9,13,17].map(b=>fingerExtension(h,b+3,b+1,b)),p=h.landmarks;
 const thumb=dist2d(p[4],p[5])/palmSize(h),fist=e.every(v=>v<.38);
 const pairs:[AbilityId,boolean][]=[
 [AbilityId.LAPSE_BLUE,fist&&thumb<.65],
 [AbilityId.BLACK_FLASH,fist&&thumb>=.65],
 [AbilityId.REVERSAL_RED,dist2d(p[4],p[8])/palmSize(h)<.4&&e[1]>.5&&e[2]>.5&&e[3]>.5&&e[0]<.5],
 [AbilityId.HOLLOW_PURPLE,e[0]>.5&&e[3]>.5&&e[1]<.38&&e[2]<.38]];
 return pairs.map(([id,passed])=>({id,displayName:MoveById[id].name,passed,score:passed?.96:0,checks:[{name:MoveById[id].short,passed,value:passed?1:0,detail:'Single-hand shortcut'}]}));
}
