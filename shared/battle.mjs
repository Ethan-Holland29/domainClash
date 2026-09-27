// DomainClash combat rules shared by solo play and the multiplayer server.
// This engine keeps all match state serializable so both clients see identical
// character-specific move effects, passives, cooldowns and battle events.

export const BASE = {
  /** Megumi's replacement fighter when the summoning delay finishes. */
  mahoragaHp: 50,
  /** Mahoraga loses 4 percentage points of damage reduction each turn. */
  adaptStep: 0.04,
  hp: 200,
  ceMax: 100,
  ceStart: 0,
  /** The historical combat rules grant meter only from moves and passives. */
  ceRegen: 0,
  strikeCe: 5,
  critChance: 0,
  critMultiplier: 1,
  powerScale: 1,
  domainTurns: 3,
  bleedTurns: 0,
  bleedDamage: 5,
  maxTurns: 0,
};

/** @typedef {'strike'|'technique'|'ultimate'|'guard'|'special'} MoveKind */

/** Every move. ids match the hand-sign gesture ids so recordings keep working. */
export const MOVES = {
  GUARD: { name: 'Guard', kind: 'guard', power: 0, accuracy: 100, cost: 0, priority: 4,
    text: 'Blocks every direct attack this turn (not domain sure-hits). Fails if used two turns in a row.' },
  BASIC_PUNCH: { name: 'Basic Punch', kind: 'strike', power: 10, accuracy: 90, cost: 0, priority: 0,
    text: '10 damage · +5 meter · 10% miss.' },

  // Gojo - Limitless (Six Eyes)
  AMPLIFICATION_BLUE: { name: 'Amplification: Blue', kind: 'technique', power: 10, accuracy: 95, cost: 0, priority: 0,
    text: '10 damage · drain 20 enemy meter · +20 meter · 3-turn cooldown.' },
  REVERSAL_RED: { name: 'Reversal: Red', kind: 'technique', power: 20, accuracy: 95, cost: 0, priority: 0,
    text: '20 damage · +20 meter · 3-turn cooldown.' },
  HOLLOW_PURPLE: { name: 'Hollow Purple', kind: 'special', power: 100, accuracy: 95, cost: 0, priority: 0,
    text: 'Unblockable · 100 damage · needs 2 Red and 2 Blue uses plus 100 meter · recover for 3 turns.' },
  GOJO_ULTIMATE: { name: 'Domain Expansion: Unlimited Void', kind: 'ultimate', power: 40, accuracy: 95, cost: 100, priority: 0,
    text: 'Unblockable · 100 meter · 40 damage · next 2 enemy attacks have a 33% chance to hit themselves for 5.' },

  // Megumi - Ten Shadows
  NUE: { name: 'Nue', kind: 'technique', power: 15, accuracy: 95, cost: 0, priority: 0,
    text: '30 meter · random 5/15/20/30 damage · once per match.' },
  DIVINE_DOGS: { name: 'Demon Dogs', kind: 'technique', power: 0, accuracy: 95, cost: 0, priority: 0,
    text: 'Heal 20 HP · dogs bite for 5 damage on each of your next 3 turns · once per match.' },
  MAHORAGA: { name: 'Mahoraga', kind: 'special', power: 30, accuracy: 95, cost: 0, priority: 0,
    text: 'Below 70 HP · appears after 3 enemy turns · replaces Megumi with 50 HP · deals 30 · starts with 20% damage reduction, then loses 4 points per turn.' },
  MEGUMI_ULTIMATE: { name: 'Domain Expansion: Chimera Shadow Garden', kind: 'ultimate', power: 20, accuracy: 95, cost: 100, priority: 0,
    text: 'Unblockable · 100 meter · 20 damage · refresh Nue or Demon Dogs at random.' },

  // Sukuna
  CLEAVE: { name: 'Cleave', kind: 'technique', power: 15, accuracy: 95, cost: 0, priority: 0,
    text: '15 damage initially · +10 per finger eaten · +20 meter · 2-turn cooldown.' },
  SUKUNA_ULTIMATE: { name: 'Domain Expansion: Malevolent Shrine', kind: 'ultimate', power: 45, accuracy: 95, cost: 100, priority: 0,
    text: 'Unblockable · spend all meter · 15 damage per 30 meter (45–75 damage).' },

  // Choso - Blood Manipulation (no domain)
  PIERCING_BLOOD: { name: 'Piercing Blood', kind: 'technique', power: 20, accuracy: 95, cost: 0, priority: 0,
    text: '20 damage · +15 vs Megumi after a summon · +20 meter.' },
  CHOSO_ULTIMATE: { name: 'Supernova', kind: 'ultimate', power: 40, accuracy: 95, cost: 100, priority: 0,
    text: 'Unblockable · 100 meter · 40 damage · target wipes blood and skips a turn, then bleeds for 2× your stacks each turn for 2 turns.' },

  // Ryu Ishigori
  GRANITE_BLAST: { name: 'Granite Blast', kind: 'technique', power: 30, accuracy: 95, cost: 0, priority: 0,
    text: '30 damage, −5 per use (minimum 5) · +15 meter · 1-turn cooldown.' },
  RYU_ULTIMATE: { name: 'Way Too Sweet!', kind: 'ultimate', power: 0, accuracy: 95, cost: 100, priority: 0,
    text: 'Unblockable · heal 40 HP · restore Granite Blast to 30 damage.' },

  // Yuji Itadori
  YUJI_ULTIMATE: { name: 'Straight Hands', kind: 'ultimate', power: 40, accuracy: 95, cost: 80, priority: 0,
    text: 'Unblockable · 80 meter · four 10-damage punches, each with a 33% chance to Black Flash for 20.' },
  CURSED_FISTS: { name: 'Cursed Fists', kind: 'technique', power: 10, accuracy: 90, cost: 0, priority: 0,
    text: '10 damage · +30 meter · 50% chance to Black Flash for 20 damage.' },

  // Toji Fushiguro - Heavenly Restriction (no cursed energy, no domain)
  CURSED_TOOLS: { name: 'Cursed Tools', kind: 'technique', power: 35, accuracy: 95, cost: 0, priority: 0, pierce: true,
    text: '30/35/40 random damage · 2-turn cooldown · 33% chance to weaken the enemy’s next hit.' },

  // Suguru Geto - Cursed Spirit Manipulation (no domain)
  CURSE_SWALLOW: { name: 'Curse Swallow', kind: 'special', power: 0, accuracy: 95, cost: 0, priority: 0,
    text: 'Heal up to 30 HP · pause summons for 2 turns · 2-turn cooldown.' },
  GETO_ULTIMATE: { name: 'Maximum: Uzumaki', kind: 'ultimate', power: 0, accuracy: 95, cost: 100, priority: 0,
    text: 'Unblockable · 100 meter · roll 10 spirits: Grade 3 +5, Grade 2 −5, Grade 1 +10; double the total per Special.' },

  // Yuta Okkotsu
  RIKA: { name: 'Rika', kind: 'technique', power: 20, accuracy: 95, cost: 0, priority: 0,
    text: '20 damage · steal up to 15 enemy meter · gain 25 · 2-turn cooldown.' },
  YUTA_ULTIMATE: { name: 'Copy', kind: 'ultimate', power: 0, accuracy: 95, cost: 100, priority: 0,
    text: 'Unblockable · 100 meter · copy a random ultimate at 80% strength; keeps its extra effects.' },

  // Mahoraga's own attack (used through the Strike input while Mahoraga is out)
  MAHORAGA_STRIKE: { name: 'Mahoraga Strike', kind: 'strike', power: 30, accuracy: 90, cost: 0, priority: 0,
    text: 'Mahoraga deals 30 damage.' },
};

