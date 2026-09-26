import type {
  FingerName,
  GestureCheck,
  GestureContext,
  GestureDefinition,
  GestureEvaluation,
  HandAnalysis,
} from './GestureTypes';
import {
  crossHandDistanceInPalms,
  FINGER_BEND_THRESHOLDS,
  fingerSpread,
  handOverlap,
  indexMiddleCrossing,
  pairAspect,
  palmDistanceInPalms,
  ramp,
  thumbRaise,
  tipGapInPalms,
  tipsInOtherHand,
  uprightness,
  wristDistanceInPalms,
  wristsBelowFingers,
} from './HandGeometry';
import { GestureKnnModel } from './GestureKnnModel';
import { lenient } from './GestureTolerance';
import { HandLandmarkIndex as L } from './HandTypes';

/**
 * Shared model trained from the recorded gesture dataset (see main.ts).
 * Learned gestures use it once they have enough samples of their label.
 */
export const LEARNED_MODEL = new GestureKnnModel();

/**
 * Domain Expansion hand signs, following the JJK hand-sign reference guide
 * (numbers match the guide). Every sign triggers DOMAIN_EXPANSION; the event
 * carries which sign it was, so each can map to a different character.
 *
 * Only signs a single webcam can tell apart reliably are included. Skipped:
 *  #3, #5, #7, #9 - interlocked/crossed straight fingers; from the front they
 *                   collapse into the same blob as #1, #4 or #12.
 *  #8  - nearly identical to #1 (index fingers up, together).
 *  #11 - side view with one hand hidden under the other.
 *  #13 - crossed forearms make MediaPipe mix up left and right.
 *
 * Every sign is a list of named checks scored 0..1; the sign's score is its
 * weakest check, so the debug panel shows exactly which condition failed.
 * Distances are in palm sizes, so hand size and camera distance do not matter.
 * All tolerances live in SIGN_TUNING.
 */

type Range = { zeroAt: number; oneAt: number };

