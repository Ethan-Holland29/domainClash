import { TECHNIQUE_ART, type ArtEntry } from './TechniqueArtManifest';

/** Longest side of a prepared sprite; larger sources are downscaled once. */
const MAX_SPRITE_SIDE = 1600;

export interface PreparedArt {
  entry: ArtEntry;
  /** Cropped, feathered, downscaled image, ready to draw many times. */
  sprite: HTMLCanvasElement;
  width: number;
  height: number;
}

type State = { status: 'loading' } | { status: 'ready'; art: PreparedArt } | { status: 'failed'; error: string };

/**
 * Loads each technique image once, prepares it (crop, soft edge, downscale)
 * and caches the result, shared by every effects layer. Nothing is fetched
 * until an ability (or its character) needs it.
 */
export class TechniqueArtLibrary {
  private readonly states = new Map<string, State>();

  /** Starts loading the art for a manifest key (no-op if unknown or already requested). */
  request(key: string): void {
    const entry = TECHNIQUE_ART[key];
    if (!entry || this.states.has(key)) return;
    this.states.set(key, { status: 'loading' });
    void load(entry).then(
      (art) => this.states.set(key, { status: 'ready', art }),
      (err: unknown) => {
        this.states.set(key, { status: 'failed', error: String(err) });
        console.warn(`Technique art for ${key} could not load (${entry.src}); no substitute effect is shown.`, err);
      },
    );
  }

  /** Prepared art if loaded, else null (the caller falls back and should call request()). */
  get(key: string): PreparedArt | null {
    const state = this.states.get(key);
    return state?.status === 'ready' ? state.art : null;
  }

  /** Short status for the debug panel. */
  summary(): string {
    const ready = [...this.states.values()].filter((s) => s.status === 'ready').length;
    const failed = [...this.states.entries()].filter(([, s]) => s.status === 'failed').map(([k]) => k);
    return `art ${ready}/${Object.keys(TECHNIQUE_ART).length} loaded${failed.length ? ` · failed: ${failed.join(', ')}` : ''}`;
  }
}

/** One library for the whole page, so both camera panes share the cache. */
export const techniqueArt = new TechniqueArtLibrary();

async function load(entry: ArtEntry): Promise<PreparedArt> {
  const img = new Image();
  img.decoding = 'async';
  img.src = entry.src;
  await img.decode();
  const crop = entry.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = crop.x * img.naturalWidth;
  const sy = crop.y * img.naturalHeight;
  const sw = crop.w * img.naturalWidth;
  const sh = crop.h * img.naturalHeight;
  const scale = Math.min(1, MAX_SPRITE_SIDE / Math.max(sw, sh));
  const sprite = document.createElement('canvas');
  sprite.width = Math.max(1, Math.round(sw * scale));
  sprite.height = Math.max(1, Math.round(sh * scale));
  const c = sprite.getContext('2d')!;
  c.drawImage(img, sx, sy, sw, sh, 0, 0, sprite.width, sprite.height);
  if (entry.feather && entry.feather > 0) {
    // Soft elliptical edge: hides the rectangular border of non-cutout images.
    const f = Math.min(0.5, entry.feather);
    const w = sprite.width;
    c.globalCompositeOperation = 'destination-in';
    c.save();
    // Draw a circle in a square w x w space, squashed to the sprite's height -> an ellipse.
    c.scale(1, sprite.height / w);
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, '#000');
    g.addColorStop(1 - f, '#000');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
    c.restore();
  }
  if (entry.edgeFade) fadeEdges(c, sprite.width, sprite.height, entry.edgeFade);
  return { entry, sprite, width: sprite.width, height: sprite.height };
}

/** Linear fade-out toward the given edges (softens places where the source image is cut off). */
function fadeEdges(c: CanvasRenderingContext2D, w: number, h: number, f: NonNullable<ArtEntry['edgeFade']>): void {
  c.save();
  c.globalCompositeOperation = 'destination-out';
  const side = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = g;
    c.fillRect(rx, ry, rw, rh);
  };
  if (f.right) side(w * (1 - f.right), 0, w, 0, w * (1 - f.right), 0, w * f.right, h);
  if (f.left) side(w * f.left, 0, 0, 0, 0, 0, w * f.left, h);
  if (f.bottom) side(0, h * (1 - f.bottom), 0, h, 0, h * (1 - f.bottom), w, h * f.bottom);
  if (f.top) side(0, h * f.top, 0, 0, 0, 0, w, h * f.top);
  c.restore();
}
