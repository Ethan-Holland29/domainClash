/**
 * Selective character artwork for effects intentionally kept as image layers.
 * Most move effects are drawn procedurally in CharacterEffects.
 *
 * Image entries are keyed by the slot key from TECHNIQUE_SLOTS and retain
 * source attribution. Slots without images use their procedural animation.
 *
 * Actual manga/anime source pixels only. No AI-generated art.
 */

/** How an image moves on screen. All motions are centred on the combat area. */
export type ArtMotion =
  /** Starts small at screen centre and rushes toward the viewer (Red, Purple, Piercing Blood, Granite Blast). */
  | 'approach'
  /** Wiped across the screen along `angle` (slashes, blades). */
  | 'slash'
  /** Rises into view and holds (summoned creatures: Nue, Divine Dogs, Mahoraga, Rika, curses). */
  | 'summon'
  /** Punches in with a flash (strikes, Black Flash, bursts). */
  | 'impact'
  /** Fills the combat area as the domain's environment (cover-fit around the focal point). */
  | 'domain';

export interface ArtSource {
  /** What the image shows. */
  title: string;
  /** Where the file came from (e.g. "Supplied by the user in domainClash-domainclash-progress (2).zip"). */
  origin: string;
  /** True when the user provided the file; false for sourced manga/anime excerpts. */
  supplied: boolean;
  notes?: string;
}

export interface ArtEntry {
  /** URL of the image (files in public/ are served from the site root). */
  src: string;
  motion: ArtMotion;
  /** Crop inside the image, as fractions of its width/height (default: whole image). */
  crop?: { x: number; y: number; w: number; h: number };
  /** Point of interest inside the crop (fractions); kept centred / in view. Default centre. */
  focal?: { x: number; y: number };
  /**
   * How the image combines with the camera. 'screen' drops dark backgrounds,
   * 'multiply' drops white ones; 'source-over' for cutouts with transparency.
   */
  blend?: GlobalCompositeOperation;
  /** Soft edge (0..0.5 of the crop) to hide rectangular borders of non-cutout images. */
  feather?: number;
  /**
   * Fade out hard edges where the source image itself was cut off
   * (fractions of the crop per side, e.g. { right: 0.12 }).
   */
  edgeFade?: { left?: number; right?: number; top?: number; bottom?: number };
  /** Size relative to the combat area's height (summon/impact/approach) or width (slash). */
  size?: number;
  /** Slash direction in degrees. */
  angle?: number;
  /** Extra copies side by side (e.g. two Divine Dogs), mirrored alternately. */
  copies?: number;
  source: ArtSource;
}

export interface TechniqueSlot {
  /** Manifest key: effect action, or `character:action` when two characters share an action. */
  key: string;
  character: string;
  name: string;
  /** Motion the slot calls for. */
  motion: ArtMotion;
}