export const SIGN_TUNING = {
  /** Finger bend (deg) counting as "bent" for signs where fingers curl but are not a tight fist. */
  bentFinger: { zeroAt: 90, oneAt: 135 } as Range,
  /** Two fingertips "touching" (palm sizes). */
  tipsTouch: { zeroAt: 0.7, oneAt: 0.35 } as Range,
  malevolentShrine: {
    handsTogether: { zeroAt: 3.0, oneAt: 2.0 } as Range,
  },
  unlimitedVoid: {
    /** Tip side-swap (palm sizes): 0 = side by side, positive = crossed. */
    crossing: { zeroAt: 0.0, oneAt: 0.06 } as Range,
  },
  /** Rule used for Cleave until it has enough recorded samples. */
  cleaveFallback: {
    /** Index/middle tip gap (world palm sizes): together, unlike a V sign. */
    tipGap: { zeroAt: 0.5, oneAt: 0.3 } as Range,
    /** Must NOT be crossed (that is Unlimited Void): 1 when side by side. */
    notCrossed: { zeroAt: 0.03, oneAt: -0.02 } as Range,
  },
  chimeraShadowGarden: {
    /** Hold a little longer: this is the big move and the pose takes a moment to settle. */
    holdMs: 650,
    /** Average bend of all 8 fingers (deg): curled/hooked, unlike a prayer pose. REQUIRED. */
    curl: { zeroAt: 85, oneAt: 135 } as Range,
    /** Palm-centre distance (palm sizes). REQUIRED. */
    palmDistance: { zeroAt: 2.6, oneAt: 1.5 } as Range,
    wristDistance: { zeroAt: 3.0, oneAt: 1.8 } as Range,
    /** Bounding-box overlap as a fraction of the smaller hand. */
    overlap: { zeroAt: 0.1, oneAt: 0.4 } as Range,
    /** Fraction of the 8 fingertips inside the other hand's box. */
    tipsCrossOver: { zeroAt: 0.1, oneAt: 0.4 } as Range,
    /** Average |palm normal . x|: palms turned inward toward each other. REQUIRED. */
    palmsInward: { zeroAt: 0.2, oneAt: 0.55 } as Range,
    /** Wrists below the fingertip cluster (palm sizes). */
    wristsBelow: { zeroAt: 0.1, oneAt: 0.5 } as Range,
    /** Height / width of both hands together. */
    vertical: { zeroAt: 0.5, oneAt: 0.9 } as Range,
    /** A required check below this counts as failed and scales the total down. */
    requiredPass: 0.6,
  },
  authenticMutualLove: {
    /** Average neighbouring-fingertip gap of the flat hand (world palm sizes). */
    fingersTogether: { zeroAt: 0.5, oneAt: 0.3 } as Range,
    flatHandUpright: { zeroAt: 0.4, oneAt: 0.75 } as Range,
    handsNear: { zeroAt: 4.5, oneAt: 3.0 } as Range,
  },
  timeCellMoonPalace: {
    /** Thumb tip above the index knuckle (palm sizes). */
    thumbUp: { zeroAt: 0.1, oneAt: 0.4 } as Range,
    fistsTogether: { zeroAt: 2.8, oneAt: 1.8 } as Range,
  },
  selfEmbodiment: {
    /** Index tips (top) and thumb tips (bottom) touch with a hole between: palms apart. */
    palmsApart: { zeroAt: 0.6, oneAt: 1.1 } as Range,
  },
  ryuDiamond: {
    /** Palms must stay apart so the diamond has a hole (palm sizes). */
    palmsApart: { zeroAt: 0.8, oneAt: 1.3 } as Range,
  },
  learned: {
    /** Recorded samples of a label needed before the learned matcher replaces the fallback rule. */
    minSamples: 20,
    /** Share of the k nearest recorded samples that must carry the label. */
    votes: { zeroAt: 0.3, oneAt: 0.8 } as Range,
    /**
     * Distance to the closest recorded sample (weighted RMS, palm sizes).
     * Re-doing the same pose measures ~0.05-0.15; a different hand shape ~0.35+.
     * This is the main guard when there are few NONE samples.
     */
    closeness: { zeroAt: 0.35, oneAt: 0.18 } as Range,
    /**
     * The closeness range is widened to fit the player's own recordings: full
     * credit up to how far separate recorded attempts land from each other
     * (measured per sign), zero at twice that. Capped so a sloppy recording
     * cannot make a sign accept anything.
     */
    maxCalibratedCloseness: 0.45,
    /** Signs with at least this many samples are "trusted": the dataset wins. */
    trustedSamples: 500,
    /** Trusted signs: a majority of the nearest samples is a full match... */
    trustedVotes: { zeroAt: 0.15, oneAt: 0.5 } as Range,
    /** ...and the closeness range is this much wider. */
    trustedClosenessScale: 1.25,
  },
  /** Rule used for Piercing Blood until it has enough recorded samples. */
  piercingBloodFallback: {
    /** Pressed palms measure ~0.3-0.6; open hands side by side ~1.2+. */
    palmsTogether: { zeroAt: 1.1, oneAt: 0.7 } as Range,
    indexTipsTogether: { zeroAt: 0.9, oneAt: 0.5 } as Range,
  },
};

const T = SIGN_TUNING;
const FOUR_FINGERS: FingerName[] = ['index', 'middle', 'ring', 'pinky'];
const CURLED_FINGERS: FingerName[] = ['middle', 'ring', 'pinky'];

// ---------- check helpers ----------

function check(label: string, score: number, detail: string): GestureCheck {
  return { label, score, detail };
}

function evaluation(checks: GestureCheck[]): GestureEvaluation {
  return { score: checks.reduce((min, c) => Math.min(min, c.score), 1), checks };
}

/**
 * Score = weighted average of all checks, scaled down if a required check
 * fails. Tolerates a few unreliable (occluded) measurements, while the
 * required checks still veto look-alike poses.
 */
function weightedEvaluation(checks: GestureCheck[], requiredPass: number): GestureEvaluation {
  let sum = 0;
  let weights = 0;
  let gate = 1;
  for (const c of checks) {
    const w = c.weight ?? 1;
    sum += c.score * w;
    weights += w;
    if (c.required) gate = Math.min(gate, Math.min(1, c.score / requiredPass));
  }
  return { score: weights > 0 ? (sum / weights) * gate : 0, checks };
}

/** Scores a measurement against a tuned range, loosened by GESTURE_TOLERANCE. */
function r(value: number, range: Range): number {
  const { zeroAt, oneAt } = lenient(range.zeroAt, range.oneAt);
  return ramp(value, zeroAt, oneAt);
}

