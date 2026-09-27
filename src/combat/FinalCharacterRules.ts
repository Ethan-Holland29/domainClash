/** Shared rolls for the final four kits; RNG is supplied by the match. */
export type CurseGrade = 3 | 2 | 1 | 'special';
export function rollCurse(random: () => number): CurseGrade {
  const roll = random();
  return roll < .25 ? 3 : roll < .65 ? 2 : roll < .90 ? 1 : 'special';
}
export function rollBlackFlash(random: () => number): boolean { return random() < .33; }
export function straightHands(random: () => number): { hits: number[]; flashes: number } {
  const hits = Array.from({ length: 4 }, () => rollBlackFlash(random) ? 20 : 10);
  return { hits, flashes: hits.filter(damage => damage === 20).length };
}

export function uzumaki(random: () => number): { damage: number; grades: CurseGrade[] } {
  const grades = Array.from({ length: 10 }, () => rollCurse(random));
  const sum = grades.reduce<number>((total, grade) => total + (grade === 3 ? 5 : grade === 2 ? -5 : grade === 1 ? 10 : 0), 0);
  const total = Math.max(0, sum * 2 ** grades.filter(g => g === 'special').length);
  return { damage: Math.floor(total > 100 ? total / 2 : total), grades };
}
export const COPY_POOL = ['GOJO_ULTIMATE', 'HOLLOW_PURPLE', 'MEGUMI_ULTIMATE', 'SUKUNA_ULTIMATE', 'CHOSO_ULTIMATE', 'RYU_ULTIMATE', 'YUJI_ULTIMATE', 'GETO_ULTIMATE'] as const;
