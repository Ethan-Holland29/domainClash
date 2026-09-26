import rules from '../../server/rules.json' with {type:'json'};
import { GameConfig } from "../config/GameConfig";
import { AbilityId, type AbilityDef } from "./AbilityTypes";

const BaseAbilities: Partial<Record<AbilityId, AbilityDef>> = {
  [AbilityId.PRIMARY_ATTACK]: {
    id: AbilityId.PRIMARY_ATTACK,
    name: "Cleave",
    damage: GameConfig.combat.primary.damage,
    cooldownMs: GameConfig.combat.primary.cooldownMs,
    meterGain: GameConfig.combat.primary.meterGain,
    windupMs: GameConfig.combat.primary.windupMs,
  },
  [AbilityId.SECONDARY_ATTACK]: {
    id: AbilityId.SECONDARY_ATTACK,
    name: "Piercing Blood",
    damage: GameConfig.combat.secondary.damage,
    cooldownMs: GameConfig.combat.secondary.cooldownMs,
    meterGain: GameConfig.combat.secondary.meterGain,
    windupMs: GameConfig.combat.secondary.windupMs,
  },
  [AbilityId.DOMAIN_EXPANSION]: {
    id: AbilityId.DOMAIN_EXPANSION,
    name: "Chimera Shadow Garden",
    damage: 0,
    cooldownMs: 0,
    meterGain: 0,
    windupMs: GameConfig.domain.cinematicMs,
  },
};

import { Moves, isDomain } from "./MoveCatalog";
export const Abilities = Object.fromEntries(Moves.map(m => [m.id, {...(BaseAbilities[m.id] ?? {id:m.id, damage:isDomain(m.id)?0:(({LAPSE_BLUE:7,REVERSAL_RED:12,HOLLOW_PURPLE:18,BLACK_FLASH:14} as Partial<Record<AbilityId,number>>)[m.id]??8), meterGain:isDomain(m.id)?0:15, windupMs:isDomain(m.id)?2400:180}), damage:BaseAbilities[m.id]?.damage??rules[m.id].damage, name:m.name, cooldownMs:m.cooldownMs}])) as Record<AbilityId,AbilityDef>;