type FingerScore = (h: HandAnalysis, f: FingerName) => number;
/** Bend (deg) at which a finger is fully straight / fully folded, per finger type. */
function bendLimits(f: FingerName): { straight: number; folded: number } {
  const t = FINGER_BEND_THRESHOLDS;
  return f === 'thumb'
    ? { straight: t.thumbExtendedMaxDeg, folded: t.thumbFoldedMinDeg }
    : { straight: t.extendedMaxDeg, folded: t.foldedMinDeg };
}
// "Straight" and "folded" are each loosened separately, so both requirements forgive bad form.
const extended: FingerScore = (h, f) => {
  const { straight, folded } = bendLimits(f);
  return r(h.fingers[f].bendDeg, { zeroAt: folded, oneAt: straight });
};
const folded: FingerScore = (h, f) => {
  const { straight, folded } = bendLimits(f);
  return r(h.fingers[f].bendDeg, { zeroAt: straight, oneAt: folded });
};
const bent: FingerScore = (h, f) => r(h.fingers[f].bendDeg, T.bentFinger);

/** One check covering several fingers on several hands; reports the worst finger. */
function fingers(label: string, hands: HandAnalysis[], names: FingerName[], score: FingerScore): GestureCheck {
  let worst = { score: Infinity, detail: '' };
  hands.forEach((h, i) => {
    for (const f of names) {
      const s = score(h, f);
      if (s < worst.score) {
        const who = hands.length > 1 ? `hand${i + 1} ` : '';
        worst = { score: s, detail: `worst: ${who}${f} bend ${h.fingers[f].bendDeg.toFixed(0)}°` };
      }
    }
  });
  return check(label, Number.isFinite(worst.score) ? worst.score : 0, worst.detail);
}

function distanceCheck(label: string, value: number, range: Range, unit = 'palms'): GestureCheck {
  return check(label, r(value, range), `${value.toFixed(2)} ${unit}`);
}

const needHands = (want: number, have: number) =>
  evaluation([check(`${want} hand${want > 1 ? 's' : ''} visible`, 0, `${have} visible`)]);

/** Two-hand sign: evaluates with the hands in both orders and keeps the better. */
function twoHands(ctx: GestureContext, evaluatePair: (a: HandAnalysis, b: HandAnalysis) => GestureCheck[], symmetric = true): GestureEvaluation {
  if (ctx.hands.length < 2) return needHands(2, ctx.hands.length);
  const [a, b] = ctx.hands;
  const first = evaluation(evaluatePair(a, b));
  if (symmetric) return first;
  const second = evaluation(evaluatePair(b, a));
  return second.score > first.score ? second : first;
}

/** One-hand sign: evaluates every visible hand and keeps the best. */
function anyHand(ctx: GestureContext, evaluateHand: (h: HandAnalysis) => GestureCheck[]): GestureEvaluation {
  if (ctx.hands.length === 0) return needHands(1, 0);
  let best: GestureEvaluation | null = null;
  for (const h of ctx.hands) {
    const e = evaluation([check('hand', 1, h.hand.handedness), ...evaluateHand(h)]);
    if (!best || e.score > best.score) best = e;
  }
  return best!;
}

// ---------- signs ----------

/** #1 Malevolent Shrine: index fingers up with the tips touching (a peak), other fingers bent. */
const MALEVOLENT_SHRINE: GestureDefinition = {
  id: 'malevolent-shrine',
  datasetLabel: 'MALEVOLENT_SHRINE',
  action: 'DOMAIN_EXPANSION',
  name: 'Malevolent Shrine',
  character: 'Sukuna',
  guideNumber: 1,
  sign: 'Both index fingers straight, tips touching; other fingers bent',
  evaluate: (ctx) =>
    twoHands(ctx, (a, b) => [
      fingers('index fingers straight', [a, b], ['index'], extended),
      fingers('other fingers bent', [a, b], CURLED_FINGERS, bent),
      distanceCheck('index tips touch', crossHandDistanceInPalms(a, L.INDEX_TIP, b, L.INDEX_TIP), T.tipsTouch),
      distanceCheck('hands together', palmDistanceInPalms(a, b), T.malevolentShrine.handsTogether),
    ]),
};

