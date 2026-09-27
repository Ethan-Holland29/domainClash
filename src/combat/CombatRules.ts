export const UNIVERSAL = {
  maxHp: 200, maxMeter: 100, punchDamage: 10, punchMeter: 5,
  techniqueMeter: 20, punchMiss: 0.10, techniqueMiss: 0.05,
  responseMs: 1500,
} as const;
export const PASSIVES: Record<string, string> = {
  toji: 'Heavenly Restriction: punches deal 15 and gain 10 meter. At 100 meter, lose 20 HP and skip a turn.',
  geto: 'Curse Army summons one random spirit each turn. Grades 3 and 2 attack; Grade 1 guards; Special grants 50 meter.',
  yuta: 'Gain 5 extra meter per attempted move. Rika can steal up to 15 enemy meter.',
  yuji: 'Basic Punch has a 33% Black Flash chance. Takes 33% more Cursed Technique damage.',
  choso: 'Gain 1 blood stack per 10 HP lost. Supernova deals 2 damage per stack each turn for 2 turns.',
  sukuna: 'Starts at 175 HP; punches deal 5. Every 3 turns, gain a finger for +10 HP and meter (max 5).',
  ryu: 'Granite Blast starts at 30 damage, loses 5 per use (min 5), and grants 15 meter. Way Too Sweet restores it.',
  gojo: 'Take 20% less damage while below 40 meter.',
  megumi: 'Each turn has a 10% chance to deal 10 damage and gain 10 meter.',
};
export const MOVE_DETAILS: Record<string, string> = {
  CURSED_TOOLS: '30, 35, or 40 damage · 2-turn cooldown · 33% chance to give the opponent +10 damage next turn',
  CURSE_SWALLOW: 'Heal up to 30 HP · pause summons for 2 turns · 2-turn cooldown',
  GETO_ULTIMATE: 'Unblockable · roll 10 spirits; Special spirits double the total damage',
  RIKA: '20 damage · steal up to 15 enemy meter · gain 25 · 2-turn cooldown',
  YUTA_ULTIMATE: 'Unblockable · copy a random ultimate at 80% strength with its extra effects',
  YUJI_ULTIMATE: 'Unblockable · 80 meter · four 10-damage punches, each with a 33% Black Flash chance',
  CURSED_FISTS: '10 damage · +30 meter · 50% chance to Black Flash for 20 damage',
  CLEAVE: 'Unblockable · 15 damage +10 per finger · +20 meter · 2-turn cooldown',
  SUKUNA_ULTIMATE: 'Unblockable · spend all meter for 15 damage per 30 meter (45–75)',
  CHOSO_ULTIMATE: 'Unblockable · 40 damage · foe skips a turn, then bleeds for 2× stacks per turn for 2 turns',
  GRANITE_BLAST: '30 damage, −5 per use (min 5) · +15 meter · 1-turn cooldown',
  RYU_ULTIMATE: 'Unblockable · heal 40 HP · reset Granite Blast to 30 damage',
  PIERCING_BLOOD: '20 damage · +15 vs Megumi after a recent summon · +20 meter',
  BASIC_PUNCH: '10 damage · +5 meter · 10% miss',
  REVERSAL_RED: '20 damage · +20 meter · 3-turn cooldown',
  AMPLIFICATION_BLUE: '10 damage · drain 20 enemy meter · +20 meter · 3-turn cooldown',
  GOJO_ULTIMATE: 'Unblockable · 40 damage · next 2 enemy attacks may hit them for 5 instead',
  HOLLOW_PURPLE: 'Unblockable · 100 damage · needs 2 Red and 2 Blue uses plus 100 meter · recover for 3 turns',
  DIVINE_DOGS: 'Heal 20 HP · bite for 5 damage on your next 3 turns · once per match',
  NUE: '30 meter · random 5, 15, 20, or 30 damage · once per match',
  MAHORAGA: 'Below 70 HP · appears after 3 enemy turns · 50 HP · 30 damage · starts at 20% reduction, then −4 points per turn',
  MEGUMI_ULTIMATE: 'Unblockable · 20 damage · refresh Nue or Demon Dogs at random',
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
