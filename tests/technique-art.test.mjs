import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.matchMedia ??= () => ({ matches: false });
const { TECHNIQUE_SLOTS, TECHNIQUE_ART, artKey, missingTechniqueArt } = await import('../.test-build/progress/rendering/TechniqueArtManifest.js');
const { containSize, coverWithFocal, motionFrame } = await import('../.test-build/progress/rendering/TechniqueArtLayout.js');
const { EFFECT_PREVIEWS } = await import('../.test-build/progress/rendering/CharacterEffects.js');
const roster = JSON.parse(fs.readFileSync('server/roster.json', 'utf8'));

test('every technique of all nine characters has an art slot (solo, previews and online ids)', () => {
  const chars = new Set(TECHNIQUE_SLOTS.map(s => s.character));
  for (const c of ['gojo', 'megumi', 'sukuna', 'choso', 'ryu', 'yuji', 'toji', 'geto', 'yuta']) assert.ok(chars.has(c), c);
  assert.equal(new Set(TECHNIQUE_SLOTS.map(s => s.key)).size, TECHNIQUE_SLOTS.length, 'slot keys unique');
  const keys = new Set(TECHNIQUE_SLOTS.map(s => s.key));
  const ALIASES = { LAPSE_BLUE: 'AMPLIFICATION_BLUE', UNLIMITED_VOID: 'GOJO_ULTIMATE', PRIMARY_ATTACK: 'CLEAVE', SECONDARY_ATTACK: 'PIERCING_BLOOD', DOMAIN_EXPANSION: 'MEGUMI_ULTIMATE', MALEVOLENT_SHRINE: 'SUKUNA_ULTIMATE', SUPERNOVA: 'CHOSO_ULTIMATE', UZUMAKI: 'GETO_ULTIMATE', SOUL_SPLIT: 'CURSED_TOOLS', HEAVENLY_RUSH: 'CURSED_TOOLS', KATANA: 'CURSED_TOOLS', YUJI_DOMAIN: 'YUJI_ULTIMATE', RYU_DOMAIN: 'GRANITE_BLAST' };
  const covered = (character, action) => keys.has(artKey(character, action)) || keys.has(`${character}:${action}`);
  for (const [character, actions] of Object.entries(EFFECT_PREVIEWS)) for (const action of actions) assert.ok(covered(character, action), `${character}:${action}`);
  for (const c of roster) for (const move of c.moves) { const m = { id: move.id ?? move };
    const action = ALIASES[m.id] ?? m.id;
    if (action === 'BASIC_PUNCH') continue; // shared basic strike: per-character slots exist for yuji/choso/ryu
    assert.ok(covered(c.id, action), `online ${c.id}:${m.id}`);
  }
  assert.equal(artKey('toji', 'CURSED_TOOLS'), 'toji:CURSED_TOOLS');
  assert.equal(artKey('', 'CURSED_TOOLS'), 'CURSED_TOOLS');
  assert.equal(artKey('megumi', 'MAHORAGA'), 'MAHORAGA');
});

test('every image in the manifest has a source, exists, and matches its slot', () => {
  for (const [key, e] of Object.entries(TECHNIQUE_ART)) {
    const slot = TECHNIQUE_SLOTS.find(s => s.key === key);
    assert.ok(slot, `${key} is a known slot`);
    assert.equal(e.motion, slot.motion, `${key} motion`);
    assert.ok(e.source.title && e.source.origin, `${key} source`);
    assert.ok(e.source.supplied || e.source.origin.startsWith('https://'), `${key} has traceable image provenance`);
    assert.ok(fs.existsSync('public' + e.src), `${key} file ${e.src}`);
    for (const r of [e.crop, e.focal].filter(Boolean)) for (const v of Object.values(r)) assert.ok(v >= 0 && v <= 1, `${key} fractions`);
  }
  assert.equal(missingTechniqueArt().length, 0, 'every ability has real imagery');
});

const views = { desktop: { w: 960, h: 540 }, laptop: { w: 1280, h: 800 }, mobilePortrait: { w: 390, h: 700 }, mobileLandscape: { w: 844, h: 390 } };

test('technique images keep their proportions and fit the combat area', () => {
  for (const img of [{ w: 1280, h: 1276 }, { w: 4185, h: 2760 }, { w: 300, h: 900 }]) for (const box of Object.values(views)) {
    const s = containSize(img, box);
    assert.ok(Math.abs(s.w / s.h - img.w / img.h) < 1e-9, 'aspect kept');
    assert.ok(s.w <= box.w + 1e-9 && s.h <= box.h + 1e-9, 'fits');
  }
});

test('domain backdrops cover desktop and mobile areas without stretching, focal point centred when possible', () => {
  const img = { w: 4185, h: 2760 };
  for (const [name, view] of Object.entries(views)) for (const focal of [{ x: 0.54, y: 0.5 }, { x: 0.385, y: 0.5 }, { x: 0.05, y: 0.95 }]) {
    const r = coverWithFocal(img, view, focal);
    assert.ok(Math.abs(r.w / r.h - img.w / img.h) < 1e-9, `${name} aspect`);
    assert.ok(r.x <= 1e-9 && r.y <= 1e-9 && r.x + r.w >= view.w - 1e-9 && r.y + r.h >= view.h - 1e-9, `${name} covers`);
    const fx = r.x + focal.x * r.w, fy = r.y + focal.y * r.h;
    const canCentreX = focal.x * r.w >= view.w / 2 && (1 - focal.x) * r.w >= view.w / 2;
    if (canCentreX) assert.ok(Math.abs(fx - view.w / 2) < 1e-6, `${name} focal x centred`);
    assert.ok(fx >= 0 && fx <= view.w && fy >= 0 && fy <= view.h, `${name} focal visible`);
  }
});

test('Red/Purple/Piercing Blood/Granite Blast (approach) stay centred and only grow toward the viewer', () => {
  let last = 0;
  for (let i = 0; i <= 100; i++) {
    const f = motionFrame('approach', i / 100);
    assert.equal(f.dx, 0); assert.equal(f.dy, 0);
    assert.ok(f.scale >= last - 1e-12, `grows at p=${i / 100}`);
    last = f.scale;
  }
  assert.ok(motionFrame('approach', 0.05).scale < 0.25 && motionFrame('approach', 0.95).scale > 2, 'small at centre, large at the viewer');
  assert.equal(motionFrame('approach', 1).alpha, 0, 'gone at the end');
  for (const slot of TECHNIQUE_SLOTS.filter(s => ['REVERSAL_RED', 'HOLLOW_PURPLE', 'PIERCING_BLOOD', 'GRANITE_BLAST'].includes(s.key))) assert.equal(slot.motion, 'approach', slot.key);
});