/** #2 Unlimited Void: one hand, index and middle straight and crossed. */
const UNLIMITED_VOID: GestureDefinition = {
  id: 'unlimited-void',
  datasetLabel: 'UNLIMITED_VOID',
  action: 'DOMAIN_EXPANSION',
  name: 'Unlimited Void',
  character: 'Gojo',
  guideNumber: 2,
  sign: 'One hand: index + middle up and crossed, ring + pinky folded',
  evaluate: (ctx) =>
    anyHand(ctx, (h) => [
      fingers('index + middle up', [h], ['index', 'middle'], extended),
      fingers('ring + pinky folded', [h], ['ring', 'pinky'], folded),
      distanceCheck('fingers crossed', indexMiddleCrossing(h), T.unlimitedVoid.crossing),
    ]),
};

/**
 * #4 Chimera Shadow Garden (Megumi): both hands pressed together, palms
 * turned inward, fingers curled and interlocked over each other near the
 * centre, wrists below, a compact vertical silhouette.
 *
 * Interlocked fingers hide each other from one webcam, so no single
 * fingertip is trusted. Instead several structural checks are combined into
 * a weighted score. Three are REQUIRED and veto the pose when they fail:
 *  - fingers curled: separates it from a prayer pose (fingers straight),
 *    which otherwise passes most structural checks;
 *  - palms close: the sign only exists with the hands together;
 *  - palms face inward: separates it from two fists pressed together facing
 *    the camera, which overlap just as much. Palm orientation comes from the
 *    wrist and knuckles, which stay visible when the fingers interlock.
 */
const CHIMERA_SHADOW_GARDEN: GestureDefinition = {
  id: 'chimera-shadow-garden',
  datasetLabel: 'CHIMERA_SHADOW_GARDEN',
  action: 'DOMAIN_EXPANSION',
  name: 'Chimera Shadow Garden',
  character: 'Megumi',
  guideNumber: 4,
  sign: 'Hands together, palms inward, fingers curled and interlocked, wrists below',
  holdMs: T.chimeraShadowGarden.holdMs,
  evaluate(ctx) {
    if (ctx.hands.length < 2) return needHands(2, ctx.hands.length);
    const t = T.chimeraShadowGarden;
    const [a, b] = ctx.hands;
    const label = (h: HandAnalysis) => h.hand.handedness[0];
    const bends = (h: HandAnalysis) => FOUR_FINGERS.map((f) => h.fingers[f].bendDeg.toFixed(0)).join('/');
    const avgBend = [a, b].flatMap((h) => FOUR_FINGERS.map((f) => h.fingers[f].bendDeg)).reduce((x, y) => x + y) / 8;
    const palmDist = palmDistanceInPalms(a, b);
    const wristDist = wristDistanceInPalms(a, b);
    const overlap = handOverlap(a, b);
    const tips = tipsInOtherHand(a, b);
    const inwardA = Math.abs(a.palmNormal.x);
    const inwardB = Math.abs(b.palmNormal.x);
    const below = wristsBelowFingers(a, b);
    const aspect = pairAspect(a, b);
    return weightedEvaluation(
      [
        {
          ...check('fingers curled', r(avgBend, t.curl), `avg ${avgBend.toFixed(0)}° (${label(a)} ${bends(a)} | ${label(b)} ${bends(b)})`),
          weight: 2,
          required: true,
        },
        { ...distanceCheck('palms close', palmDist, t.palmDistance), weight: 2, required: true },
        { ...distanceCheck('wrists close', wristDist, t.wristDistance), weight: 1 },
        { ...check('hands overlap', r(overlap, t.overlap), `${(overlap * 100).toFixed(0)}% of smaller hand`), weight: 1.5 },
        { ...check('fingers cross into other hand', r(tips, t.tipsCrossOver), `${Math.round(tips * 8)}/8 tips`), weight: 1.5 },
        {
          ...check('palms face inward', r((inwardA + inwardB) / 2, t.palmsInward), `${inwardA.toFixed(2)} / ${inwardB.toFixed(2)}`),
          weight: 1.5,
          required: true,
        },
        { ...distanceCheck('wrists below fingers', below, t.wristsBelow), weight: 1 },
        { ...check('vertical silhouette', r(aspect, t.vertical), `h/w ${aspect.toFixed(2)}`), weight: 0.5 },
      ],
      t.requiredPass,
    );
  },
};

