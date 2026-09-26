import { GameConfig } from "../config/GameConfig";
import { LandmarkIndex, type TrackedHand, type Vec3 } from "./HandTypes";

export function dist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.hypot(dx, dy, dz);
}

export function dist2d(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function normalize(v: Vec3): Vec3 {
  const len = length(v) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function palmSize(hand: TrackedHand): number {
  const wrist = hand.landmarks[LandmarkIndex.WRIST];
  const middle = hand.landmarks[LandmarkIndex.MIDDLE_MCP];
  return Math.max(dist(wrist, middle), 0.04);
}

export function lm(hand: TrackedHand, index: number): Vec3 {
  return hand.landmarks[index];
}

/** 0 = fully curled, 1 = fully extended. */
export function fingerExtension(hand: TrackedHand, tip: number, pip: number, mcp: number): number {
  const wrist = hand.landmarks[LandmarkIndex.WRIST];
  const tipD = dist(lm(hand, tip), wrist);
  const pipD = dist(lm(hand, pip), wrist);
  const mcpD = dist(lm(hand, mcp), wrist);
  const ratio = (tipD - pipD) / Math.max(mcpD, 0.001);
  const angle = jointAngle(lm(hand, mcp), lm(hand, pip), lm(hand, tip));
  return clamp01((ratio + 0.15) / 0.7) * 0.75 + clamp01((angle - 60) / 110) * 0.25;
}

export function isFingerExtended(hand: TrackedHand, tip: number, pip: number, mcp: number, threshold = GameConfig.gestures.thresholds.extended): boolean {
  return fingerExtension(hand, tip, pip, mcp) >= threshold;
}

export function isFingerFolded(hand: TrackedHand, tip: number, pip: number, mcp: number, threshold: number = GameConfig.gestures.thresholds.folded): boolean {
  return fingerExtension(hand, tip, pip, mcp) <= threshold;
}

export function thumbExtension(hand: TrackedHand): number {
  const wrist = hand.landmarks[LandmarkIndex.WRIST];
  const tip = lm(hand, LandmarkIndex.THUMB_TIP);
  const ip = lm(hand, LandmarkIndex.THUMB_IP);
  const mcp = lm(hand, LandmarkIndex.INDEX_MCP);
  const pinky = lm(hand, LandmarkIndex.PINKY_MCP);
  const palmWidth = dist(mcp, pinky);
  const away = dist(tip, wrist) / Math.max(palmSize(hand), 0.001);
  const ipAway = dist(ip, wrist) / Math.max(palmSize(hand), 0.001);
  const spread = dist(tip, mcp) / Math.max(palmWidth, 0.001);
  return clamp01((away - ipAway) * 2.2 + (spread - 0.6));
}

export function fingersOpenScore(hand: TrackedHand): number {
  const index = fingerExtension(hand, LandmarkIndex.INDEX_TIP, LandmarkIndex.INDEX_PIP, LandmarkIndex.INDEX_MCP);
  const middle = fingerExtension(hand, LandmarkIndex.MIDDLE_TIP, LandmarkIndex.MIDDLE_PIP, LandmarkIndex.MIDDLE_MCP);
  const ring = fingerExtension(hand, LandmarkIndex.RING_TIP, LandmarkIndex.RING_PIP, LandmarkIndex.RING_MCP);
  const pinky = fingerExtension(hand, LandmarkIndex.PINKY_TIP, LandmarkIndex.PINKY_PIP, LandmarkIndex.PINKY_MCP);
  return (index + middle + ring + pinky) / 4;
}

export function pointingScore(hand: TrackedHand): number {
  const index = fingerExtension(hand, LandmarkIndex.INDEX_TIP, LandmarkIndex.INDEX_PIP, LandmarkIndex.INDEX_MCP);
  const middle = fingerExtension(hand, LandmarkIndex.MIDDLE_TIP, LandmarkIndex.MIDDLE_PIP, LandmarkIndex.MIDDLE_MCP);
  const ring = fingerExtension(hand, LandmarkIndex.RING_TIP, LandmarkIndex.RING_PIP, LandmarkIndex.RING_MCP);
  const pinky = fingerExtension(hand, LandmarkIndex.PINKY_TIP, LandmarkIndex.PINKY_PIP, LandmarkIndex.PINKY_MCP);
  const twoFinger = Math.max(index, (index + middle) / 2);
  const folded = 1 - (ring + pinky) / 2;
  return clamp01(twoFinger * 0.65 + folded * 0.35);
}

export function palmFacingCamera(hand: TrackedHand): number {
  const wrist = lm(hand, LandmarkIndex.WRIST);
  const indexMcp = lm(hand, LandmarkIndex.INDEX_MCP);
  const pinkyMcp = lm(hand, LandmarkIndex.PINKY_MCP);
  const normal = normalize(cross(sub(indexMcp, wrist), sub(pinkyMcp, wrist)));
  return clamp01(Math.abs(normal.z));
}

export function handUpScore(hand: TrackedHand): number {
  const wrist = lm(hand, LandmarkIndex.WRIST);
  const middle = lm(hand, LandmarkIndex.MIDDLE_MCP);
  const dir = normalize(sub(middle, wrist));
  return clamp01(-dir.y);
}

export function handsCloseScore(a: TrackedHand, b: TrackedHand): number {
  const scale = (palmSize(a) + palmSize(b)) / 2;
  const d = dist2d(lm(a, LandmarkIndex.WRIST), lm(b, LandmarkIndex.WRIST));
  const ratio = d / scale;
  return clamp01(1.15 - ratio / 2.4);
}

export function palmsFacingEachOther(a: TrackedHand, b: TrackedHand): number {
  const wristA = lm(a, LandmarkIndex.WRIST);
  const wristB = lm(b, LandmarkIndex.WRIST);
  const between = normalize(sub(wristB, wristA));
  const nA = palmNormal(a);
  const nB = palmNormal(b);
  const aToward = clamp01(dot(nA, between));
  const bToward = clamp01(dot(nB, { x: -between.x, y: -between.y, z: -between.z }));
  return (aToward + bToward) / 2;
}

export function palmNormal(hand: TrackedHand): Vec3 {
  const wrist = lm(hand, LandmarkIndex.WRIST);
  const indexMcp = lm(hand, LandmarkIndex.INDEX_MCP);
  const pinkyMcp = lm(hand, LandmarkIndex.PINKY_MCP);
  return normalize(cross(sub(indexMcp, wrist), sub(pinkyMcp, wrist)));
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Joint angle in degrees; normalized vectors make it independent of hand size. */
export function jointAngle(a: Vec3, joint: Vec3, b: Vec3): number {
  const cosine = dot(normalize(sub(a, joint)), normalize(sub(b, joint)));
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}
