import type { ArtMotion } from './TechniqueArtManifest';

/** Pure layout / motion math for technique art (no DOM, so it is unit-tested). */

export interface Size {
  w: number;
  h: number;
}
export interface Rect extends Size {
  x: number;
  y: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Largest size that fits inside the box without changing the image's proportions. */
export function containSize(img: Size, box: Size): Size {
  const s = Math.min(box.w / img.w, box.h / img.h);
  return { w: img.w * s, h: img.h * s };
}

/**
 * Cover-fit (fills the whole view, proportions kept) that keeps the focal point
 * as close to the view centre as possible without ever leaving empty edges.
 */
export function coverWithFocal(img: Size, view: Size, focal = { x: 0.5, y: 0.5 }, zoom = 1): Rect {
  const s = Math.max(view.w / img.w, view.h / img.h) * zoom;
  const w = img.w * s;
  const h = img.h * s;
  const x = Math.min(0, Math.max(view.w - w, view.w / 2 - focal.x * w));
  const y = Math.min(0, Math.max(view.h - h, view.h / 2 - focal.y * h));
  return { x, y, w, h };
}

export interface MotionFrame {
  /** Scale relative to the base (fitted) size. */
  scale: number;
  alpha: number;
  /** Offset from the combat-area centre, as fractions of the area's height. */
  dx: number;
  dy: number;
  /** Fraction of a slash revealed (1 = fully drawn). */
  reveal: number;
  /** Brightness flash to add on top (0..1). */
  flash: number;
  /** Depth echoes behind the main image: [scale factor, alpha factor] pairs. */
  echoes: [number, number][];
}

/**
 * Where/how big/how visible an image is at progress p (0..1) of its effect.
 * Every motion stays centred (dx/dy only for rise/slide offsets), so effects
 * never launch from the player's hand.
 */
export function motionFrame(motion: ArtMotion, p: number, reducedMotion = false): MotionFrame {
  p = clamp01(p);
  const fadeOut = (from: number) => clamp01((1 - p) / (1 - from));
  const base: MotionFrame = { scale: 1, alpha: 1, dx: 0, dy: 0, reveal: 1, flash: 0, echoes: [] };
  switch (motion) {
    case 'approach': {
      // Gathers at the centre, then rushes toward the viewer, growing with depth.
      const charge = clamp01(p / 0.3);
      const rush = clamp01((p - 0.3) / 0.62);
      const scale = reducedMotion ? 0.4 + 0.6 * charge : 0.12 + 0.2 * charge + 2.1 * rush * rush;
      return {
        ...base,
        scale,
        alpha: clamp01(p / 0.08) * fadeOut(0.86),
        echoes: rush > 0 && !reducedMotion ? [[0.72, 0.35], [0.5, 0.18]] : [],
      };
    }
    case 'slash': {
      const reveal = clamp01(p / 0.32);
      return { ...base, reveal, scale: 1 + 0.06 * p, alpha: fadeOut(0.72), dx: reducedMotion ? 0 : -0.04 + 0.08 * reveal };
    }
    case 'summon': {
      const rise = 1 - (1 - clamp01(p / 0.3)) ** 3;
      const bob = reducedMotion ? 0 : Math.sin(p * Math.PI * 3) * 0.01;
      return {
        ...base,
        scale: 0.86 + 0.14 * rise,
        alpha: clamp01(p / 0.2) * fadeOut(0.82),
        dy: (reducedMotion ? 0 : 0.35 * (1 - rise)) + bob,
      };
    }
    case 'impact': {
      const hit = clamp01(p / 0.14);
      return {
        ...base,
        scale: reducedMotion ? 1 : 1.45 - 0.45 * hit,
        alpha: clamp01(p / 0.05) * fadeOut(0.7),
        flash: p < 0.22 ? 1 - p / 0.22 : 0,
        echoes: !reducedMotion && p < 0.3 ? [[1.25, 0.25]] : [],
      };
    }
    case 'domain':
      // Domains are drawn as the backdrop by the effects layer (coverWithFocal + slow push-in).
      return { ...base, scale: 1 + 0.08 * p };
  }
}

/** Default size of each motion, relative to the combat area (height; width for slash). */
export const DEFAULT_ART_SIZE: Record<ArtMotion, number> = {
  approach: 0.62,
  slash: 0.95,
  summon: 0.9,
  impact: 0.7,
  domain: 1,
};