/** #6 Authentic Mutual Love: one flat upright hand with fingers together, the other a fist. */
const AUTHENTIC_MUTUAL_LOVE: GestureDefinition = {
  id: 'authentic-mutual-love',
  datasetLabel: 'AUTHENTIC_MUTUAL_LOVE',
  action: 'DOMAIN_EXPANSION',
  name: 'Authentic Mutual Love',
  character: 'Yuta',
  guideNumber: 6,
  sign: 'One hand flat and upright, fingers together; other hand a fist',
  evaluate: (ctx) =>
    twoHands(
      ctx,
      (flat, fist) => {
        const t = T.authenticMutualLove;
        const up = uprightness(flat);
        return [
          fingers('flat hand: fingers straight', [flat], FOUR_FINGERS, extended),
          distanceCheck('flat hand: fingers together', fingerSpread(flat), t.fingersTogether),
          check('flat hand: upright', r(up, t.flatHandUpright), `upright ${up.toFixed(2)}`),
          fingers('other hand: fist', [fist], FOUR_FINGERS, folded),
          distanceCheck('hands near', palmDistanceInPalms(flat, fist), t.handsNear),
        ];
      },
      false,
    ),
};

/** #10 Time Cell Moon Palace: two fists pressed together, thumbs up and touching. */
const TIME_CELL_MOON_PALACE: GestureDefinition = {
  id: 'time-cell-moon-palace',
  datasetLabel: 'TIME_CELL_MOON_PALACE',
  action: 'DOMAIN_EXPANSION',
  name: 'Time Cell Moon Palace',
  character: "Naoya Zen'in",
  guideNumber: 10,
  sign: 'Two fists pressed together, thumbs up and touching',
  evaluate: (ctx) =>
    twoHands(ctx, (a, b) => {
      const t = T.timeCellMoonPalace;
      const up = Math.min(thumbRaise(a), thumbRaise(b));
      return [
        fingers('both fists', [a, b], FOUR_FINGERS, folded),
        check('thumbs up', r(up, t.thumbUp), `lowest thumb ${up.toFixed(2)} palms above knuckle`),
        distanceCheck('thumb tips touch', crossHandDistanceInPalms(a, L.THUMB_TIP, b, L.THUMB_TIP), T.tipsTouch),
        distanceCheck('fists together', palmDistanceInPalms(a, b), t.fistsTogether),
      ];
    }),
};

/** #12 Ryu Ishigori's domain: open hands, index tips and thumb tips touch, forming a diamond. */
const RYU_DIAMOND: GestureDefinition = {
  id: 'ryu-ishigori-domain',
  datasetLabel: 'RYU_ISHIGORI_DOMAIN',
  action: 'DOMAIN_EXPANSION',
  name: "Ryu Ishigori's Domain",
  character: 'Ryu Ishigori',
  guideNumber: 12,
  sign: 'Open hands: index tips touch and thumb tips touch, forming a diamond',
  evaluate: (ctx) =>
    twoHands(ctx, (a, b) => [
      fingers('fingers straight', [a, b], FOUR_FINGERS, extended),
      distanceCheck('index tips touch', crossHandDistanceInPalms(a, L.INDEX_TIP, b, L.INDEX_TIP), T.tipsTouch),
      distanceCheck('thumb tips touch', crossHandDistanceInPalms(a, L.THUMB_TIP, b, L.THUMB_TIP), T.tipsTouch),
      distanceCheck('diamond hole (palms apart)', palmDistanceInPalms(a, b), T.ryuDiamond.palmsApart),
    ]),
};

/**
 * Cleave (Sukuna): one hand, "sword fingers" - index and middle straight and
 * together, ring and pinky folded. Normally learned from the CLEAVE samples.
 */
