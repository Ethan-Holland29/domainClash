// Geometry used by DomainClash-Kevin's regular signs, kept with the same thresholds.
import type {TrackedHand} from '../handTracking/HandTypes';
type Point = TrackedHand['landmarks'][number];
const sub=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const length=(v:Point)=>Math.hypot(v.x,v.y,v.z);
const distance=(a:Point,b:Point)=>length(sub(a,b));
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export const palmSize=(h:TrackedHand)=>Math.max(distance(h.landmarks[0],h.landmarks[9]),.04);
export function fingerExtension(h:TrackedHand,base:number):number {
 const p=h.landmarks,a=sub(p[base],p[base+1]),b=sub(p[base+3],p[base+1]);
 const dot=a.x*b.x+a.y*b.y+a.z*b.z;
 const angle=Math.acos(Math.max(-1,Math.min(1,dot/(length(a)*length(b)||1))))*180/Math.PI;
 const ratio=(distance(p[base+3],p[0])-distance(p[base+1],p[0]))/Math.max(distance(p[base],p[0]),.001);
 return clamp((ratio+.15)/.7)*.75+clamp((angle-60)/110)*.25;
}