/** Strike names per character (same move, lore flavour). */
const STRIKE_NAMES = { sukuna: 'Basic Punch', yuji: 'Basic Punch', yuta: 'Basic Punch', toji: 'Basic Punch' };

/** Kits. `moves` are the inputs the player can use (plus GUARD for everyone). */
export const CHARACTERS = {
  gojo: { name: 'Satoru Gojo', moves: ['BASIC_PUNCH', 'AMPLIFICATION_BLUE', 'REVERSAL_RED', 'HOLLOW_PURPLE', 'GOJO_ULTIMATE'], domain: true,
    passive: { name: 'Limitless', text: 'Take 20% less damage below 40 meter.' } },
  megumi: { name: 'Megumi Fushiguro', moves: ['BASIC_PUNCH', 'NUE', 'DIVINE_DOGS', 'MAHORAGA', 'MEGUMI_ULTIMATE'], domain: true, mahoraga: true,
    passive: { name: 'Shadow Dweller', text: 'Each turn has a 10% chance to deal 10 damage and gain 10 meter.' } },
  sukuna: { name: 'Ryomen Sukuna', moves: ['BASIC_PUNCH', 'CLEAVE', 'SUKUNA_ULTIMATE'], domain: true,
    passive: { name: 'Finger Lickin’', text: 'Starts at 175 HP; punch deals 5. Every 3 turns, gain a finger for +10 HP and meter (max 5).' } },
  choso: { name: 'Choso', moves: ['BASIC_PUNCH', 'PIERCING_BLOOD', 'CHOSO_ULTIMATE'], domain: false,
    passive: { name: 'Flowing Red Scale', text: 'Gain 1 stack per 10 HP lost. Supernova deals 2 damage per stack each turn for 2 turns.' } },
  ryu: { name: 'Ryu Ishigori', moves: ['BASIC_PUNCH', 'GRANITE_BLAST', 'RYU_ULTIMATE'], domain: false,
    passive: { name: 'Jane, You’re Early', text: 'Granite Blast starts at 30 damage and loses 5 per use (min 5). Way Too Sweet restores it.' } },
  yuji: { name: 'Yuji Itadori', moves: ['BASIC_PUNCH', 'CURSED_FISTS', 'YUJI_ULTIMATE'], domain: false,
    passive: { name: 'Unbreakable Spirit', text: 'Basic Punch has a 33% Black Flash chance. Takes 33% more Cursed Technique damage.' } },
  toji: { name: 'Toji Fushiguro', moves: ['BASIC_PUNCH', 'CURSED_TOOLS'], domain: false, resource: 'Stamina',
    passive: { name: 'Heavenly Restriction', text: 'Punch deals 15 and gains 10 meter. At 100 meter, lose 20 HP and skip a turn.' } },
  geto: { name: 'Suguru Geto', moves: ['BASIC_PUNCH', 'CURSE_SWALLOW', 'GETO_ULTIMATE'], domain: false,
    passive: { name: 'Curse Army', text: 'Summon a random cursed spirit each turn: Grade 3 25%; Grade 2 40%; Grade 1 25%; Special 10%.' } },
  yuta: { name: 'Yuta Okkotsu', moves: ['BASIC_PUNCH', 'RIKA', 'YUTA_ULTIMATE'], domain: false,
    passive: { name: 'Bottomless Cursed Energy', text: 'Gain +5 meter per attempted attack, including Copy. Rika transfers up to 15 enemy meter.' } },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS);

