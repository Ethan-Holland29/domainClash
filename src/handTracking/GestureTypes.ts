import { AbilityId } from "../combat/AbilityTypes";
export const GestureId = AbilityId;
export type GestureId = (typeof GestureId)[keyof typeof GestureId];

export interface GestureCheck {
  name: string;
  passed: boolean;
  value: number;
  detail: string;
}

export interface GestureEval {
  id: GestureId;
  displayName: string;
  score: number;
  passed: boolean;
  checks: GestureCheck[];
}

export const GesturePhase = {
  idle: "idle",
  released: "released",
  enter: "enter",
  holding: "holding",
  confirmed: "confirmed",
  cooldown: "cooldown",
} as const;

export type GesturePhase = (typeof GesturePhase)[keyof typeof GesturePhase];

export interface GestureState {
  candidate: GestureId | null;
  confirmed: GestureId | null;
  phase: GesturePhase;
  holdProgress: number;
  score: number;
  lastConfirmedAt: number;
}

export type GestureListener = (gesture: GestureId) => void;

