// AI-vs-AI balance report for the shared battle engine.
// Usage: node scripts/balance.mjs [battlesPerSide]
import { CHARACTER_IDS, CHARACTERS, createBattle, resolveTurn, chooseMove, seededRandom } from '../shared/battle.mjs';

export function simulate(a, b, battles, seed = 1) {
  const random = seededRandom(seed);
  let wins = 0, draws = 0, turns = 0;
  for (let i = 0; i < battles; i++) {
    // Alternate sides so side 0 / 1 never matters.
    const flip = i % 2 === 1;
    let state = createBattle(flip ? b : a, flip ? a : b);
    while (!state.over) state = resolveTurn(state, [chooseMove(state, 0, random), chooseMove(state, 1, random)], random).state;
    turns += state.turn;
    if (state.winner === 'draw') draws++;
    else if ((state.winner === 0) !== flip) wins++;
  }
  return { rate: (wins + draws / 2) / battles, turns: turns / battles };
}

export function report(battles = 400) {
  const rows = {};
  for (const a of CHARACTER_IDS) {
    rows[a] = {};
    for (const b of CHARACTER_IDS) if (a !== b) rows[a][b] = simulate(a, b, battles, CHARACTER_IDS.indexOf(a) * 31 + CHARACTER_IDS.indexOf(b));
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const battles = Number(process.argv[2] ?? 400);
  const rows = report(battles);
  const pad = (s, n = 7) => String(s).padStart(n);
  console.log(pad('', 8) + CHARACTER_IDS.map((id) => pad(id)).join('') + pad('avg') + pad('turns'));
  for (const a of CHARACTER_IDS) {
    const cells = CHARACTER_IDS.map((b) => (a === b ? pad('-') : pad(Math.round(rows[a][b].rate * 100) + '%')));
    const vals = Object.values(rows[a]);
    const avg = vals.reduce((s, r) => s + r.rate, 0) / vals.length;
    const t = vals.reduce((s, r) => s + r.turns, 0) / vals.length;
    console.log(a.padEnd(8) + cells.join('') + pad(Math.round(avg * 100) + '%') + pad(t.toFixed(1)) + (CHARACTERS[a].domain ? '  domain' : '') + (CHARACTERS[a].mahoraga ? '+mahoraga' : ''));
  }
}
