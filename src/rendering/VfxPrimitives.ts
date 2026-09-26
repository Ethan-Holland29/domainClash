import type { Point } from './CameraProjection';
export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const noise = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

export function glow(ctx: CanvasRenderingContext2D, p: Point, radius: number, color: string, alpha = 1): void {
  if (radius <= 0 || alpha <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.07, color); g.addColorStop(.3, color + '90'); g.addColorStop(1, color + '00');
  ctx.fillStyle = g; ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2); ctx.restore();
}

export function electric(ctx: CanvasRenderingContext2D, a: Point, b: Point, seed: number, color: string, width: number, jagged = 12): void {
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
  const points: Point[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, offset = (noise(seed + i * 13) - .5) * jagged * Math.sin(t * Math.PI);
    points.push({ x: a.x + dx * t - dy / length * offset, y: a.y + dy * t + dx / length * offset });
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const [thickness, alpha, ink] of [[width * 9, .06, color], [width * 3, .3, color], [width, 1, '#fff4f6']] as const) {
    ctx.strokeStyle = ink; ctx.lineWidth = thickness; ctx.globalAlpha = alpha;
    ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.stroke();
  }
  ctx.restore();
}

export function ring(ctx: CanvasRenderingContext2D, p: Point, radius: number, color: string, alpha: number, tilt = 1, rotation = 0): void {
  if (radius <= 0) return;
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(rotation); ctx.scale(1,tilt);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(alpha);
  ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 15; ctx.lineWidth = 1.7;
  ctx.beginPath(); ctx.arc(0,0,radius,0,Math.PI * 2); ctx.stroke(); ctx.restore();
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
export class Sparks {
  private particles: Particle[] = [];
  clear(): void { this.particles = []; }
  burst(p: Point, color: string, count: number, speed = 280): void {
    for (let i=0;i<count;i++) {
      const a = Math.random() * Math.PI * 2, velocity = speed * (.2 + Math.random());
      const life = .25 + Math.random() * .8;
      this.particles.push({ ...p, vx: Math.cos(a) * velocity, vy: Math.sin(a) * velocity, life, max: life, color, size: 1 + Math.random() * 2.2 });
    }
    if (this.particles.length > 450) this.particles.splice(0, this.particles.length - 450);
  }
  draw(ctx: CanvasRenderingContext2D, dt: number): void {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    this.particles = this.particles.filter(p => {
      p.life -= dt; if (p.life <= 0) return false;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-dt * 1.8); p.vy += dt * 45;
      ctx.globalAlpha = p.life / p.max; ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); ctx.stroke(); return true;
    }); ctx.restore();
  }
}
