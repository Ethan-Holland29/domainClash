import { AbilityId } from '../combat/AbilityTypes';
import { GameConfig } from '../config/GameConfig';
import type { CombatManager } from '../combat/CombatManager';
import type { Anchor, Point } from './CameraProjection';
import { clamp, electric, glow, noise, ring } from './VfxPrimitives';

export interface Cast { id: AbilityId; age: number; anchor: Anchor; seed: number }

export function drawCleave(ctx: CanvasRenderingContext2D, cast: Cast, w: number, h: number): void {
  const { origin: p, direction: d, scale } = cast.anchor;
  const base = Math.atan2(d.y, d.x), reach = Math.min(w,h) * .85;
  // Several tapered, traveling blades are born at the palm, not at a fixed screen point.
  for (let i = 0; i < 4; i++) {
    const t = cast.age - i * .038;
    if (t < 0 || t > .8) continue;
    const travel = clamp(t / .22), fade = Math.pow(1 - clamp((t - .17) / .63), 1.4);
    const angle = base + (i - 1.5) * .22;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(angle); ctx.globalAlpha = fade;
    const end = reach * travel, width = (14 + scale * .12) * Math.sin(clamp(t / .65) * Math.PI);
    const g = ctx.createLinearGradient(0,0,end || 1,0);
    g.addColorStop(0,'#85fff000'); g.addColorStop(.18,'#b5fff580'); g.addColorStop(.65,'#eaffff'); g.addColorStop(1,'#ffffff');
    ctx.shadowColor = '#87fff1'; ctx.shadowBlur = 28; ctx.fillStyle = g;
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(end * .48, -width * 3, end, -width * 1.8);
    ctx.quadraticCurveTo(end * .53, width, 0,0); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#061a20'; ctx.lineWidth = 2;
    ctx.globalCompositeOperation = 'source-over'; ctx.beginPath(); ctx.moveTo(end*.16,0); ctx.quadraticCurveTo(end*.6,-width*1.2,end,-width*1.8); ctx.stroke();
    ctx.restore();
    if (t < .3) electric(ctx,p,{x:p.x+Math.cos(angle)*end,y:p.y+Math.sin(angle)*end},cast.seed+i,'#94fff1',1,18);
  }
  glow(ctx,p,scale * (1.6 + cast.age), '#79fff0', clamp(1-cast.age*2));
  ring(ctx,p,scale + cast.age * 230,'#b5fff2',clamp(1-cast.age*2),.45,base);
}