const CLEAVE: GestureDefinition = {
  id: 'cleave',
  datasetLabel: 'CLEAVE',
  action: 'PRIMARY_ATTACK',
  name: 'Cleave',
  character: 'Sukuna',
  sign: 'One hand: index + middle straight and together, ring + pinky folded',
  evaluate: (ctx) =>
    anyHand(ctx, (h) => {
      const t = T.cleaveFallback;
      const cross = indexMiddleCrossing(h);
      return [
        fingers('index + middle straight', [h], ['index', 'middle'], extended),
        fingers('ring + pinky folded', [h], ['ring', 'pinky'], folded),
        distanceCheck('index + middle together', tipGapInPalms(h, L.INDEX_TIP, L.MIDDLE_TIP), t.tipGap),
        distanceCheck('not crossed', cross, t.notCrossed),
      ];
    }),
};

/** Piercing Blood (Choso): palms pressed together (prayer), fingers straight. */
const PIERCING_BLOOD: GestureDefinition = {
  id: 'piercing-blood',
  datasetLabel: 'PIERCING_BLOOD',
  action: 'SECONDARY_ATTACK',
  name: 'Piercing Blood',
  character: 'Choso',
  sign: 'Both palms pressed together, fingers straight',
  evaluate(ctx) {
    return twoHands(ctx, (a, b) => {
      const t = T.piercingBloodFallback;
      return [
        fingers('fingers straight', [a, b], FOUR_FINGERS, extended),
        distanceCheck('palms together', palmDistanceInPalms(a, b), t.palmsTogether),
        distanceCheck('index tips together', crossHandDistanceInPalms(a, L.INDEX_TIP, b, L.INDEX_TIP), t.indexTipsTogether),
      ];
    });
  },
};

/**
 * #5 Self-Embodiment of Perfection (Mahito): index fingertips touch on top,
 * thumb tips touch below, the other fingers bent/interlaced, leaving a hole
 * between the palms.
 */
const SELF_EMBODIMENT_OF_PERFECTION: GestureDefinition = {
  id: 'self-embodiment-of-perfection',
  datasetLabel: 'SELF_EMBODIMENT_OF_PERFECTION',
  action: 'DOMAIN_EXPANSION',
  name: 'Self-Embodiment of Perfection',
  character: 'Mahito',
  guideNumber: 5,
  sign: 'Index tips touch on top, thumb tips touch below, other fingers bent, hole between palms',
  evaluate: (ctx) =>
    twoHands(ctx, (a, b) => [
      fingers('index fingers straight', [a, b], ['index'], extended),
      fingers('other fingers bent', [a, b], CURLED_FINGERS, bent),
      distanceCheck('index tips touch', crossHandDistanceInPalms(a, L.INDEX_TIP, b, L.INDEX_TIP), T.tipsTouch),
      distanceCheck('thumb tips touch', crossHandDistanceInPalms(a, L.THUMB_TIP, b, L.THUMB_TIP), T.tipsTouch),
      distanceCheck('hole between palms', palmDistanceInPalms(a, b), T.selfEmbodiment.palmsApart),
    ]),
};

/**
 * A move with no built-in rule: it is learned purely from the player's
 * recorded samples of its datasetLabel ("teach it by recording it").
 */
function taughtMove(def: Omit<GestureDefinition, 'evaluate'>): GestureDefinition {
  return {
    ...def,
    taughtOnly: true,
    evaluate: () => evaluation([check('no built-in rule', 0, 'this move is learned from your recordings only')]),
  };
}

