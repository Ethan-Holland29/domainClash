export const UNIVERSAL = {
  maxHp: 200, maxMeter: 100, punchDamage: 10, punchMeter: 5,
  techniqueMeter: 20, punchMiss: 0.10, techniqueMiss: 0.05,
  responseMs: 1500,
} as const;
export const PASSIVES: Record<string, string> = {
  toji: 'Heavenly Restriction: ignores passive bonus damage and bypasses passive defenses, except Sukuna’s benefits. Punch: 15 damage, +10 meter. At 100 meter, next turn loses 20 HP, resets meter, and skips.',
  geto: 'Curse Army: summon each own turn. Grade 3 (25%): 5 damage; Grade 2 (40%): 10 damage and +10 meter; Grade 1 (25%): 33% damage reduction through the next enemy turn and +10 meter; Special (10%): +50 meter.',
  yuta: 'Bottomless Cursed Energy: gain 5 extra meter per attempted attack, including Copy. Rika also transfers up to 15 enemy meter.',

  yuji: 'Unbreakable Spirit: punches have a 33% Black Flash chance for double damage. Takes double technique damage and 33% less ultimate damage. Straight Hands needs 80 meter.',
  choso: 'Flowing Red Scale: every 10 HP lost grants 1 blood stack. Supernova consumes stacks for 5 damage per turn for one turn per stack.',
  sukuna: 'Finger Lickin’: start at 175 HP and punch for 5. Every 3 completed turns, eat a finger for +10 current/max HP and +10 meter (5 fingers max). Meter can reach 150.',
  ryu: "Jane, You’re Early: Granite Blast has a 1-turn cooldown, starts at 25 damage, loses 5 per use (minimum 5), and grants 15 meter.",
  gojo: 'Limitless: take 20% less damage while your Domain meter is below 40%.',
  megumi: 'Shadow Dweller: each turn has a 10% chance to deal 10 damage and gain 10 Domain meter.',
};
export const MOVE_DETAILS: Record<string, string> = {
  CURSED_TOOLS: 'Random 30/35/40 damage · 2-turn cooldown · 33% chance enemy gets +10 damage on their next turn',
  CURSE_SWALLOW: 'Heal 30 HP · pause new curse summons for your next two turns · 2-turn cooldown',
  GETO_ULTIMATE: 'Roll 10 spirits: Grade 3 +5, Grade 2 −5, Grade 1 +10; double subtotal per Special. Halve once if over 100; minimum 0 damage',
  RIKA: '20 damage · steal up to 15 meter · +25 attack meter · 2-turn cooldown',
  YUTA_ULTIMATE: 'Random other ultimate, including Hollow Purple · 80% damage/healing, rounded down · +10 damage before scaling for Megumi/Sukuna/Choso · retains secondary effects',

  YUJI_ULTIMATE: '80 meter · four 10-damage punches · each independently has a 33% chance to Black Flash for 20 damage',
  CLEAVE: '15 damage initially · +10 per finger eaten · +20 meter · 2-turn cooldown',
  SUKUNA_ULTIMATE: 'Spend ALL meter: 45 damage at 100–119, 60 at 120–149, 75 at 150',
  CHOSO_ULTIMATE: '40 damage · enemy skips a turn wiping blood · consume blood stacks for 5 damage each turn for that many turns',
  GRANITE_BLAST: '25 damage initially, −5 per use (minimum 5) · +15 meter · 1-turn cooldown',
  RYU_ULTIMATE: 'Heal 40 HP · restore Granite Blast to 25 damage',
  PIERCING_BLOOD: '20 damage · +15 against Megumi if he summoned Nue or Demon Dogs in his past 2 turns · +20 blood meter',
  BASIC_PUNCH: '10 damage · +5 meter · 10% miss',
  REVERSAL_RED: '20 damage · +20 meter · 3-turn cooldown',
  AMPLIFICATION_BLUE: '10 damage · drain 20 enemy meter · +20 meter · 3-turn cooldown',
  GOJO_ULTIMATE: '40 damage · next 2 enemy attacks each have a 33% chance to deal 5 damage to themselves instead',
  HOLLOW_PURPLE: '100 damage · unlock with 2 Red + 2 Blue uses · 100 meter · unable to attack for 3 turns',
  DIVINE_DOGS: 'Heal 20 HP · dogs deal 5 damage for 3 turns · once per match',
  NUE: 'Randomly deal 5, 15, 20 or 30 damage · once per match',
  MAHORAGA: 'Below 50 HP only · summon after 3 turns · replaces Megumi with 30 HP · 30 damage · incoming damage halves each turn (rounded down)',
  MEGUMI_ULTIMATE: '20 damage · randomly refresh Nue or Demon Dogs',
};

export const PASSIVE_CUES: Record<string, { name: string; message: string }> = {
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