/** Deterministic RNG (mulberry32) for tests, simulations and the server. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fighter(id) {
  const c = CHARACTERS[id];
  if (!c) throw new Error(`Unknown character ${id}`);
  return {
    id, name: c.name,
    hp: id === 'sukuna' ? 175 : BASE.hp,
    maxHp: id === 'sukuna' ? 175 : BASE.hp,
    ce: BASE.ceStart,
    stages: { atk: 0, def: 0, spd: 0 },
    bleed: 0, bleedingTurns: 0, bloodBlindTurns: 0, stunned: false,
    lastMove: null, used: [], usedSummons: [], redScale: false,
    ownTurns: 0, cooldowns: {}, redUses: 0, blueUses: 0,
    recovery: 0, voidAttacks: 0, dogsTurns: 0,
    mahoraga: false, mahoragaUsed: false, summonCountdown: null,
    adaptation: 0, adaptationTurnStarted: false, adapt: {}, hitBy: [], graniteDamage: 30,
    lastShikigamiTurn: null, bloodStacks: 0, bloodDamageRemainder: 0, supernovaBleedDamage: 0,
    fingers: 0, curseGuard: false, curseGuardUntil: 0, cursePause: 0,
    curseGrade: '', weaponBonus: 0, purge: false, borrowedSummons: [],
  };
}

/** A fresh battle between two characters. Plain JSON: safe to send over the network. */
export function createBattle(p1, p2) {
  const sides = [fighter(p1), fighter(p2)];
  // Mirror match: the battle text must say which one acted.
  if (p1 === p2) sides.forEach((f, i) => { f.name += ` (P${i + 1})`; });
  return { turn: 1, sides, domain: null, winner: null, over: false };
}

/** The move a fighter's input maps to (Mahoraga swings its sword through the Strike input). */
export function moveFor(f, id) {
  return f.mahoraga && id === 'BASIC_PUNCH' ? 'MAHORAGA_STRIKE' : id;
}

/** Display name of a move for this fighter. */
export function moveName(f, id) {
  const real = moveFor(f, id);
  if (real === 'BASIC_PUNCH') return STRIKE_NAMES[f.id] ?? MOVES.BASIC_PUNCH.name;
  return MOVES[real]?.name ?? id;
}

/** Inputs a fighter can choose this turn, with why the others are unavailable. */
export function moveOptions(state, side) {
  const f = state.sides[side];
  const inputs = f.mahoraga ? ['BASIC_PUNCH', 'GUARD'] : [...CHARACTERS[f.id].moves, ...(f.borrowedSummons ?? []), 'GUARD'];
  return inputs.map((id) => ({ id, name: moveName(f, id), reason: unavailableReason(state, side, id) }));
}

const COPY_POOL = ['GOJO_ULTIMATE', 'HOLLOW_PURPLE', 'MEGUMI_ULTIMATE', 'SUKUNA_ULTIMATE', 'CHOSO_ULTIMATE', 'RYU_ULTIMATE', 'YUJI_ULTIMATE', 'GETO_ULTIMATE'];
const PASSIVE_CUES = {
  toji: { name: 'Heavenly Restriction', message: 'Toji Fushiguro defies cursed energy!' },
  geto: { name: 'Curse Army', message: 'Suguru Geto calls forth his cursed spirits!' },
  yuta: { name: 'Bottomless Cursed Energy', message: 'Yuta Okkotsu overflows with cursed energy!' },
  yuji: { name: 'Unbreakable Spirit', message: 'Yuji Itadori lands a Black Flash!' },
  gojo: { name: 'Limitless', message: 'Satoru Gojo is the Honored One!' },
  megumi: { name: 'Shadow Dweller', message: 'Megumi Fushiguro lurks in the shadows...' },
  ryu: { name: 'Jane, You’re Early', message: "Your life's work has been dirtied..." },
  choso: { name: 'Flowing Red Scale', message: 'Choso is gaining stacks!' },
  sukuna: { name: 'Finger Lickin’', message: 'Sukuna is growing stronger...' },
};
export const maxMeter = (f) => f.id === 'sukuna' ? 150 : BASE.ceMax;
const moveCooldown = (f, id) => {
  if ((f.borrowedSummons ?? []).includes(id) || f.id === 'megumi' || f.mahoraga || id === 'BASIC_PUNCH' || id === 'GUARD' || id === 'HOLLOW_PURPLE' || id === CHARACTERS[f.id].moves.at(-1) && MOVES[id]?.kind === 'ultimate') return 0;
  if (f.id === 'ryu' && id === 'GRANITE_BLAST') return 1;
  if (f.id === 'gojo' && (id === 'REVERSAL_RED' || id === 'AMPLIFICATION_BLUE')) return 3;
  return MOVES[id]?.kind === 'technique' || id === 'CURSE_SWALLOW' ? 2 : 0;
};

