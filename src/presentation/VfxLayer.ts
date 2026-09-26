export interface Point {
  x: number;
  y: number;
}

/** A fixed point, or a live one (e.g. the player's hand) re-read every frame. */
export type Anchor = Point | (() => Point | null);

function resolve(anchor: Anchor, last: Point): Point {
  if (typeof anchor !== 'function') return anchor;
  return anchor() ?? last;
}

interface Effect {
  /** Advances by dt (ms, already slow-mo scaled); draws; returns false when finished. */
  step(ctx: CanvasRenderingContext2D, dt: number): boolean;
}

/**
 * Canvas effects over the camera view: energy coming out of the player's
 * hands (orbs, charge rings, motes, beams, smoke), slashes across the screen,
 * sparks, shockwaves and flashes. Positions are fractions of the stage (0..1)
 * - the same space as the hand landmarks - so effects sit on the real hands
 * at any window size. Anchors can be live, so effects follow a moving hand.
 * Has its own slow-motion.
 */
export class VfxLayer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private effects: Effect[] = [];
  private last = performance.now();
  private timeScale = 1;
  private slowUntil = 0;

  constructor(stage: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'vfx-layer';
    stage.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    const loop = (now: number) => {
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Effects play at `scale` speed for `ms` of real time (brief slow motion). */
  slowMotion(scale: number, ms: number): void {
    this.timeScale = scale;
    this.slowUntil = performance.now() + ms;
  }

  /** A slash line drawn from `from` to `to` over `ms`, then fading. */
  slash(from: Point, to: Point, color: string, width: number, ms = 140, delay = 0): void {
    let t = -delay;
    const life = ms + 220;
    this.add({
      step: (ctx, dt) => {
        t += dt;
        if (t < 0) return true;
        const grow = Math.min(1, t / ms);
        const fade = t < ms ? 1 : Math.max(0, 1 - (t - ms) / 220);
        const a = this.px(from);
        const b = this.px(to);
        const end = { x: a.x + (b.x - a.x) * grow, y: a.y + (b.y - a.y) * grow };
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.lineCap = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = width * 2;
        ctx.strokeStyle = color;
        ctx.lineWidth = width * this.unit();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = width * 0.35 * this.unit();
        ctx.stroke();
        ctx.restore();
        return t < life;
      },
    });
  }

  /** A ring that tightens around `at` for `ms` (charging a strong attack); follows a live anchor. */
  chargeRing(at: Anchor, color: string, ms: number): void {
    let t = 0;
    let last: Point = { x: 0.5, y: 0.5 };
    this.add({
      step: (ctx, dt) => {
        t += dt;
        const k = Math.min(1, t / ms);
        last = resolve(at, last);
        const p = this.px(last);
        const r = (70 - 45 * k) * this.unit();
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.6 * k;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20 * k;
        ctx.lineWidth = (2 + 5 * k) * this.unit();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return t < ms;
      },
    });
  }

  /** Spark particles bursting out of `at`. */
  sparks(at: Point, color: string, count: number, speed: number): void {
    const parts = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      return { x: 0, y: 0, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 300 + Math.random() * 300 };
    });
    let t = 0;
    this.add({
      step: (ctx, dt) => {
        t += dt;
        const p0 = this.px(at);
        const u = this.unit();
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        let alive = false;
        for (const p of parts) {
          if (t > p.life) continue;
          alive = true;
          p.x += (p.vx * dt) / 1000;
          p.y += (p.vy * dt) / 1000;
          p.vy += (500 * dt) / 1000; // a little gravity
          ctx.globalAlpha = 1 - t / p.life;
          ctx.fillRect(p0.x + p.x * u - 2 * u, p0.y + p.y * u - 2 * u, 4 * u, 4 * u);
        }
        ctx.restore();
        return alive;
      },
    });
  }

  /** An expanding shockwave ring. */
  burst(at: Point, color: string, maxRadius: number, ms = 400): void {
    let t = 0;
    this.add({
      step: (ctx, dt) => {
        t += dt;
        const k = Math.min(1, t / ms);
        const p = this.px(at);
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = color;
        ctx.lineWidth = (10 * (1 - k) + 1) * this.unit();
        ctx.beginPath();
        ctx.arc(p.x, p.y, maxRadius * k * this.unit(), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return t < ms;
      },
    });
  }

  /**
   * A glowing energy sphere on (and following) an anchor, growing over `ms`.
   * `core` is the bright centre colour.
   */
  orb(at: Anchor, color: string, radius: number, ms: number, core = '#fff'): void {
    let t = 0;
    let last: Point = { x: 0.5, y: 0.5 };
    this.add({
      step: (ctx, dt) => {
        t += dt;
        const k = Math.min(1, t / ms);
        last = resolve(at, last);
        const p = this.px(last);
        const u = this.unit();
        const r = radius * u * (0.35 + 0.65 * k) * (1 + 0.08 * Math.sin(t / 45));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, core);
        g.addColorStop(0.12, core);
        g.addColorStop(0.3, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return t < ms;
      },
    });
  }

  /** Small glowing particles drifting up off a point (energy gathering on a hand). */
  motes(at: Point, color: string, count: number, spread = 40): void {
    const parts = Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 30,
      vy: -40 - Math.random() * 60,
      life: 350 + Math.random() * 350,
      size: 2 + Math.random() * 3,
    }));
    let t = 0;
    this.add({
      step: (ctx, dt) => {
        t += dt;
        const p0 = this.px(at);
        const u = this.unit();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        let alive = false;
        for (const p of parts) {
          if (t > p.life) continue;
          alive = true;
          p.x += (p.vx * dt) / 1000;
          p.y += (p.vy * dt) / 1000;
          ctx.globalAlpha = 1 - t / p.life;
          ctx.beginPath();
          ctx.arc(p0.x + p.x * u, p0.y + p.y * u, p.size * u, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return alive;
      },
    });
  }

  /** A thick energy beam from `from` to `to` that flares and fades. */
  beam(from: Point, to: Point, color: string, width: number, ms = 350): void {
    let t = 0;
    this.add({
      step: (ctx, dt) => {
        t += dt;
        const k = Math.min(1, t / ms);
        const a = this.px(from);
        const b = this.px(to);
        const u = this.unit();
        const w = width * u * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = 30;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(0, w);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(0, w * 0.35);
        ctx.stroke();
        ctx.restore();
        return t < ms;
      },
    });
  }

  /** Soft dark puffs expanding from a point (shadows / smoke). */
  smoke(at: Point, color: string, count: number, size = 60, ms = 900): void {
    const puffs = Array.from({ length: count }, () => ({
      dx: (Math.random() - 0.5) * 120,
      dy: (Math.random() - 0.5) * 120,
      r: size * (0.5 + Math.random()),
      delay: Math.random() * 200,
    }));
    let t = 0;
    this.add({
      step: (ctx, dt) => {
        t += dt;
        const p0 = this.px(at);
        const u = this.unit();
        ctx.save();
        for (const p of puffs) {
          const k = Math.min(1, Math.max(0, (t - p.delay) / ms));
          if (k <= 0) continue;
          const x = p0.x + p.dx * u * k;
          const y = p0.y + p.dy * u * k;
          const r = p.r * u * (0.4 + k);
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.7 * (1 - k);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return t < ms + 200;
      },
    });
  }

  /** Three parallel claw marks ripping across the screen (the player getting hit). */
  claws(color: string): void {
    for (let i = 0; i < 3; i++) {
      const o = (i - 1) * 0.07;
      this.slash({ x: 0.62 + o, y: 0.1 }, { x: 0.3 + o, y: 0.9 }, color, 9, 110, i * 40);
    }
  }

  /** Floating text (damage numbers) rising from `at`. */
  floatText(at: Point, text: string, color: string, size = 34, ms = 900): void {
    let t = 0;
    this.add({
      step: (ctx, dt) => {
        t += dt;
        const k = Math.min(1, t / ms);
        const p = this.px(at);
        const u = this.unit();
        ctx.save();
        ctx.globalAlpha = 1 - k * k;
        ctx.font = `800 ${Math.round(size * u * (1 + 0.3 * (1 - k)))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4 * u;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.fillStyle = color;
        const y = p.y - 60 * u * k;
        ctx.strokeText(text, p.x, y);
        ctx.fillText(text, p.x, y);
        ctx.restore();
        return t < ms;
      },
    });
  }

  /** Full-screen colour flash (hit flash / damage flash). */
  flash(color: string, strength: number, ms = 180): void {
    let t = 0;
    this.add({
      step: (ctx, dt) => {
        t += dt;
        ctx.save();
        ctx.globalAlpha = strength * Math.max(0, 1 - t / ms);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
        return t < ms;
      },
    });
  }

  clear(): void {
    this.effects = [];
  }

  private add(effect: Effect): void {
    this.effects.push(effect);
  }

  private frame(now: number): void {
    const realDt = Math.min(50, now - this.last);
    this.last = now;
    if (now > this.slowUntil) this.timeScale = 1;
    this.resize();
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.effects.length === 0) return;
    const dt = realDt * this.timeScale;
    this.effects = this.effects.filter((e) => e.step(ctx, dt));
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private px(p: Point): Point {
    return { x: p.x * this.canvas.width, y: p.y * this.canvas.height };
  }

  /** Size unit that scales with the stage (1 at ~960px wide). */
  private unit(): number {
    return this.canvas.width / 960;
  }
}
