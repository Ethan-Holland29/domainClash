export const AbilityId = {
  BASIC_PUNCH: "BASIC_PUNCH",
  DIVINE_DOGS: "DIVINE_DOGS",
  NUE: "NUE",
  DISMANTLE: "DISMANTLE",
  SUPERNOVA: "SUPERNOVA",
  GRANITE_BLAST: "GRANITE_BLAST",
  SOUL_SPLIT: "SOUL_SPLIT",
  HEAVENLY_RUSH: "HEAVENLY_RUSH",
  CURSE_SWARM: "CURSE_SWARM",
  CURSE_SWALLOW: "CURSE_SWALLOW",
  UZUMAKI: "UZUMAKI",
  KATANA: "KATANA",
  RIKA: "RIKA",
  PRIMARY_ATTACK: "PRIMARY_ATTACK",
  SECONDARY_ATTACK: "SECONDARY_ATTACK",
  DOMAIN_EXPANSION: "DOMAIN_EXPANSION",
  MALEVOLENT_SHRINE: "MALEVOLENT_SHRINE",
  UNLIMITED_VOID: "UNLIMITED_VOID",
  IRON_MOUNTAIN: "IRON_MOUNTAIN",
  SELF_EMBODIMENT: "SELF_EMBODIMENT",
  MUTUAL_LOVE: "MUTUAL_LOVE",
  CAPTIVATING_SKANDHA: "CAPTIVATING_SKANDHA",
  YUJI_DOMAIN: "YUJI_DOMAIN",
  WOMB_PROFUSION: "WOMB_PROFUSION",
  DEATH_GAMBLE: "DEATH_GAMBLE",
  RYU_DOMAIN: "RYU_DOMAIN",
  URO_DOMAIN: "URO_DOMAIN",
  LAPSE_BLUE: "LAPSE_BLUE",
  REVERSAL_RED: "REVERSAL_RED",
  HOLLOW_PURPLE: "HOLLOW_PURPLE",
  BLACK_FLASH: "BLACK_FLASH",
} as const;

export type AbilityId = (typeof AbilityId)[keyof typeof AbilityId];

export const CombatRejectReason = {
  cooldown: "cooldown",
  meter: "meter",
  busy: "busy",
  ended: "ended",
  alreadyActive: "alreadyActive",
} as const;

export type CombatRejectReason = (typeof CombatRejectReason)[keyof typeof CombatRejectReason];

export interface AbilityDef {
  id: AbilityId;
  name: string;
  damage: number;
  cooldownMs: number;
  meterGain: number;
  windupMs: number;
}

export type ActivateResult =
  | { ok: true; ability: AbilityDef }
  | { ok: false; reason: CombatRejectReason; abilityId: AbilityId };

export const MatchState = {
  playing: "playing",
  cinematic: "cinematic",
  victory: "victory",
  defeat: "defeat",
} as const;

export type MatchState = (typeof MatchState)[keyof typeof MatchState];