export function unavailableReason(state, side, id) {
  const f = state.sides[side];
  if (state.over) return 'The battle is over';
  const inputs = f.mahoraga ? ['BASIC_PUNCH', 'GUARD'] : [...CHARACTERS[f.id].moves, ...(f.borrowedSummons ?? []), 'GUARD'];
  if (!inputs.includes(id)) return 'Not in this kit';
  if (id === 'GUARD' && f.lastMove === 'GUARD') return 'Guard fails two turns in a row';
  if (f.purge || f.ce >= 100 && f.id === 'toji') return 'Must expel cursed energy this turn';
  if (f.bloodBlindTurns) return 'Must spend this turn wiping blood from their eyes';
  if (f.recovery) return `Recovering: ${f.recovery} turn(s)`;
  const remaining = Math.max(0, (f.cooldowns?.[id] ?? 0) - state.turn);
  if (remaining) return `Cooldown: ${remaining} turn(s) remaining`;
  const ultimate = id === CHARACTERS[f.id].moves.at(-1) && MOVES[id]?.kind === 'ultimate' || id === 'HOLLOW_PURPLE';
  const cost = id === 'YUJI_ULTIMATE' ? 80 : 100;
  if (id === 'HOLLOW_PURPLE' && (f.redUses < 2 || f.blueUses < 2)) return `Unlock: Red ${Math.min(2, f.redUses)}/2 · Blue ${Math.min(2, f.blueUses)}/2`;
  if (ultimate && f.ce < cost) return `Needs ${cost} meter`;
  if (f.usedSummons?.includes(id)) return 'Already summoned this match';
  if (id === 'MAHORAGA') {
    if (f.mahoragaUsed || f.summonCountdown !== null) return f.mahoragaUsed ? 'Mahoraga can only be summoned once' : 'Already summoning';
    if (f.hp >= 70) return 'Requires less than 70 HP';
  }
  return null;
}

/** True when a fighter's turn is consumed by a forced status rather than a move choice. */
export function mustSkipTurn(fighter) {
  return !!(fighter && (fighter.stunned || fighter.bloodBlindTurns || fighter.recovery || fighter.purge || fighter.id === 'toji' && fighter.ce >= 100));
}

const stageMult = (s) => (s >= 0 ? 1 + 0.25 * s : 1 / (1 - 0.25 * s));
const clampStage = (v) => Math.max(-2, Math.min(2, v));

