# Battle system

Solo and online use one engine, `shared/battle.mjs`. The browser runs it for solo play, and the Node server runs it for online matches, so the rules are identical in both.

## How a turn works (Pokémon style)

1. Both fighters choose a move: a hand sign, a move button, or a number key (Space is Guard).
2. The move with the higher **priority** goes first: Guard is +4 and Piercing Blood is +1. On a tie, the fighter with the higher **Speed** goes first, and a Speed tie is a coin flip.
3. Each move rolls accuracy, then damage: power × 0.55 × a random 85–100%, multiplied by Attack and Defense stages. There's a 1 in 16 chance of a critical hit (×1.5).
4. At the end of the turn:
   - domain strikes land, then bleeding and passives;
   - everyone regains 15 cursed energy (CE);
   - Mahoraga adapts to whatever hit it.
5. The battle text plays one line at a time, and the health bars follow it.

## Equal base for everyone

| | Value |
|---|---|
| Health | 200 |
| Cursed energy | 0–100; start 30, +15 per turn, +10 extra for a Strike |
| Speed / Attack / Defense | all equal; stages range from −2 to +2 (25% per step) |
| Strike | 40 power, 100% accuracy, costs nothing |
| Guard | blocks every direct attack for the turn; fails two turns in a row; domain sure-hits go through it |

Every move is priced on one scale, so no kit gets more damage per turn than another: expected power ≈ 48 + 0.8 × cost. The only built-in advantages are a **Domain Expansion** (priced about 20% above a maximum technique) and **Mahoraga**. This follows the request to keep everyone equal unless they have Mahoraga or a domain.

**Domain Expansion:**
- Costs 100 CE and lasts 3 turns.
- Opens with a sure hit (it can't miss, and Guard doesn't stop it).
- Then deals a sure-hit strike at the end of each turn. Toji takes half.
- The owner's own attacks cannot miss inside it.
- If a fighter expands while the opponent's domain is up, it's a **domain clash**: the new domain's opening hit lands, then both domains shatter.

**Mahoraga (Megumi):**
- Can be summoned once, at 40% HP or less.
- Replaces Megumi with 70 HP, and attacks with the Strike sign.
- At the end of each turn it adapts to every attack that hit it: 25% less damage from that attack per level, up to 2 levels.
- If Mahoraga falls, Megumi loses.

## Kits and their lore basis

Move ids are the recorded hand-sign ids, so existing recordings keep working. Hollow Purple and Guard are buttons only.

| Fighter | Moves (power · accuracy · cost) | Passive | Lore basis |
|---|---|---|---|
| Satoru Gojo · domain | Lapse: Blue 55·100·20 (lowers Speed) · Reversal: Red 65·95·30 (30%: lowers Defense) · Hollow Purple 100·90·70 (after Blue and Red) · **Unlimited Void** 50 + 8/turn, stuns on opening | Infinity: Strikes deal 20% less (Cursed Tools pierce it) | Blue attracts, Red repels, Purple combines them; the Void overloads the target with information |
| Megumi Fushiguro · domain · Mahoraga | Nue 60·95·25 (20%: stun) · Divine Dogs 60·100·25 (30%: bleed) · Mahoraga · **Chimera Shadow Garden** 55 + 16/turn, raises Defense | Shadow Swamp: 10% chance to dodge a direct attack | Ten Shadows shikigami; an incomplete domain, so its strikes can miss (85%) |
| Ryomen Sukuna · domain | Dismantle (Strike) · Cleave 65·95·25 (+20 power while the target is above half HP) · **Malevolent Shrine** 60 + 18/turn, opening causes bleeding | King of Curses: +5 CE per turn | Cleave adjusts to the target's toughness; the Shrine is an open-barrier barrage of slashes |
| Choso | Piercing Blood 62·100·25, priority +1 · Supernova 95, always bleeds | Flowing Red Scale: Attack rises the first time he drops to half HP | Blood fired faster than sound; blood orbs burst; his blood is poison |
| Ryu Ishigori · domain | Granite Blast 88·85·35 · **Domain Expansion** 55 + 16/turn | Maximum Output: techniques deal 10% more | Highest cursed-energy output in the Culling Game; the domain comes from your hand-sign guide (its effect is unrevealed in canon, so it's a plain sure-hit domain) |
| Yuji Itadori · domain | Divergent Fist (Strike) · **Domain Expansion** 60 + 16/turn, Black Flash +15% inside it | Black Flash: 15% of Strikes deal double damage and give +20 CE | Black Flash; Yuji's own late-series domain |
| Toji Fushiguro | Physical Strike · Cursed Tools 76·95·25, ignores Defense boosts and Infinity. Uses Stamina, not CE. | Heavenly Restriction: immune to stun and bleeding; domain strikes deal him half damage | No cursed energy; the Inverted Spear and Split Soul Katana cut through techniques |
| Suguru Geto | Curse Swallow: heal 40 and +10 CE, not two turns in a row · Maximum: Uzumaki 140·95 | Curse Army: 30% chance each turn that a stored curse strikes for 10 | Cursed Spirit Manipulation; Uzumaki compresses his curses into one blast |
| Yuta Okkotsu · domain | Katana (Strike) · Rika 80·90·30 · **Authentic Mutual Love** 55 + 18/turn; each strike is a copied technique | Bottomless Cursed Energy: +5 CE per turn | Rika, Queen of Curses; his domain holds copied techniques |

Lore source: the Jujutsu Kaisen Fandom wiki pages could not be fetched from this environment (the site returned HTTP 402 to every request). The lore notes above come from general knowledge of the manga/anime and your hand-sign guide, not from the wiki pages themselves.

## Balance check

`node scripts/balance.mjs [battles]` runs AI-vs-AI battles for every matchup, alternating sides. `tests/battle.test.mjs` checks that every fighter's overall win rate stays between 38% and 64%, and that the fighters without a domain are within 30–70% of each other. The table shows 1,000 battles per pairing (row fighter's win rate):

```
           gojo megumi sukuna  choso    ryu   yuji   toji   geto   yuta    avg  turns
gojo          -    31%    44%    35%    53%    61%    49%    60%    50%    48%    8.4  domain
megumi      66%      -    47%    69%    50%    46%    49%    56%    57%    55%    9.0  domain+mahoraga
sukuna      56%    53%      -    45%    43%    41%    49%    59%    44%    49%    7.8  domain
choso       65%    31%    54%      -    41%    37%    62%    56%    47%    49%    7.9
ryu         47%    51%    56%    57%      -    45%    63%    55%    54%    54%    7.6  domain
yuji        38%    56%    61%    62%    54%      -    35%    56%    57%    52%    8.2  domain
toji        51%    51%    49%    38%    35%    66%      -    51%    44%    48%    7.9
geto        38%    42%    44%    44%    47%    45%    52%      -    38%    44%    9.3
yuta        48%    45%    56%    53%    49%    44%    60%    57%      -    51%    7.7  domain
```

Every fighter wins 44–55% overall, and Megumi (Mahoraga + a domain) is at the top with 55%. Individual matchups vary, as type matchups do in Pokémon. For example, Toji's immunities beat Yuji's Black Flash, and Mahoraga's adaptation beats Gojo's repeated techniques. The simulated AI is simple, so human play will differ.

## Online

The server holds the battle state:
- A turn resolves once both players have locked in a move.
- Each player sees only that the opponent has chosen, never which move.
- A player with no move chosen 30 seconds after the previous turn's text finishes gets one picked automatically.
- Lobby, ready-up, disconnect forfeit, result banner and rematch work as before.