/** Every technique effect the game plays, for all nine characters. */
export const TECHNIQUE_SLOTS: TechniqueSlot[] = [
  {key:'BLOCK',character:'yuji',name:'Block',motion:'impact'},
  { key: 'BASIC_PUNCH', character: 'yuji', name: 'Shared basic strike', motion: 'impact' },
  { key: 'AMPLIFICATION_BLUE', character: 'gojo', name: 'Lapse: Blue', motion: 'approach' },
  { key: 'REVERSAL_RED', character: 'gojo', name: 'Reversal: Red', motion: 'approach' },
  { key: 'HOLLOW_PURPLE', character: 'gojo', name: 'Hollow Purple', motion: 'approach' },
  { key: 'GOJO_ULTIMATE', character: 'gojo', name: 'Unlimited Void (domain)', motion: 'domain' },
  { key: 'DIVINE_DOGS', character: 'megumi', name: 'Divine Dogs', motion: 'summon' },
  { key: 'NUE', character: 'megumi', name: 'Nue', motion: 'summon' },
  { key: 'MAHORAGA', character: 'megumi', name: 'Mahoraga', motion: 'summon' },
  { key: 'MEGUMI_ULTIMATE', character: 'megumi', name: 'Chimera Shadow Garden (domain)', motion: 'domain' },
  { key: 'CLEAVE', character: 'sukuna', name: 'Cleave', motion: 'slash' },
  { key: 'DISMANTLE', character: 'sukuna', name: 'Dismantle', motion: 'slash' },
  { key: 'SUKUNA_ULTIMATE', character: 'sukuna', name: 'Malevolent Shrine (domain)', motion: 'domain' },
  { key: 'PIERCING_BLOOD', character: 'choso', name: 'Piercing Blood', motion: 'approach' },
  { key: 'CHOSO_ULTIMATE', character: 'choso', name: 'Supernova', motion: 'impact' },
  { key: 'GRANITE_BLAST', character: 'ryu', name: 'Granite Blast', motion: 'approach' },
  { key: 'RYU_ULTIMATE', character: 'ryu', name: 'Way Too Sweet! (energy impact cue)', motion: 'impact' },
  { key: 'yuji:BASIC_PUNCH', character: 'yuji', name: 'Divergent Fist', motion: 'impact' },
  { key: 'BLACK_FLASH', character: 'yuji', name: 'Black Flash', motion: 'impact' },
  { key: 'YUJI_ULTIMATE', character: 'yuji', name: 'Straight Hands (strike impact cue)', motion: 'impact' },
  { key: 'toji:CURSED_TOOLS', character: 'toji', name: 'Cursed tools (Inverted Spear / Split Soul Katana)', motion: 'slash' },
  { key: 'CURSE_SWARM', character: 'geto', name: 'Cursed Spirit Manipulation', motion: 'summon' },
  { key: 'CURSE_SWALLOW', character: 'geto', name: 'Curse Swallow', motion: 'summon' },
  { key: 'GETO_ULTIMATE', character: 'geto', name: 'Uzumaki', motion: 'approach' },
  { key: 'yuta:CURSED_TOOLS', character: 'yuta', name: 'Katana', motion: 'slash' },
  { key: 'RIKA', character: 'yuta', name: 'Rika', motion: 'summon' },
  { key: 'YUTA_ULTIMATE', character: 'yuta', name: 'Rika (copied technique)', motion: 'summon' },
  { key: 'MUTUAL_LOVE', character: 'yuta', name: 'Authentic Mutual Love (domain)', motion: 'domain' },
  { key: 'choso:BASIC_PUNCH', character: 'choso', name: 'Basic strike', motion: 'impact' },
  { key: 'ryu:BASIC_PUNCH', character: 'ryu', name: 'Basic strike', motion: 'impact' },
];

/** Character artwork retained for the requested exceptions; move effects are drawn procedurally. */
export const TECHNIQUE_ART: Record<string, ArtEntry> = {
  "DIVINE_DOGS": {"src": "/art/techniques/dogs.webp", "motion": "summon", "size": 0.95, "source": {"title": "dogs \u2014 Jujutsu Kaisen technique crop", "origin": "https://a.storyblok.com/f/178900/1920x1080/0d77568cd6/jujutsu-kaisen-e55-megumi.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}},
  "NUE": {"src": "/art/techniques/nue.webp", "motion": "summon", "size": 0.95, "source": {"title": "nue \u2014 Jujutsu Kaisen technique crop", "origin": "https://pbs.twimg.com/media/EqEwnvvVQAAzb3L.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}},
  "SUKUNA_ULTIMATE": {"src": "/art/techniques/shrine.webp", "motion": "domain", "size": 0.85, "source": {"title": "shrine \u2014 Jujutsu Kaisen technique crop", "origin": "https://m.media-amazon.com/images/M/MV5BYTY2YTc4YjEtYmMwNi00MzY4LThjMjctMzRhNGYwNTlmYzM5XkEyXkFqcGc%40._V1_.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}},
  "RIKA": {"src": "/art/techniques/rika.webp", "motion": "summon", "size": 0.95, "source": {"title": "rika \u2014 Jujutsu Kaisen technique crop", "origin": "https://s.cinemacafe.net/imgs/p/HYddfX70X05nh6LzkP_ZwgIDWA8ODQwLCgkI/537806.jpg?zoom=spacing", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}},
  MAHORAGA: {src:"/art/characters/mahoraga.png",motion:"summon",size:.95,edgeFade:{right:.14,bottom:.1},source:{title:"Mahoraga supplied cutout",origin:"Existing project artwork",supplied:true}},
};

/** Manifest key for a cue: character-specific first, then the action. */
export function artKey(character: string, action: string): string {
  const specific = `${character}:${action}`;
  return TECHNIQUE_ART[specific] || TECHNIQUE_SLOTS.some((s) => s.key === specific) ? specific : action;
}

/** Slots rendered procedurally rather than with a still image. */
export function missingTechniqueArt(): TechniqueSlot[] {
  return TECHNIQUE_SLOTS.filter((s) => !TECHNIQUE_ART[s.key]);
}