/** Resolves a shared round using the character-specific combat rules from domainclash-progress. */
export function resolveTurn(prev, choices, random = Math.random) {
  const state = structuredClone(prev);
  const events = [];
  const say = (text, extra = {}) => events.push({ text, ...extra,
    hp: state.sides.map((f) => f.hp), maxHp: state.sides.map((f) => f.maxHp), ce: state.sides.map((f) => f.ce) });
  if (state.over) return { state, events };

  const picks = [0, 1].map((side) => unavailableReason(state, side, choices[side]) === null ? choices[side] : 'BASIC_PUNCH');
  // Picks are simultaneous. Guard must cover the whole round even when the
  // attacker wins initiative and acts before the guarding fighter's turn.
  const guarding = picks.map((pick) => pick === 'GUARD');
  const skip = [null, null];
  const priority = (side) => MOVES[moveFor(state.sides[side], picks[side])]?.priority ?? 0;
  const speed = (side) => stageMult(state.sides[side].stages.spd);
  const first = priority(0) !== priority(1) ? (priority(0) > priority(1) ? 0 : 1)
    : speed(0) !== speed(1) ? (speed(0) > speed(1) ? 0 : 1) : random() < 0.5 ? 0 : 1;

  for (const side of [0, 1]) { if (!state.over) beginRound(side); }
  checkFaint();
  for (const side of [first, 1 - first]) {
    if (state.over) break;
    act(side);
    checkFaint();
  }
  state.turn++;
  return { state, events };

  function passive(f, side) {
    const cue = PASSIVE_CUES[f.id];
    if (cue) say(cue.message, { side, type: 'passive', passive: cue.name });
  }
  function gain(f, amount, side) {
    const before = f.ce;
    f.ce = Math.min(maxMeter(f), Math.max(0, f.ce + amount));
    if (f.id === 'gojo' && !f.mahoraga && before >= 40 && f.ce < 40) passive(f, side);
  }
  function applyDamage(side, raw, kind, attacker = null) {
    const target = state.sides[side];
    if (raw <= 0 || target.hp <= 0) return 0;
    if (kind === 'passive' && target.id === 'toji' && !target.mahoraga) return 0;
    let amount = Math.max(0, Math.floor(raw));
    const bypassPassive = attacker?.id === 'toji';
    if (target.id === 'yuji' && !bypassPassive && kind === 'technique') amount = Math.round(amount * 1.33);
    let reduction = 0;
    if (!bypassPassive && target.curseGuard && target.curseGuardUntil >= state.turn) reduction = 0.33;
    if (!bypassPassive && target.id === 'gojo' && !target.mahoraga && target.ce < 40) reduction = Math.max(reduction, 0.20);
    if (target.mahoraga && !bypassPassive) reduction = Math.max(reduction, target.adaptation);
    const dealt = Math.min(target.hp, Math.floor(amount * (1 - reduction)));
    target.hp -= dealt;
    const attackerId = attacker?.id ?? attacker;
    if (target.mahoraga && attackerId && !target.hitBy.includes(attackerId)) target.hitBy.push(attackerId);
    if (target.id === 'choso' && !target.mahoraga && dealt > 0) {
      const total = target.bloodDamageRemainder + dealt;
      const stacks = Math.floor(total / 10);
      target.bloodStacks += stacks;
      target.bloodDamageRemainder = total % 10;
      if (stacks) {
        passive(target, side);
        say(`Flowing Red Scale: ${target.name} gained ${stacks} blood stack(s), now ${target.bloodStacks}.`, { side, type: 'blood-stack', amount: stacks });
      }
    }
    return dealt;
  }
  function recordDamage(side, amount, move, kind, attacker, attackerSide) {
    const dealt = applyDamage(side, amount, kind, attacker);
    say(`${who(state.sides[side])} took ${dealt} damage.`, { side, type: 'damage', amount: dealt, move, attacker: attackerSide });
    return dealt;
  }
  function heal(f, amount) {
    const before = f.hp;
    f.hp = Math.min(f.maxHp, f.hp + amount);
    return f.hp - before;
  }
  function transformMahoraga(f, side) {
    f.summonCountdown = null; f.mahoraga = true; f.hp = BASE.mahoragaHp; f.maxHp = BASE.mahoragaHp;
    f.ce = 0; f.adaptation = 0.20; f.adaptationTurnStarted = false; f.dogsTurns = 0; f.voidAttacks = 0;
    say('Sacred treasure: Swing and ring...', { side, type: 'mahoraga' });
    say(`${f.name} sacrifices himself. Mahoraga takes over with ${BASE.mahoragaHp} HP.`, { side, type: 'mahoraga' });
  }
  function beginRound(side) {
    const f = state.sides[side];
    const enemy = state.sides[1 - side];
    f.ownTurns++;
    f.curseGuard = false;
    f.curseGrade = '';
    if (f.ownTurns === 1 && ['ryu', 'gojo', 'toji', 'yuta'].includes(f.id)) passive(f, side);
    if (f.id === 'toji' && f.ce >= 100) f.purge = true;
    if (f.summonCountdown === 0) {
      transformMahoraga(f, side);
    } else if (f.mahoraga) {
      if (f.adaptationTurnStarted) {
        f.adaptation = Math.max(0, f.adaptation - BASE.adaptStep);
        say('Mahoraga adapts: incoming damage is reduced again.', { side, type: 'adapt' });
      } else {
        f.adaptationTurnStarted = true;
      }
    }
    if (f.id === 'geto' && !f.mahoraga) {
      if (f.cursePause > 0) {
        f.cursePause--;
        say(`Curse Swallow: summons paused (${f.cursePause} turn(s) remaining).`, { side, type: 'passive' });
      } else {
        passive(f, side);
        const roll = random();
        const grade = roll < 0.25 ? 3 : roll < 0.65 ? 2 : roll < 0.90 ? 1 : 'special';
        f.curseGrade = String(grade);
        if (grade === 3 || grade === 2) {
          const dealt = applyDamage(1 - side, grade === 3 ? 5 : 10, 'passive', 'CURSE_ARMY');
          say(`Grade ${grade} curse deals ${dealt} damage.`, { side, type: 'passive', amount: dealt });
          checkFaint();
          if (state.over) return;
        }
        if (grade === 2 || grade === 1) gain(f, 10, side);
        if (grade === 1) { f.curseGuard = true; f.curseGuardUntil = state.turn; }
        if (grade === 'special') gain(f, 50, side);
      }
    }
    if (f.bleedingTurns > 0) {
      f.bleedingTurns--; f.bleed = f.bleedingTurns;
      const dealt = applyDamage(side, f.supernovaBleedDamage, 'passive', 'SUPERNOVA_BLEED');
      say(`Supernova blood damage: ${f.name} takes ${dealt}. ${f.bleedingTurns} turn(s) remain.`, { side, type: 'bleed-tick', amount: dealt });
      if (f.bleedingTurns === 0) f.supernovaBleedDamage = 0;
      checkFaint();
      if (state.over) return;
    }
    if (f.id === 'megumi' && !f.mahoraga && random() < 0.10) {
      passive(f, side);
      const dealt = applyDamage(1 - side, 10, 'passive', 'SHADOW_DWELLER');
      gain(f, 10, side);
      say(`Shadow Dweller: ${f.name} sabotages the enemy for ${dealt} damage and gains 10 meter.`, { side, type: 'passive', amount: dealt });
      checkFaint();
      if (state.over) return;
    }
    if (f.bloodBlindTurns > 0) skip[side] = 'blood';
    else if (f.recovery > 0) skip[side] = 'recovery';
    else if (f.purge) skip[side] = 'purge';
    else if (f.stunned) skip[side] = 'stunned';
    if (f.mahoraga && f.hitBy.length) f.hitBy = [];
    if (enemy.hp <= 0) checkFaint();
  }
  function checkFaint() {
    const down = state.sides.map((f) => f.hp <= 0);
    if (!down[0] && !down[1]) return;
    state.over = true;
    state.winner = down[0] && down[1] ? 'draw' : down[0] ? 1 : 0;
    for (const [side, f] of state.sides.entries()) if (down[side]) say(`${who(f)} is down!`, { side, type: 'faint' });
  }
  function act(side) {
    const f = state.sides[side], foe = state.sides[1 - side];
    const pick = picks[side];
    if (skip[side] === 'purge') {
      say('Toji must expel cursed energy: lose 20 HP and skip this turn.', { side, type: 'passive' });
      f.purge = false; f.ce = 0; f.weaponBonus = 0;
      const loss = applyDamage(side, 20, 'direct');
      say(`Toji expels his cursed energy, takes ${loss} damage, and loses his turn.`, { side, type: 'passive', amount: loss });
      endActor(side); return;
    }
    if (skip[side] === 'blood') {
      f.bloodBlindTurns--;
      if (f.recovery > 0) f.recovery--;
      say(`${f.name} spends the turn wiping blood from their eyes.`, { side, type: 'stunned' });
      f.weaponBonus = 0; endActor(side); return;
    }
    if (skip[side] === 'recovery') {
      const remaining = f.recovery--;
      say(`${f.name} skips a turn to recover (${Math.max(0, remaining - 1)} remaining).`, { side, type: 'stunned' });
      f.weaponBonus = 0; endActor(side); return;
    }
    if (skip[side] === 'stunned') {
      f.stunned = false;
      say(`${who(f)} is stunned and can't act!`, { side, type: 'stunned' });
      f.weaponBonus = 0; endActor(side); return;
    }
    const id = moveFor(f, pick);
    const m = MOVES[id];
    f.lastMove = pick;
    if (!f.used.includes(pick)) f.used.push(pick);
    say(`${who(f)} used ${moveName(f, pick)}!`, { side, type: 'move', move: pick, effect: effectFor(f, pick) });
    if (pick === 'GUARD') {
      say(`${who(f)} braced for the attack.`, { side, type: 'guard' });
      f.weaponBonus = 0; endActor(side); return;
    }

    const isUltimate = pick === 'HOLLOW_PURPLE' || pick === CHARACTERS[f.id].moves.at(-1) && MOVES[pick]?.kind === 'ultimate';
    const cooldown = moveCooldown(f, pick);
    if (cooldown > 0) f.cooldowns[pick] = state.turn + cooldown + 1;
    const spentMeter = f.ce;
    const stacks = f.bloodStacks;
    const normalMeterAward = pick === 'BASIC_PUNCH' ? (f.id === 'toji' ? 10 : BASE.strikeCe)
      : pick === 'GRANITE_BLAST' ? 15 : ['NUE', 'CURSED_FISTS'].includes(pick) ? 30 : 20;
    const characterMeterBonus = f.id === 'yuta' ? 5 : 0;
    const graniteDamage = f.graniteDamage;
    if (pick === 'CHOSO_ULTIMATE') f.bloodStacks = 0;
    if (pick === 'GRANITE_BLAST') f.graniteDamage = Math.max(5, f.graniteDamage - 5);
    if (isUltimate) gain(f, -f.ce, side);
    else if (!f.mahoraga) gain(f, normalMeterAward, side);
    if (characterMeterBonus) gain(f, characterMeterBonus, side);
    if (pick === 'REVERSAL_RED') f.redUses++;
    if (pick === 'AMPLIFICATION_BLUE') f.blueUses++;
    if (['NUE', 'DIVINE_DOGS', 'MAHORAGA'].includes(pick) && !f.usedSummons.includes(pick)) f.usedSummons.push(pick);
    if (pick === 'HOLLOW_PURPLE') f.recovery = 3;

    let action = pick;
    const copied = pick === 'YUTA_ULTIMATE';
    if (copied) {
      action = COPY_POOL[Math.min(COPY_POOL.length - 1, Math.floor(random() * COPY_POOL.length))];
      say(`Yuta copied ${MOVES[action].name}.`, { side, type: 'copy', move: action });
    }
    if (action === 'HOLLOW_PURPLE') f.recovery = 3;
    if ((f.borrowedSummons ?? []).includes(action)) f.borrowedSummons = f.borrowedSummons.filter((x) => x !== action);
    if (pick === 'MAHORAGA') f.mahoragaUsed = true;
    if (f.voidAttacks > 0) {
      f.voidAttacks--;
      if (random() < 0.33) {
        const damage = applyDamage(side, 5, 'direct');
        say(`${f.name} is disoriented by Unlimited Void and hits themselves for ${damage} damage.`, { side, type: 'self-hit', amount: damage });
        f.weaponBonus = 0; endActor(side); return;
      }
    }
    if (random() < (pick === 'BASIC_PUNCH' || pick === 'CURSED_FISTS' ? 0.10 : 0.05)) {
      say(`${copied ? `Copy: ${MOVES[action].name}` : moveName(f, pick)} missed.`, { side, type: 'miss', move: pick });
      f.weaponBonus = 0; endActor(side); return;
    }
    const offensive = !['CURSE_SWALLOW', 'RYU_ULTIMATE', 'DIVINE_DOGS', 'MAHORAGA'].includes(action);
    if (guarding[1 - side] && offensive && !isUltimate) {
      // A blocked attempt still earns its normal meter; reward the attacker
      // with a second copy of that award for being blocked.
      gain(f, normalMeterAward + characterMeterBonus, side);
      say(`${who(foe)} blocked it!`, { side: 1 - side, type: 'blocked' });
      f.weaponBonus = 0; endActor(side); return;
    }
    resolveHit(side, action, copied, spentMeter, stacks, graniteDamage);
    f.weaponBonus = 0;
    checkFaint();
    if (state.over) return;
    endActor(side);
  }
  function resolveHit(side, action, copied, spentMeter, stacks, graniteDamage) {
    const f = state.sides[side], foe = state.sides[1 - side];
    const foeSide = 1 - side;
    const hitKind = copied || action.endsWith('ULTIMATE') || action === 'HOLLOW_PURPLE' ? 'ultimate'
      : action === 'BASIC_PUNCH' || action === 'CURSED_FISTS' ? 'basic' : action === 'MAHORAGA_STRIKE' ? 'basic' : 'technique';
    let damage = f.mahoraga ? 30 : action === 'BASIC_PUNCH' ? f.id === 'sukuna' ? 5 : f.id === 'toji' ? 15 : 10
      : action === 'MAHORAGA_STRIKE' ? 30 : MOVES[action]?.power ?? 0;
    let utility = false;
    if (action === 'CURSED_TOOLS') {
      damage = [30, 35, 40][Math.min(2, Math.floor(random() * 3))];
      if (random() < 0.33) { foe.weaponBonus = 10; say('The enemy picked up a cursed tool: +10 damage on their next turn.', { side, type: 'passive' }); }
    }
    if (action === 'CURSE_SWALLOW') {
      utility = true;
      const recovered = heal(f, 30); f.cursePause = 2;
      say(`Curse Swallow heals up to 30 HP. No new curses for two turns.`, { side, type: 'heal', amount: recovered });
    }
    if (action === 'GETO_ULTIMATE') {
      const grades = Array.from({ length: 10 }, () => { const r = random(); return r < .25 ? 3 : r < .65 ? 2 : r < .90 ? 1 : 'special'; });
      const sum = grades.reduce((n, grade) => n + (grade === 3 ? 5 : grade === 2 ? -5 : grade === 1 ? 10 : 0), 0);
      const raw = Math.max(0, sum * 2 ** grades.filter((g) => g === 'special').length);
      damage = Math.floor(raw);
      say(`Uzumaki spirits: ${grades.join(', ')} → ${damage} damage.`, { side, type: 'passive', amount: damage });
    }
    if (action === 'RIKA') {
      damage = 20;
      const stolen = Math.min(15, foe.ce);
      gain(foe, -stolen, foeSide); gain(f, stolen, side);
      say(`Rika steals ${stolen} meter.`, { side, type: 'passive', amount: stolen });
    }
    if (action === 'CLEAVE') damage = 15 + 10 * f.fingers;
    if (action === 'SUKUNA_ULTIMATE') damage = 15 * Math.floor(spentMeter / 30);
    if (action === 'CHOSO_ULTIMATE') {
      damage = 40;
      foe.bloodBlindTurns = 1;
      foe.bleedingTurns = 2;
      foe.bleed = 2;
      foe.supernovaBleedDamage = stacks * 2;
    }
    if (action === 'GRANITE_BLAST') damage = graniteDamage;
    if (action === 'RYU_ULTIMATE') {
      utility = true;
      const recovered = heal(f, copied ? 32 : 40); f.graniteDamage = 30;
      say(`Way Too Sweet! Recovered up to ${copied ? 32 : 40} HP and restored Granite Blast to 30 damage.`, { side, type: 'heal', amount: recovered });
    }
    if (action === 'PIERCING_BLOOD') {
      const recent = foe.id === 'megumi' && !foe.mahoraga && foe.lastShikigamiTurn !== null && state.turn - foe.lastShikigamiTurn <= 1;
      damage = recent ? 35 : 20;
      if (recent) say('Piercing Blood pierces the recent shikigami summon: +15 damage.', { side, type: 'passive' });
    }
    if ((action === 'DIVINE_DOGS' || action === 'NUE') && f.id === 'megumi') f.lastShikigamiTurn = state.turn;
    if (action === 'REVERSAL_RED') damage = 20;
    if (action === 'AMPLIFICATION_BLUE') { damage = 10; gain(foe, -20, foeSide); }
    if (action === 'GOJO_ULTIMATE') { damage = 40; foe.voidAttacks = 2; }
    if (action === 'HOLLOW_PURPLE') damage = 100;
    if (action === 'DIVINE_DOGS') {
      utility = true;
      const recovered = heal(f, 20); f.dogsTurns = 3;
      say('Demon Dogs summoned for 3 turns. Recovered up to 20 HP.', { side, type: 'heal', amount: recovered });
    }
    if (action === 'NUE') damage = [15, 20, 30, 5][Math.min(3, Math.floor(random() * 4))];
    if (action === 'MEGUMI_ULTIMATE') {
      damage = 20;
      const summon = random() < 0.5 ? 'NUE' : 'DIVINE_DOGS';
      f.usedSummons = f.usedSummons.filter((move) => move !== summon);
      if (copied && !f.borrowedSummons.includes(summon)) f.borrowedSummons.push(summon);
      say(`Chimera Shadow Garden refreshes ${MOVES[summon].name}.`, { side, type: 'passive', move: summon });
    }
    if (action === 'MAHORAGA') {
      utility = true; f.summonCountdown = 3;
      say('Mahoraga summoning begins. Megumi can fight during the three-turn delay.', { side, type: 'mahoraga' });
    }
    if (copied) damage = Math.floor((damage + (['MEGUMI_ULTIMATE', 'SUKUNA_ULTIMATE', 'CHOSO_ULTIMATE'].includes(action) ? 10 : 0)) * 0.8);

    let dealt = 0;
    if (action === 'YUJI_ULTIMATE') {
      const hits = foe.id === 'toji' ? [10, 10, 10, 10] : Array.from({ length: 4 }, () => random() < 0.33 ? 20 : 10);
      const flashes = hits.filter((n) => n === 20).length;
      if (flashes && !copied) passive(f, side);
      dealt = hits.reduce((total, hit, index) => total + applyDamage(foeSide, (copied ? Math.floor(hit * 0.8) : hit) + (index === 0 ? f.weaponBonus : 0), 'ultimate', f), 0);
      say(`Straight Hands: four punches, ${flashes} Black Flash hit(s).`, { side, type: flashes ? 'black-flash' : 'move', amount: dealt });
    } else if (!utility && damage > 0) {
      if (f.id === 'yuji' && (action === 'CURSED_FISTS' ? random() < 0.5 : action === 'BASIC_PUNCH' && foe.id !== 'toji' && random() < 0.33)) {
        damage *= 2; passive(f, side);
        say('Black Flash! Double punch damage.', { side, type: 'black-flash' });
      }
      dealt = recordDamage(foeSide, damage + (f.weaponBonus && damage > 0 ? f.weaponBonus : 0), action, hitKind, f, side);
    }
    if (action === 'CHOSO_ULTIMATE') say(`Supernova consumes ${stacks} blood stack(s): ${stacks * 2} damage per turn for 2 turns, plus one turn wiping blood.`, { side, type: 'passive' });
    if (action === 'RYU_ULTIMATE' || action === 'CURSE_SWALLOW' || action === 'DIVINE_DOGS' || action === 'MAHORAGA') return;
    if (damage > 0 || ['BASIC_PUNCH', 'CURSED_FISTS', 'GRANITE_BLAST', 'CURSED_TOOLS', 'NUE', 'PIERCING_BLOOD', 'REVERSAL_RED', 'AMPLIFICATION_BLUE', 'GOJO_ULTIMATE', 'HOLLOW_PURPLE', 'SUKUNA_ULTIMATE', 'CHOSO_ULTIMATE', 'GETO_ULTIMATE', 'RIKA', 'CLEAVE', 'MEGUMI_ULTIMATE', 'YUJI_ULTIMATE'].includes(action)) {
      say(`${copied ? `Copy: ${MOVES[action].name}` : moveName(f, action)} dealt ${dealt} damage.`, { side, type: 'move-result', amount: dealt, move: action });
    }
  }
  function endActor(side) {
    const f = state.sides[side], foe = state.sides[1 - side];
    if (f.dogsTurns > 0) {
      f.dogsTurns--;
      const dealt = applyDamage(1 - side, 5, 'technique', f);
      say(`Demon Dogs bite for ${dealt} damage. ${f.dogsTurns} turn(s) remain.`, { side, type: 'passive', amount: dealt });
      checkFaint();
      if (state.over) return;
    }
    if (f.id === 'sukuna' && f.ownTurns % 3 === 0 && f.fingers < 5 && f.hp > 0) {
      f.fingers++; f.maxHp += 10; f.hp = Math.min(f.maxHp, f.hp + 10); gain(f, 10, side); passive(f, side);
      say(`Finger Lickin’: Sukuna ate finger ${f.fingers}/5, gained 10 HP and 10 meter. Cleave now deals ${15 + 10 * f.fingers}.`, { side, type: 'passive' });
    }
    // Count completed enemy turns after the summon begins. This handles both
    // initiative orders, including an enemy that acts before Megumi summons.
    if (foe.summonCountdown !== null && foe.summonCountdown > 0) {
      foe.summonCountdown--;
      if (foe.summonCountdown === 0) transformMahoraga(foe, 1 - side);
    }
    if (foe.hp <= 0 || f.hp <= 0) checkFaint();
  }
}