export function drawBlood(ctx: CanvasRenderingContext2D, cast: Cast, w: number, h: number): void {
  const { origin: p, direction: d, scale } = cast.anchor;
  const windup = GameConfig.combat.secondary.windupMs / 1000;
  const charge = clamp(cast.age / windup), firing = cast.age >= windup;
  const fade = firing ? clamp((1.5 - cast.age) / .5) : 1;
  const radius = Math.min(45, scale * .4) * (.4 + charge * .6);
  const spin = cast.age * 9;
  ctx.save(); ctx.globalAlpha = fade;
  glow(ctx,p,radius * 5,'#fb123b',.5 + charge * .5);
  // Convergence: dark liquid ribbons spiral into a dense red core.
  for (let i=0;i<7;i++) {
    const a = i * Math.PI * 2 / 7 + spin;
    const r = radius * (2.7 - charge);
    const from = {x:p.x+Math.cos(a)*r*1.9,y:p.y+Math.sin(a)*r};
    ctx.strokeStyle = i%2 ? '#930824' : '#ff4563'; ctx.lineWidth = 2 + i%3;
    ctx.shadowColor = '#ff1038'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(from.x,from.y);
    ctx.bezierCurveTo(p.x+Math.sin(a)*r,p.y-Math.cos(a)*r,p.x-radius,p.y+radius,p.x,p.y); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  const core = ctx.createRadialGradient(p.x-radius*.25,p.y-radius*.3,1,p.x,p.y,radius);
  core.addColorStop(0,'#ffe9eb'); core.addColorStop(.2,'#ff4762'); core.addColorStop(.55,'#9e0023'); core.addColorStop(1,'#25000b');
  ctx.fillStyle=core; ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2); ctx.fill();
  ring(ctx,p,radius*1.7,'#ff3552',.75,.33,spin);
  ring(ctx,p,radius*2.2,'#ff2846',.4,.55,-spin*.4);
  if (firing) {
    const t = cast.age-windup, length=Math.hypot(w,h)*1.2*clamp(t/.09);
    const angle=Math.atan2(d.y,d.x), thickness=9+Math.sin(t*55)*2;
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(angle); ctx.globalCompositeOperation='lighter';
    const layers: [number,string,number][] = [[60,'#9b0525',.13],[30,'#ed0732',.28],[13,'#ff153d',.85],[4,'#fff5ef',1]];
    for(const [size,color,alpha] of layers) {
      ctx.globalAlpha=fade*alpha; ctx.fillStyle=color;
      ctx.beginPath(); ctx.moveTo(0,-size*.2); ctx.lineTo(length,-size*.1);
      ctx.lineTo(length,size*.1); ctx.lineTo(0,size*.2+thickness*.25); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha=fade*.8; ctx.lineWidth=2;
    for(let ribbon=0;ribbon<3;ribbon++) {
      ctx.strokeStyle=ribbon===0?'#ffffff':'#ff2357'; ctx.beginPath();
      for(let i=0;i<=60;i++) {const x=length*i/60, y=Math.sin(i*.65-t*28+ribbon*2)*thickness*(1-i/90); if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}
      ctx.stroke();
    }
    ctx.restore();
    for(let i=0;i<5;i++) {
      const distance=((t*650+i*170)%900);
      const center={x:p.x+d.x*distance,y:p.y+d.y*distance};
      ring(ctx,center,28+distance*.065,'#ff244b',fade*.5,.25,angle);
    }
    glow(ctx,p,scale*2.8,'#ff244b',fade);
  }
  ctx.restore();
}

export function drawDomain(ctx: CanvasRenderingContext2D, combat: CombatManager, origin: Point, time: number, w: number, h: number): void {
  if (!combat.domain.isBusy && !combat.domain.isActive) return;
  const entering = combat.domain.isBusy;
  const progress=entering?clamp(1-combat.domain.cinematicRemainingMs/GameConfig.domain.cinematicMs):1;
  const strength=entering?progress:Math.min(1,combat.domain.remainingMs/900);
  const radius=Math.hypot(w,h)*Math.pow(progress,2);
  // A hollow wave expands from the actual joined hands; camera remains visible inside.
  if(entering) {
    const g=ctx.createRadialGradient(origin.x,origin.y,Math.max(0,radius*.63),origin.x,origin.y,Math.max(1,radius));
    g.addColorStop(0,'#06071300');g.addColorStop(.65,'#03040be8');g.addColorStop(.92,'#38115bae');g.addColorStop(1,'#50d4d600');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    ring(ctx,origin,Math.max(1,radius*.9),'#73cec5',.6*(1-progress));
    glow(ctx,origin,90*(1-progress)+10,'#7148ba',1-progress);
  }
  ctx.save();ctx.globalAlpha=strength;
  const vignette=ctx.createRadialGradient(w*.5,h*.4,h*.12,w*.5,h*.5,Math.max(w,h)*.7);
  vignette.addColorStop(0,'#02010d00');vignette.addColorStop(.55,'#16072d40');vignette.addColorStop(1,'#010107f5');
  ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  const poolY=h*(1-.19*strength);
  // Layered oily surface with colored edge reflections and constantly shifting contours.
  for(let layer=0;layer<4;layer++) {
    ctx.beginPath();ctx.moveTo(0,h);
    for(let x=0;x<=w+20;x+=20) {
      const y=poolY+layer*14+Math.sin(x*.012+time*(.8+layer*.15))*14+Math.sin(x*.029-time*.7)*7;
      ctx.lineTo(x,y);
    }
    ctx.lineTo(w,h);ctx.closePath();
    ctx.fillStyle=['#0c172bcc','#130924dd','#02040bea','#010106'][layer];ctx.fill();
    ctx.strokeStyle=layer===0?'#4a928780':'#432e6850';ctx.lineWidth=1.5;ctx.stroke();
  }
  // Ink tendrils emerge around the frame rather than replacing the person with an avatar.
  for(let i=0;i<15;i++) {
    const side=i%2===0?-1:1, x=side<0?w*(.03+noise(i)*.16):w*(.81+noise(i)*.16);
    const height=h*(.15+noise(i+40)*.48)*strength, sway=Math.sin(time*1.2+i*2)*35;
    ctx.beginPath();ctx.moveTo(x-18,h);
    ctx.bezierCurveTo(x+side*75,h-height*.3,x-sway,h-height*.9,x+side*20+sway,h-height);
    ctx.bezierCurveTo(x-sway+15,h-height*.7,x+side*75+18,h-height*.3,x+18,h);ctx.closePath();
    ctx.fillStyle='#03030bf0';ctx.shadowBlur=12;ctx.shadowColor='#68458a';ctx.fill();
    ctx.strokeStyle='#5d4a7945';ctx.lineWidth=1;ctx.stroke();
  }
  ctx.shadowBlur=0;
  for(let i=0;i<9;i++) {
    const p={x:w*noise(i+71),y:poolY+30+noise(i+31)*70};
    ring(ctx,p,12+((time*14+i*19)%70),'#647d9d',.18,.14);
  }
  ctx.restore();
}
