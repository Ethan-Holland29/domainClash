/**
 * GestureDefinitions
 *
 * Each function evaluates one hand-pose against a set of independent
 * checks (finger states, distances, two-hand relationships) and returns
 * a pass/fail per check plus an overall match. Every pose here is an
 * original design chosen to be easy to hold steadily in front of a
 * single webcam and easy to tell apart from the others — not a
 * reproduction of any specific real-world or media choreography.
 *
 * Swap or tweak these freely; nothing outside this file needs to change.
 */

import type { TrackedHand } from "./HandTypes";
import type { GestureEvaluation, GestureType } from "./GestureTypes";
import {
  countExtended,
  distance2D,
  fingerSpread,
  getFingerExtension,
  handScale,
} from "./handGeometry";

function evaluation(gesture: GestureType, checks: Record<string, boolean>): GestureEvaluation {
  const values = Object.values(checks);
  const passed = values.filter(Boolean).length;
  return {
    gesture,
    matched: values.every(Boolean),
    debug: { checks, score: values.length ? passed / values.length : 0 },
  };
}

/** BASIC_PUNCH — one hand, closed fist. */
function evalBasicPunch(hands: TrackedHand[]): GestureEvaluation {
  const hand = hands[0];
  if (!hand) return evaluation("BASIC_PUNCH", { oneHandPresent: false });

  const ext = getFingerExtension(hand);
  const extendedCount = countExtended(ext);

  return evaluation("BASIC_PUNCH", {
    oneHandPresent: hands.length === 1,
    fistClosed: extendedCount <= 1, // allow slight thumb noise
  });
}

/** CLEAVE — one hand, flat blade shape: four fingers extended and held close together. */
function evalCleave(hands: TrackedHand[]): GestureEvaluation {
  const hand = hands[0];
  if (!hand) return evaluation("CLEAVE", { oneHandPresent: false });

  const ext = getFingerExtension(hand);
  const spread = fingerSpread(hand);

  return evaluation("CLEAVE", {
    oneHandPresent: hands.length === 1,
    fourFingersExtended: ext.index && ext.middle && ext.ring && ext.pinky,
    fingersHeldTogether: spread < 0.55,
  });
}

/**
 * PIERCING_BLOOD — Choso's pose: both hands in tight fists, knuckles
 * pressed together in front of the chest/chin, arms tensed inward.
 */
function evalPiercingBlood(hands: TrackedHand[]): GestureEvaluation {
  if (hands.length !== 2) return evaluation("PIERCING_BLOOD", { twoHandsPresent: false });

  const [a, b] = hands;
  const extA = getFingerExtension(a);
  const extB = getFingerExtension(b);
  const scale = (handScale(a) + handScale(b)) / 2;

  // Knuckle rows (MCP joints) pressed together, not just the wrists close.
  const knuckleDist = distance2D(a.landmarks[9], b.landmarks[9]); // middle-finger MCP, roughly knuckle center

  return evaluation("PIERCING_BLOOD", {
    twoHandsPresent: true,
    bothFistsClosed: countExtended(extA) <= 1 && countExtended(extB) <= 1,
    knucklesPressedTogether: knuckleDist < scale * 0.9,
  });
}

/**
 * DIVINE_DOGS — one hand, shaped like a traditional shadow-puppet dog:
 * index and middle fingers extended together (the snout/ears), ring and
 * pinky curled into the palm, thumb tucked across.
 */
function evalDivineDogs(hands: TrackedHand[]): GestureEvaluation {
  const hand = hands[0];
  if (!hand) return evaluation("DIVINE_DOGS", { oneHandPresent: false });

  const ext = getFingerExtension(hand);
  const spread = fingerSpread(hand);

  return evaluation("DIVINE_DOGS", {
    oneHandPresent: hands.length === 1,
    indexAndMiddleExtended: ext.index && ext.middle,
    ringAndPinkyCurled: !ext.ring && !ext.pinky,
    indexMiddleHeldTogether: spread < 0.6,
  });
}

/**
 * NUE — two hands crossed at the wrists, fingers extended and spread
 * wide on both hands (wing/talon shape).
 */