function who(f) { return f.mahoraga ? 'Mahoraga' : f.name; }

/** Which visual effect to play for an input (online/solo effect layers use these ids). */
export function effectFor(f, pick) {
  if (pick === 'GUARD') return 'BLOCK';
  if (f.mahoraga) return 'MAHORAGA';
  return pick;
}

/** Computer opponent: sensible, slightly random choices from the legal options. */
export function chooseMove(state, side, random = Math.random) {
  const f = state.sides[side];
  const foe = state.sides[1 - side];
  const legal = moveOptions(state, side).filter((o) => o.reason === null).map((o) => o.id);
  const has = (id) => legal.includes(id);
  if (has('MAHORAGA')) return 'MAHORAGA';
  const ultimate = legal.find((id) => MOVES[moveFor(f, id)].kind === 'ultimate');
  if (ultimate && random() < 0.85) return ultimate;
  if (has('HOLLOW_PURPLE') && random() < 0.7) return 'HOLLOW_PURPLE';
  if (has('CURSE_SWALLOW') && f.hp < f.maxHp * 0.55 && random() < 0.6) return 'CURSE_SWALLOW';
  if (has('GUARD') && (foe.ce >= 100 || (state.domain && state.domain.owner !== side)) && random() < 0.3) return 'GUARD';
  const attacks = legal.filter((id) => id !== 'GUARD' && MOVES[moveFor(f, id)].power > 0 && MOVES[moveFor(f, id)].kind !== 'ultimate');
  if (!attacks.length) return 'BASIC_PUNCH';
  // Cursed energy is worth a little when saving toward an ultimate that is not affordable yet.
  const saving = !f.mahoraga && CHARACTERS[f.id].moves.some((id) => MOVES[id].kind === 'ultimate') && f.ce < BASE.ceMax - BASE.ceRegen;
  const ceValue = saving ? AI.ceValue : 0.1;
  const value = (id) => { const m = MOVES[moveFor(f, id)]; return m.power * m.accuracy / 100 - m.cost * ceValue + (m.kind === 'strike' ? BASE.strikeCe * ceValue : 0); };
  // Softmax: better moves are likelier, but every attack gets used sometimes.
  const best = Math.max(...attacks.map(value));
  const weights = attacks.map((id) => Math.exp((value(id) - best) / AI.temperature));
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  for (const [i, id] of attacks.entries()) if ((roll -= weights[i]) <= 0) return id;
  return attacks[attacks.length - 1];
}

/** Computer opponent tuning (exported so the balance script can vary it). */
export const AI = { ceValue: 0.4, temperature: 8 };