const TAUGHT_MOVES: GestureDefinition[] = [
  taughtMove({
    id: 'lapse-blue',
    datasetLabel: 'LAPSE_BLUE',
    action: 'PRIMARY_ATTACK',
    name: 'Lapse: Blue',
    character: 'Gojo',
    sign: 'Your own sign - record LAPSE_BLUE samples to teach it',
  }),
  taughtMove({
    id: 'reversal-red',
    datasetLabel: 'REVERSAL_RED',
    action: 'SECONDARY_ATTACK',
    name: 'Reversal: Red',
    character: 'Gojo',
    sign: 'Your own sign - record REVERSAL_RED samples to teach it',
  }),
  taughtMove({
    id: 'dismantle',
    datasetLabel: 'DISMANTLE',
    action: 'SECONDARY_ATTACK',
    name: 'Dismantle',
    character: 'Sukuna',
    sign: 'Your own sign - record DISMANTLE samples to teach it',
  }),
  taughtMove({
    id: 'divine-dogs',
    datasetLabel: 'DIVINE_DOGS',
    action: 'PRIMARY_ATTACK',
    name: 'Divine Dogs',
    character: 'Megumi',
    sign: 'Shadow-dog hand sign - record DIVINE_DOGS samples to teach it',
  }),
  taughtMove({
    id: 'nue',
    datasetLabel: 'NUE',
    action: 'SECONDARY_ATTACK',
    name: 'Nue',
    character: 'Megumi',
    sign: 'Shadow-bird hand sign - record NUE samples to teach it',
  }),
  taughtMove({
    id: 'idle-transfiguration',
    datasetLabel: 'IDLE_TRANSFIGURATION',
    action: 'PRIMARY_ATTACK',
    name: 'Idle Transfiguration',
    character: 'Mahito',
    sign: 'Your own sign - record IDLE_TRANSFIGURATION samples to teach it',
  }),
  taughtMove({
    id: 'polymorphic-soul-isomer',
    datasetLabel: 'POLYMORPHIC_SOUL_ISOMER',
    action: 'SECONDARY_ATTACK',
    name: 'Polymorphic Soul Isomer',
    character: 'Mahito',
    sign: 'Your own sign - record POLYMORPHIC_SOUL_ISOMER samples to teach it',
  }),
];

/**
 * Makes any sign learnable. Once the dataset holds at least
 * SIGN_TUNING.learned.minSamples samples of the sign's datasetLabel, the
 * sign is matched against those recordings (k nearest neighbours); samples
 * of NONE and of every other sign act as counter-examples. Until then the
 * sign's hand-written rules are used. Applied to every sign below, so new
 * signs get this automatically.
 */
function withLearning(def: GestureDefinition): GestureDefinition {
  const label = def.datasetLabel;
  return {
    ...def,
    evaluate(ctx) {
      const t = T.learned;
      const n = LEARNED_MODEL.countFor(label);
      if (n < t.minSamples) {
        const rules = def.evaluate(ctx);
        const mode = check('mode: rules', 1, `record ${t.minSamples - n} more ${label} samples to learn it`);
        return { score: rules.score, checks: [mode, ...rules.checks] };
      }
      const trusted = n >= t.trustedSamples;
      const hands = LEARNED_MODEL.handsFor(label);
      const mode = check(
        trusted ? 'mode: learned (trusted)' : 'mode: learned',
        1,
        `${n} ${label} samples, ${hands} hand${hands > 1 ? 's' : ''}`,
      );
      // Compare with every detected hand, exactly as the recorder saved them.
      const live = ctx.allHands;
      if (live.length !== hands) return evaluation([mode, ...needHands(hands, live.length).checks]);

      const knn = LEARNED_MODEL.classify(label, live);
      const spread = Math.min(LEARNED_MODEL.spreadFor(label), t.maxCalibratedCloseness);
      const scale = trusted ? t.trustedClosenessScale : 1;
      const closeness: Range = {
        oneAt: Math.max(t.closeness.oneAt, spread) * scale,
        zeroAt: Math.max(t.closeness.zeroAt, spread * 2) * scale,
      };
      const votes = trusted ? t.trustedVotes : t.votes;
      return evaluation([
        mode,
        check(
          'matches recorded samples',
          r(knn.votes, votes),
          `${Math.round(knn.votes * knn.neighbours)}/${knn.neighbours} nearest are ${label}`,
        ),
        check(
          'close to a recorded pose',
          r(knn.nearest, closeness),
          `${knn.nearest.toFixed(2)} palms (your attempts vary ~${spread.toFixed(2)}; full credit <= ${closeness.oneAt.toFixed(2)})`,
        ),
      ]);
    },
  };
}

/**
 * Every sign the game knows (the library). Characters pick their three moves
 * from here by id (see characters/Characters.ts); only the selected
 * character's moves are active at a time.
 */
export const GESTURE_DEFINITIONS: GestureDefinition[] = [
  ...TAUGHT_MOVES,
  SELF_EMBODIMENT_OF_PERFECTION,
  CLEAVE,
  PIERCING_BLOOD,
  MALEVOLENT_SHRINE,
  UNLIMITED_VOID,
  CHIMERA_SHADOW_GARDEN,
  AUTHENTIC_MUTUAL_LOVE,
  TIME_CELL_MOON_PALACE,
  RYU_DIAMOND,
].map(withLearning);
