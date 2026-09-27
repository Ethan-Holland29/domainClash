import { AbilityId } from '../combat/AbilityTypes';
import { MoveById } from '../combat/MoveCatalog';
import type { CombatManager } from '../combat/CombatManager';
import type { Point } from './CameraProjection';
import { clamp, electric, glow, noise, ring } from './VfxPrimitives';

/** Procedural environments grow from the captured hand position. Center remains transparent. */
export function drawExpandedDomain(c:CanvasRenderingContext2D,combat:CombatManager,p:Point,t:number,w:number,h:number):void {
 const d=combat.domain;if(!d.isActive&&!d.isBusy)return;
 const id=d.abilityId,m=MoveById[id],progress=d.isBusy?clamp(1-d.cinematicRemainingMs/2400):1;
 const alpha=d.isBusy?progress:Math.min(1,d.remainingMs/900);
 c.save();
 if(d.isBusy){const r=Math.max(1,Math.hypot(w,h)*progress*progress);ring(c,p,r,m.color,1-progress,.8,t*.2);glow(c,p,100*(1-progress)+15,m.color,1-progress);}
 // A circular reveal expands out of the hand anchor before the environment settles.
 c.beginPath();c.arc(p.x,p.y,Math.max(1,Math.hypot(w,h)*progress),0,Math.PI*2);c.clip();c.globalAlpha=alpha;
 const edge=c.createRadialGradient(w/2,h*.43,h*.15,w/2,h*.5,Math.max(w,h)*.68);
 edge.addColorStop(0,'#00000000');edge.addColorStop(.55,m.color+'12');edge.addColorStop(1,m.color+'65');c.fillStyle=edge;c.fillRect(0,0,w,h);
 c.strokeStyle=m.color;c.fillStyle=m.color;c.shadowColor=m.color;
 switch(id){
 case AbilityId.MALEVOLENT_SHRINE: {
   const x=w*.5,y=h*.91,s=Math.min(w*.38,h*.6);
   c.fillStyle='#1e080be0';c.strokeStyle='#ff8970';c.lineWidth=2;
   for(let k=0;k<3;k++){const yy=y-k*s*.25,ww=s*(1-k*.19);c.beginPath();c.moveTo(x-ww,yy);c.quadraticCurveTo(x-ww*.6,yy-s*.06,x,yy-s*.3);c.quadraticCurveTo(x+ww*.6,yy-s*.06,x+ww,yy);c.lineTo(x+ww*.65,yy+s*.07);c.lineTo(x-ww*.65,yy+s*.07);c.closePath();c.fill();c.stroke();}
   for(const side of [-1,1]){c.fillStyle='#361019';c.fillRect(x+side*s*.55-7,y-s*.45,14,s*.45);}
   for(let i=0;i<10;i++){const phase=(t*1.5+i*.23)%2;const a={x:noise(i+2)*w,y:noise(i+9)*h};const b={x:a.x+w*.35,y:a.y-h*.35};c.globalAlpha=alpha*Math.max(0,1-phase);electric(c,a,b,i,m.color,1,2);}break;
 }
 case AbilityId.UNLIMITED_VOID: {
   const q={x:w*.5,y:h*.12};glow(c,q,h*.55,'#547aff',.45);c.fillStyle='#02040c';c.beginPath();c.ellipse(q.x,q.y,h*.14,h*.1,0,0,Math.PI*2);c.fill();
   for(let k=0;k<5;k++)ring(c,q,h*(.15+k*.025),'#c5eaff',.5,.36,t*.08+k*.25);
   for(let i=0;i<100;i++){const x=noise(i*3)*w,y=noise(i*3+1)*h;const len=3+((t*30+i*7)%35);c.globalAlpha=alpha*(.2+noise(i+8)*.6);c.fillStyle=i%3?'#afdfff':'#fff';c.fillRect(x,y,1.2,len);}
   break;
 }
 case AbilityId.IRON_MOUNTAIN: {
   const lava=c.createLinearGradient(0,h*.68,0,h);lava.addColorStop(0,'#ff350000');lava.addColorStop(1,'#ff4b00bf');c.fillStyle=lava;c.fillRect(0,h*.65,w,h*.35);
   for(let i=0;i<19;i++){const x=noise(i+20)*w,y=h-((t*35+i*51)%(h*.85)),r=9+noise(i)*25;c.fillStyle='#251511';c.strokeStyle='#ff812c';c.shadowBlur=14;c.beginPath();for(let k=0;k<6;k++){const a=k*Math.PI/3;const xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r;k?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.closePath();c.fill();c.stroke();}
   for(let i=0;i<9;i++)electric(c,{x:i*w/8,y:h},{x:i*w/8+Math.sin(i)*55,y:h*.76},i,'#ff9c28',2,20);break;
 }
 case AbilityId.SELF_EMBODIMENT: {
   // Linked palm silhouettes with individually articulated fingers surround the viewer.
   for(let i=0;i<16;i++){const a=i*Math.PI/8+t*.025,x=w*.5+Math.cos(a)*w*.49,y=h*.5+Math.sin(a)*h*.47;c.save();c.translate(x,y);c.rotate(a+Math.PI/2);c.fillStyle='#251731c9';c.strokeStyle='#d6afe8';c.lineWidth=2;c.shadowBlur=9;c.beginPath();c.ellipse(0,0,15,23,0,0,Math.PI*2);c.fill();c.stroke();for(let f=0;f<5;f++){c.beginPath();c.moveTo((f-2)*7,-12);c.quadraticCurveTo((f-2)*12,-35,(f-2)*9,-48+Math.abs(f-2)*8);c.stroke();}c.restore();}
   for(let i=0;i<9;i++){c.globalAlpha=alpha*.23;ring(c,{x:w/2,y:h/2},Math.min(w,h)*(.25+i*.045),m.color,.5,.6,t*.06+i*.5);}break;
 }
 case AbilityId.MUTUAL_LOVE: {
   for(let i=0;i<25;i++){const x=noise(i+33)*w,y=h*(.73+noise(i)*.27),size=25+noise(i+5)*70;c.save();c.translate(x,y);c.rotate((noise(i+7)-.5)*.5);c.shadowBlur=12;c.fillStyle='#e8d9fa';c.beginPath();c.moveTo(-2,0);c.lineTo(-3,-size);c.lineTo(0,-size-12);c.lineTo(3,-size);c.lineTo(2,0);c.fill();c.fillStyle='#fc789e';c.fillRect(-13,-size*.25,26,4);c.restore();}
   c.strokeStyle='#f9557e';c.lineWidth=3;for(let i=0;i<4;i++){c.beginPath();c.moveTo(0,h*.1+i*12);c.bezierCurveTo(w*.3,h*(.3+Math.sin(t+i)*.04),w*.7,-h*.1,w,h*.2+i*9);c.stroke();}break;
 }
 case AbilityId.CAPTIVATING_SKANDHA: {
   for(let k=0;k<5;k++){c.beginPath();c.moveTo(0,h);for(let x=0;x<=w+15;x+=15)c.lineTo(x,h*.77+k*13+Math.sin(x*.017+t*1.6+k)*10);c.lineTo(w,h);c.closePath();c.fillStyle=['#117e9644','#0bbcca55','#087e9a88','#0b597da0','#033f66cc'][k];c.fill();c.strokeStyle='#a2ffff77';c.stroke();}
   for(let i=0;i<12;i++){const x=((t*55+i*121)%(w+100))-50,y=h*(.8+noise(i)*.18);c.fillStyle='#052e47cc';c.beginPath();c.ellipse(x,y,20,7,Math.sin(i)*.1,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(x-16,y);c.lineTo(x-30,y-10);c.lineTo(x-30,y+10);c.closePath();c.fill();}break;
 }
 case AbilityId.YUJI_DOMAIN: {
   glow(c,{x:w*.85,y:h*.55},h*.28,'#ffa35f',.55);c.fillStyle='#56374199';
   for(let i=0;i<20;i++){const x=i*w/20,hh=25+noise(i)*65;c.fillRect(x,h-hh,w/22,hh);c.fillStyle='#ffce8866';c.fillRect(x+5,h-hh+8,6,9);c.fillStyle='#56374199';}
   c.strokeStyle='#e5b79e';c.lineWidth=2;for(const side of [-1,1]){c.beginPath();c.moveTo(w*.5+side*15,h*.73);c.lineTo(w*.5+side*w*.3,h);c.stroke();}
   for(let i=0;i<7;i++){const y=h*.74+i*i*h*.005;c.beginPath();c.moveTo(w*.5-i*w*.045,y);c.lineTo(w*.5+i*w*.045,y);c.stroke();}
   for(let i=0;i<3;i++){const phase=(t+i*.4)%2;if(phase<.35)electric(c,p,{x:p.x+(i-1)*w*.6,y:0},i,'#ffded0',1,10);}break;
 }
 case AbilityId.WOMB_PROFUSION: {
   for(let side of [-1,1])for(let i=0;i<8;i++){const x=side<0?w*.04:w*.96;const y=h*(.15+i*.1);c.strokeStyle='#9e7a6188';c.lineWidth=8+i;c.beginPath();c.moveTo(side<0?0:w,h);c.bezierCurveTo(x-side*40,h*.5,x+side*40,y,x-side*50,y);c.stroke();c.fillStyle='#c6aa84a0';c.beginPath();c.ellipse(x-side*50,y,15,21,side*.3,0,Math.PI*2);c.fill();c.fillStyle='#19151b';c.fillRect(x-side*50-9,y-4,5,4);c.fillRect(x-side*50+4,y-4,5,4);}
   for(let i=0;i<4;i++)ring(c,p,40+((t*100+i*110)%500),m.color,.25,.6);break;
 }
 case AbilityId.DEATH_GAMBLE: {
   const size=Math.min(75,w*.15),y=h*.75;for(let i=0;i<3;i++){const x=w/2+(i-1)*(size+10);c.fillStyle='#081d24e0';c.strokeStyle='#9dffba';c.lineWidth=3;c.shadowBlur=15;c.fillRect(x-size/2,y,size,size);c.strokeRect(x-size/2,y,size,size);c.fillStyle='#ffd67a';c.font=`900 ${size*.7}px monospace`;c.textAlign='center';c.fillText(d.isActive?'7':String((Math.floor(t*15)+i*3)%10),x,y+size*.76);}
   for(let i=0;i<40;i++){const x=noise(i)*w,y=(t*70+i*31)%h;c.fillStyle=i%2?'#ffd877':'#87ffc5';c.save();c.translate(x,y);c.rotate(t+i);c.fillRect(-2,-5,4,10);c.restore();}break;
 }
 case AbilityId.RYU_DOMAIN: {
   for(let i=0;i<7;i++){const a=i*Math.PI*2/7+t*.04,q={x:p.x+Math.cos(a)*Math.hypot(w,h),y:p.y+Math.sin(a)*Math.hypot(w,h)};c.globalAlpha=alpha*(.15+.12*Math.sin(t*3+i));electric(c,p,q,i,'#e0baff',5,7);}
   c.globalAlpha=alpha;for(let i=0;i<18;i++){const a=i*2.4,r=40+((t*60+i*27)%350),x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;c.fillStyle='#4c405ecc';c.strokeStyle='#d6beeb';c.beginPath();c.moveTo(x,y-12);c.lineTo(x+15,y+4);c.lineTo(x-8,y+14);c.closePath();c.fill();c.stroke();}glow(c,p,70,m.color,.65);break;
 }
 case AbilityId.URO_DOMAIN: {
   for(let i=0;i<12;i++){const x=noise(i+40)*w,y=noise(i+70)*h,r=30+noise(i)*65;c.save();c.translate(x+Math.sin(t+i)*15,y);c.rotate(Math.sin(t*.25+i)*.4);c.fillStyle='#b8eaff0d';c.strokeStyle='#ceefff88';c.lineWidth=1;c.beginPath();c.moveTo(-r,-r*.3);c.lineTo(r*.6,-r);c.lineTo(r,r*.5);c.lineTo(-r*.4,r);c.closePath();c.fill();c.stroke();c.restore();}
   for(let i=0;i<5;i++){c.strokeStyle=i%2?'#ecdfff66':'#9bebff66';c.lineWidth=3;c.beginPath();c.moveTo(0,h*(.1+i*.2));c.bezierCurveTo(w*.3,h*(.5+Math.sin(t*.4+i)*.3),w*.7,h*(.5-Math.sin(t*.4+i)*.3),w,h*(.1+i*.2));c.stroke();}break;
 }
 }
 c.restore();
}
