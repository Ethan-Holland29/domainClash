import { evaluateRegularSigns } from "./RegularSigns";
import { evaluateDomainSigns } from "./DomainSigns";
import { GameConfig } from "../config/GameConfig";
const T = GameConfig.gestures.thresholds;
import { LandmarkIndex, type TrackedHand } from "./HandTypes";
import {
  fingerExtension,
  fingersOpenScore,
  isFingerExtended,
  isFingerFolded,
  palmFacingCamera,
  pointingScore,
  thumbExtension,
} from "./HandGeometry";
import { GestureId, type GestureCheck, type GestureEval } from "./GestureTypes";

export function evaluateGestures(hands: TrackedHand[]): GestureEval[] {
  hands = hands.filter(h => h.landmarks.length === 21 && h.landmarks.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)));
  return [
    ...(hands.length===1?[evaluatePrimary(hands),evaluateSecondary(hands),...evaluateRegularSigns(hands)]:[]),
    ...evaluateDomainSigns(hands),
  ];
}

function evaluatePrimary(hands: TrackedHand[]): GestureEval {
  const checks: GestureCheck[] = [];
  const hand = pickBest(hands, (h) => fingersOpenScore(h) * 0.75 + palmFacingCamera(h) * 0.25);

  if (!hand) {
    return fail(GestureId.PRIMARY_ATTACK, "Cleave", "Need one visible hand");
  }

  const open = fingersOpenScore(hand);
  const palm = palmFacingCamera(hand);
  const index = isFingerExtended(hand, LandmarkIndex.INDEX_TIP, LandmarkIndex.INDEX_PIP, LandmarkIndex.INDEX_MCP);
  const middle = isFingerExtended(hand, LandmarkIndex.MIDDLE_TIP, LandmarkIndex.MIDDLE_PIP, LandmarkIndex.MIDDLE_MCP);
  const ring = isFingerExtended(hand, LandmarkIndex.RING_TIP, LandmarkIndex.RING_PIP, LandmarkIndex.RING_MCP);
  const pinky = isFingerExtended(hand, LandmarkIndex.PINKY_TIP, LandmarkIndex.PINKY_PIP, LandmarkIndex.PINKY_MCP);
  const thumb = thumbExtension(hand);

  add(checks, "index extended", index, index ? 1 : 0, "open slash / Cleave");
  add(checks, "middle extended", middle, middle ? 1 : 0, "open palm");
  add(checks, "ring extended", ring, ring ? 1 : 0, "spread fingers");
  add(checks, "pinky extended", pinky, pinky ? 1 : 0, "spread fingers");
  add(checks, "fingers open", open >= T.primaryOpen, open, `score ${open.toFixed(2)}`);
  add(checks, "palm readable", palm >= T.palmReadable, palm, "palm toward camera");
  add(checks, "thumb not tucked fully", thumb >= T.thumbOut, thumb, "thumb out");

  const score = open * 0.7 + palm * 0.2 + Math.min(thumb, 0.5) * 0.2;
  const passed = checks.filter((c) => c.passed).length >= 5 && score >= T.primaryScore;
  return {
    id: GestureId.PRIMARY_ATTACK,
    displayName: "Cleave",
    score,
    passed,
    checks,
  };
}

function evaluateSecondary(hands: TrackedHand[]): GestureEval {
  const checks: GestureCheck[] = [];
  const hand = pickBest(hands, pointingScore);

  if (!hand) {
    return fail(GestureId.SECONDARY_ATTACK, "Piercing Blood", "Need one visible hand");
  }

  const point = pointingScore(hand);
  const indexExt = fingerExtension(hand, LandmarkIndex.INDEX_TIP, LandmarkIndex.INDEX_PIP, LandmarkIndex.INDEX_MCP);
  const middleExt = fingerExtension(hand, LandmarkIndex.MIDDLE_TIP, LandmarkIndex.MIDDLE_PIP, LandmarkIndex.MIDDLE_MCP);
  const ringFolded = isFingerFolded(hand, LandmarkIndex.RING_TIP, LandmarkIndex.RING_PIP, LandmarkIndex.RING_MCP, T.ringFolded);
  const pinkyFolded = isFingerFolded(hand, LandmarkIndex.PINKY_TIP, LandmarkIndex.PINKY_PIP, LandmarkIndex.PINKY_MCP, T.pinkyFolded);
  const indexOut = indexExt >= T.indexPointing;
  const notOpenPalm = fingersOpenScore(hand) < T.openPalmCeiling;

  add(checks, "index pointing", indexOut, indexExt, "finger gun / pierce");
  add(checks, "middle with or behind index", middleExt <= 0.92, middleExt, "one or two finger point");
  add(checks, "ring folded", ringFolded, ringFolded ? 1 : 0, "not an open hand");
  add(checks, "pinky folded", pinkyFolded, pinkyFolded ? 1 : 0, "not an open hand");
  add(checks, "pointing shape", point >= 0.58, point, `score ${point.toFixed(2)}`);
  add(checks, "not open palm", notOpenPalm, notOpenPalm ? 1 : 0, "keeps Cleave distinct");

  const score = point * 0.8 + (ringFolded && pinkyFolded ? 0.2 : 0);
  const passed = middleExt < .42 && indexOut && ringFolded && pinkyFolded && notOpenPalm && score >= T.secondaryScore;
  return {
    id: GestureId.SECONDARY_ATTACK,
    displayName: "Piercing Blood",
    score,
    passed,
    checks,
  };
}

function pickBest(hands: TrackedHand[], scoreOf: (hand: TrackedHand) => number): TrackedHand | null {
  if (hands.length === 0) return null;
  return hands.reduce((best, hand) => (scoreOf(hand) > scoreOf(best) ? hand : best));
}

function add(checks: GestureCheck[], name: string, passed: boolean, value: number, detail: string): void {
  checks.push({ name, passed, value, detail });
}

function fail(id: GestureId, displayName: string, reason: string): GestureEval {
  return {
    id,
    displayName,
    score: 0,
    passed: false,
    checks: [{ name: "presence", passed: false, value: 0, detail: reason }],
  };
}