function evalNue(hands: TrackedHand[]): GestureEvaluation {
  if (hands.length !== 2) return evaluation("NUE", { twoHandsPresent: false });

  const [a, b] = hands;
  const scale = (handScale(a) + handScale(b)) / 2;
  const extA = getFingerExtension(a);
  const extB = getFingerExtension(b);

  const wristCrossDist = distance2D(a.landmarks[0], b.landmarks[0]);
  const spreadA = fingerSpread(a);
  const spreadB = fingerSpread(b);

  return evaluation("NUE", {
    twoHandsPresent: true,
    wristsCrossedClose: wristCrossDist < scale * 2.2,
    bothHandsFingersExtended: countExtended(extA) >= 4 && countExtended(extB) >= 4,
    fingersSpreadWide: spreadA > 0.7 && spreadB > 0.7,
  });
}

/** MAHORAGA — two hands, both closed fists held touching side by side. */
function evalMahoraga(hands: TrackedHand[]): GestureEvaluation {
  if (hands.length !== 2) return evaluation("MAHORAGA", { twoHandsPresent: false });

  const [a, b] = hands;
  const extA = getFingerExtension(a);
  const extB = getFingerExtension(b);
  const scale = (handScale(a) + handScale(b)) / 2;
  const wristDist = distance2D(a.landmarks[0], b.landmarks[0]);

  return evaluation("MAHORAGA", {
    twoHandsPresent: true,
    bothFistsClosed: countExtended(extA) <= 1 && countExtended(extB) <= 1,
    fistsTouching: wristDist < scale * 2.0,
  });
}

export const GESTURE_EVALUATORS: Record<GestureType, (hands: TrackedHand[]) => GestureEvaluation> = {
  REVERSAL_RED: () => evaluation("REVERSAL_RED", { recordedSignRequired: false }),
  AMPLIFICATION_BLUE: () => evaluation("AMPLIFICATION_BLUE", { recordedSignRequired: false }),
  YUJI_ULTIMATE: () => evaluation("YUJI_ULTIMATE", { recordedSignRequired: false }),
  CURSED_TOOLS: () => evaluation("CURSED_TOOLS", { recordedSignRequired: false }),
  CURSE_SWALLOW: () => evaluation("CURSE_SWALLOW", { recordedSignRequired: false }),
  GETO_ULTIMATE: () => evaluation("GETO_ULTIMATE", { recordedSignRequired: false }),
  RIKA: () => evaluation("RIKA", { recordedSignRequired: false }),
  YUTA_ULTIMATE: () => evaluation("YUTA_ULTIMATE", { recordedSignRequired: false }),
  GRANITE_BLAST: () => evaluation("GRANITE_BLAST", { recordedSignRequired: false }),
  GOJO_ULTIMATE: () => evaluation("GOJO_ULTIMATE", { recordedSignRequired: false }),
  RYU_ULTIMATE: () => evaluation("RYU_ULTIMATE", { recordedSignRequired: false }),
  BASIC_PUNCH: evalBasicPunch,
  CLEAVE: evalCleave,
  PIERCING_BLOOD: evalPiercingBlood,
  DIVINE_DOGS: evalDivineDogs,
  NUE: evalNue,
  MAHORAGA: evalMahoraga,
  SUKUNA_ULTIMATE: () => evaluation("SUKUNA_ULTIMATE", { recordedSignRequired: false }),
  CHOSO_ULTIMATE: () => evaluation("CHOSO_ULTIMATE", { recordedSignRequired: false }),
  MEGUMI_ULTIMATE: () => evaluation("MEGUMI_ULTIMATE", { recordedSignRequired: false }),
  GUARD: (hands) => {
    if (hands.length !== 2) return evaluation("GUARD", { twoHandsPresent: false });
    const [a, b] = hands;
    const scale = (handScale(a) + handScale(b)) / 2;
    return evaluation("GUARD", {
      twoHandsPresent: true,
      bothFistsClosed: countExtended(getFingerExtension(a)) <= 1 && countExtended(getFingerExtension(b)) <= 1,
      wristsCrossed: distance2D(a.landmarks[0], b.landmarks[0]) < scale * 1.25,
    });
  },
};

export function evaluateAllGestures(hands: TrackedHand[]): GestureEvaluation[] {
  return Object.values(GESTURE_EVALUATORS).map((fn) => fn(hands));
}
