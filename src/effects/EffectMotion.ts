import type {HandOrigin} from './MovePalette';
export const AFTERGLOW_MS = 300;
/** Frame-rate independent smoothing; stale tracking freezes instead of snapping. */
export function followHand(origin:HandOrigin,target:HandOrigin|null,dt:number,fresh:boolean):void {
 if(!target||!fresh)return;
 const blend=1-Math.exp(-Math.min(50,Math.max(0,dt))/65);
 origin.x+=(target.x-origin.x)*blend;origin.y+=(target.y-origin.y)*blend;
}
export function releaseOpacity(progress:number):number {
 return Math.max(0,Math.min(1,progress*18))*Math.min(1,Math.max(0,(1-progress)/.32));
}
