import { AbilityId } from '../combat/AbilityTypes';
import { MoveById } from '../combat/MoveCatalog';
import type { Cast } from './TechniqueEffects';
import { glow,ring,electric,clamp } from './VfxPrimitives';
export function drawRegular(c:CanvasRenderingContext2D,cast:Cast,w:number,h:number):void{
 if(cast.age>=.5)return;
 const {origin:p,direction:d}=cast.anchor,t=cast.age/.5,fade=1-clamp(t),color=MoveById[cast.id].color;
 c.save();c.globalAlpha=fade;
 if(cast.id===AbilityId.LAPSE_BLUE){
  glow(c,p,100*(1-t)+20,color,.9);for(let i=0;i<9;i++){const a=i*.7+t*8,r=120*(1-t);electric(c,{x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r},p,i,color,1,6);}ring(c,p,130*(1-t)+3,color,.8,.45,t*4);
 }else if(cast.id===AbilityId.REVERSAL_RED){
  glow(c,p,35+100*t,color,1);for(let i=0;i<3;i++)ring(c,p,Math.max(1,220*t-i*20),color,.8,.7,t*.2);
 }else if(cast.id===AbilityId.HOLLOW_PURPLE){
  const q={x:p.x+d.x*Math.hypot(w,h)*t,y:p.y+d.y*Math.hypot(w,h)*t};electric(c,p,q,cast.seed,'#c5a4ff',8,5);glow(c,q,65,color,1);glow(c,{x:q.x-10,y:q.y},30,'#ff4869',.8);glow(c,{x:q.x+10,y:q.y},30,'#428bff',.8);
 }else{
  glow(c,p,80,color,.8);for(let i=0;i<10;i++){const a=i*Math.PI/5;electric(c,p,{x:p.x+Math.cos(a)*(40+t*140),y:p.y+Math.sin(a)*(40+t*140)},i,'#ff2559',3,24);}c.fillStyle='#050008';c.beginPath();c.arc(p.x,p.y,20*(1-t),0,Math.PI*2);c.fill();
 }c.restore();
}
