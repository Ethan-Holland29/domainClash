/**
 * Technique imagery: which image each ability shows, how it is cropped and
 * animated, and where the image came from.
 *
 * TO ADD ART for an ability: put the image in public/art/techniques/ and add
 * an entry to TECHNIQUE_ART keyed by the slot key from TECHNIQUE_SLOTS. Every
 * entry must name its source. Abilities without an entry render no substitute and are listed as missing (debug panel + docs/technique-art-sources.md).
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

/** Cropped original anime frames and manga excerpts, prepared offline. */
export const TECHNIQUE_ART: Record<string, ArtEntry> = {
  BLOCK: {"src": "/art/techniques/block.webp", "motion": "impact", "size": 0.88, "source": {"title": "Crossed-arm guard, Jujutsu Kaisen episode 15", "origin": "https://m.media-amazon.com/images/M/MV5BM2ZkNjU0YjgtNWUzNi00YjgyLTgyNDgtNGEzYzcxNmE0MmIwXkEyXkFqcGc%40._V1_FMjpg_UX1000_.jpg", "supplied": false, "notes": "Cropped defensive forearms; face and background masked out."}},
  "AMPLIFICATION_BLUE": {"src": "/art/techniques/blue.webp", "motion": "approach", "size": 0.85, "source": {"title": "blue \u2014 Jujutsu Kaisen technique crop", "origin": "https://static.deltiasgaming.com/2025/02/gojos-Blue-1536x864.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen"},
  "REVERSAL_RED": {"src": "/art/techniques/red.webp", "motion": "approach", "size": 0.85, "source": {"title": "red \u2014 Jujutsu Kaisen technique crop", "origin": "https://i.ytimg.com/vi/442c2fp_4ds/maxresdefault.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen"},
  "HOLLOW_PURPLE": {"src": "/art/techniques/purple.webp", "motion": "approach", "size": 0.85, "source": {"title": "purple \u2014 Jujutsu Kaisen technique crop", "origin": "https://cdn.shopify.com/s/files/1/0400/9767/7479/files/Jujutsu_Kaisen_Effect_Of_Gojo_s_Purple_Technique.png?v=1744917273", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen"},
  "GOJO_ULTIMATE": {"src": "/art/techniques/void.webp", "motion": "domain", "size": 0.85, "source": {"title": "void \u2014 Jujutsu Kaisen technique crop", "origin": "https://static.wikia.nocookie.net/jujutsu-kaisen/images/b/ba/Episodio_07_-_210.jpg/revision/latest/scale-to-width-down/1200?cb=20201126155337&path-prefix=es", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}},
  "DIVINE_DOGS": {"src": "/art/techniques/dogs.webp", "motion": "summon", "size": 0.95, "source": {"title": "dogs \u2014 Jujutsu Kaisen technique crop", "origin": "https://a.storyblok.com/f/178900/1920x1080/0d77568cd6/jujutsu-kaisen-e55-megumi.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}},
  "NUE": {"src": "/art/techniques/nue.webp", "motion": "summon", "size": 0.95, "source": {"title": "nue \u2014 Jujutsu Kaisen technique crop", "origin": "https://pbs.twimg.com/media/EqEwnvvVQAAzb3L.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}},
  "MEGUMI_ULTIMATE": {"src": "/art/techniques/shadow.webp", "motion": "domain", "size": 0.85, "source": {"title": "shadow \u2014 Jujutsu Kaisen technique crop", "origin": "https://animehunch.com/wp-content/uploads/2021/03/Megumi_Nue.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}},
  "CLEAVE": {"src": "/art/techniques/slash.webp", "motion": "slash", "size": 0.85, "source": {"title": "slash \u2014 Jujutsu Kaisen technique crop", "origin": "https://i.imgur.com/Y94qsv3.png", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen"},
  "DISMANTLE": {"src": "/art/techniques/slash.webp", "motion": "slash", "size": 0.85, "source": {"title": "slash \u2014 Jujutsu Kaisen technique crop", "origin": "https://i.imgur.com/Y94qsv3.png", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen"},
  "SUKUNA_ULTIMATE": {"src": "/art/techniques/shrine.webp", "motion": "domain", "size": 0.85, "source": {"title": "shrine \u2014 Jujutsu Kaisen technique crop", "origin": "https://m.media-amazon.com/images/M/MV5BYTY2YTc4YjEtYmMwNi00MzY4LThjMjctMzRhNGYwNTlmYzM5XkEyXkFqcGc%40._V1_.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}},
  "PIERCING_BLOOD": {"src": "/art/techniques/blood.webp", "motion": "approach", "size": 0.85, "source": {"title": "blood \u2014 Jujutsu Kaisen technique crop", "origin": "https://cdn.shopify.com/s/files/1/0400/9767/7479/files/Jujutsu_Kaisen_Piercing_Blood_Technique.png?v=1750355614", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen", "angle": 0},
  "CHOSO_ULTIMATE": {"src": "/art/techniques/supernova.webp", "motion": "impact", "size": 0.85, "source": {"title": "supernova \u2014 Jujutsu Kaisen technique crop", "origin": "https://jujutsu-kaisen-wiki.vercel.app/assets/supernova-2.webp", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen"},
  "GRANITE_BLAST": {"src": "/art/techniques/granite.webp", "motion": "approach", "size": 0.85, "source": {"title": "granite \u2014 Jujutsu Kaisen technique crop", "origin": "https://img.animanch.com/2022/03/1-10.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "feather": 0.08},
  "RYU_ULTIMATE": {"src": "/art/techniques/granite.webp", "motion": "impact", "size": 0.85, "source": {"title": "granite \u2014 Jujutsu Kaisen technique crop", "origin": "https://img.animanch.com/2022/03/1-10.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "feather": 0.08},
  "yuji:BASIC_PUNCH": {"src": "/art/techniques/fist.webp", "motion": "impact", "size": 0.85, "source": {"title": "fist \u2014 Jujutsu Kaisen technique crop", "origin": "https://cdn.alfabetajuega.com/alfabetajuega/2021/07/Crear-una-tecnica-maldita-y-ser-capaz-de-usarla-El-Puno-Divergente.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen"},
  "BLACK_FLASH": {"src": "/art/techniques/blackflash.webp", "motion": "impact", "size": 0.85, "source": {"title": "blackflash \u2014 Jujutsu Kaisen technique crop", "origin": "https://www.looper.com/img/gallery/yuji-itadoris-powers-from-jujutsu-kaisen-explained/yuji-learns-the-black-flash-technique-1633188559.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen"},
  "YUJI_ULTIMATE": {"src": "/art/techniques/fist.webp", "motion": "impact", "size": 0.85, "source": {"title": "fist \u2014 Jujutsu Kaisen technique crop", "origin": "https://cdn.alfabetajuega.com/alfabetajuega/2021/07/Crear-una-tecnica-maldita-y-ser-capaz-de-usarla-El-Puno-Divergente.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen"},
  "BASIC_PUNCH": {"src": "/art/techniques/fist.webp", "motion": "impact", "size": 0.85, "source": {"title": "fist \u2014 Jujutsu Kaisen technique crop", "origin": "https://cdn.alfabetajuega.com/alfabetajuega/2021/07/Crear-una-tecnica-maldita-y-ser-capaz-de-usarla-El-Puno-Divergente.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen"},
  "toji:CURSED_TOOLS": {"src": "/art/techniques/spear.webp", "motion": "slash", "size": 0.85, "source": {"title": "spear \u2014 Jujutsu Kaisen technique crop", "origin": "https://theswordstall.co.uk/cdn/shop/articles/Inverted_Spear_of_Heaven__28Anime_29.webp?v=1733166374", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}},
  "CURSE_SWARM": {"src": "/art/techniques/curse.webp", "motion": "summon", "size": 0.95, "source": {"title": "curse \u2014 Jujutsu Kaisen technique crop", "origin": "https://cdn.shopify.com/s/files/1/0561/3086/3278/files/Suguru_summoning_two_strong_Cursed_Spirits_1.png?v=1640311672", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "feather": 0.08},
  "CURSE_SWALLOW": {"src": "/art/techniques/swallow.webp", "motion": "summon", "size": 0.95, "source": {"title": "swallow \u2014 Jujutsu Kaisen technique crop", "origin": "https://cdn-ak.f.st-hatena.com/images/fotolife/L/Lastbreath/20231223/20231223063515.png", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen"},
  "GETO_ULTIMATE": {"src": "/art/techniques/uzumaki.webp", "motion": "approach", "size": 0.85, "source": {"title": "uzumaki \u2014 Jujutsu Kaisen technique crop", "origin": "https://pbs.twimg.com/media/GD81f8tawAAONd0.png", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "feather": 0.08},
  "yuta:CURSED_TOOLS": {"src": "/art/techniques/katana.webp", "motion": "slash", "size": 0.85, "source": {"title": "katana \u2014 Jujutsu Kaisen technique crop", "origin": "https://assets.jabarekspres.com/main/2024/02/jujutsu-kaisen-chapter-249-5.webp", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "angle": -55},
  "RIKA": {"src": "/art/techniques/rika.webp", "motion": "summon", "size": 0.95, "source": {"title": "rika \u2014 Jujutsu Kaisen technique crop", "origin": "https://s.cinemacafe.net/imgs/p/HYddfX70X05nh6LzkP_ZwgIDWA8ODQwLCgkI/537806.jpg?zoom=spacing", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}},
  "YUTA_ULTIMATE": {"src": "/art/techniques/rika.webp", "motion": "summon", "size": 0.95, "source": {"title": "rika \u2014 Jujutsu Kaisen technique crop", "origin": "https://s.cinemacafe.net/imgs/p/HYddfX70X05nh6LzkP_ZwgIDWA8ODQwLCgkI/537806.jpg?zoom=spacing", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}},
  "MUTUAL_LOVE": {"src": "/art/techniques/mutual.webp", "motion": "domain", "size": 0.85, "source": {"title": "mutual \u2014 Jujutsu Kaisen technique crop", "origin": "https://assets.jabarekspres.com/main/2024/02/jujutsu-kaisen-chapter-249-5.webp", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}},
  "choso:BASIC_PUNCH": {"src": "/art/techniques/fist.webp", "motion": "impact", "size": 0.85, "source": {"title": "fist \u2014 Jujutsu Kaisen technique crop", "origin": "https://cdn.alfabetajuega.com/alfabetajuega/2021/07/Crear-una-tecnica-maldita-y-ser-capaz-de-usarla-El-Puno-Divergente.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen"},
  "ryu:BASIC_PUNCH": {"src": "/art/techniques/fist.webp", "motion": "impact", "size": 0.85, "source": {"title": "fist \u2014 Jujutsu Kaisen technique crop", "origin": "https://cdn.alfabetajuega.com/alfabetajuega/2021/07/Crear-una-tecnica-maldita-y-ser-capaz-de-usarla-El-Puno-Divergente.jpg", "supplied": false, "notes": "Original source pixels cropped/masked; no image generation. See public/art/techniques/sources.json."}, "blend": "screen"},
  MAHORAGA: {src:"/art/characters/mahoraga.png",motion:"summon",size:.95,edgeFade:{right:.14,bottom:.1},source:{title:"Mahoraga supplied cutout",origin:"Existing project artwork",supplied:true}},
};

/** Manifest key for a cue: character-specific first, then the action. */
export function artKey(character: string, action: string): string {
  const specific = `${character}:${action}`;
  return TECHNIQUE_ART[specific] || TECHNIQUE_SLOTS.some((s) => s.key === specific) ? specific : action;
}

/** Slots that have no image yet (reported, never replaced by generic shapes). */
export function missingTechniqueArt(): TechniqueSlot[] {
  return TECHNIQUE_SLOTS.filter((s) => !TECHNIQUE_ART[s.key]);
}
