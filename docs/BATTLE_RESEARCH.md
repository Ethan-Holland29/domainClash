# Battle research and balance decisions

Research date: September 26, 2026. These sources describe fictional techniques; game damage and cooldown numbers below are deliberate balancing decisions.

## New regular techniques

- [Cursed Technique Lapse: Blue](https://jujutsu-kaisen.fandom.com/wiki/Cursed_Technique_Lapse%3A_Blue) uses attraction. The effect collapses blue ribbons into the hand; the game uses a tucked-thumb fist shortcut.
- [Cursed Technique Reversal: Red](https://jujutsu-kaisen.fandom.com/wiki/Cursed_Technique_Reversal%3A_Red) produces repulsion. A red orb and expanding shock rings express that behavior. Its camera shortcut is a thumb/index circle with the other three fingers extended.
- [Hollow Purple](https://jujutsu-kaisen.fandom.com/wiki/Hollow_Technique%3A_Purple) combines Blue and Red. Two colored cores converge into a rapid purple projectile. The source describes an index/little-finger sign followed by a release sequence; the game recognizes the initial one-hand silhouette.
- [Black Flash](https://jujutsu-kaisen.fandom.com/wiki/Black_Flash) is a precisely timed impact associated with black lightning; it cannot canonically be used at will. The game deliberately makes it a selectable attack, using an outward-thumb fist and a short black/crimson impact. This qualification is in the launch guide.

Purple gets the highest regular damage but the largest energy cost. Red trades higher damage for greater energy consumption than Blue. Black Flash is a strong compact strike. Cleave remains the sustainable low-cost option, while Piercing Blood occupies the middle. The balance table is in [MULTIPLAYER.md](MULTIPLAYER.md), and authoritative values are in `server/rules.json`.

## Domain refinement

[Unlimited Void](https://jujutsu-kaisen.fandom.com/wiki/Unlimited_Void) describes its equal refinement with Malevolent Shrine and cancellation of guaranteed hits during their clash. [Malevolent Shrine](https://jujutsu-kaisen.fandom.com/wiki/Malevolent_Shrine) describes how its open barrier can additionally attack an opposing barrier from outside. Those are distinct concepts: equal refinement does not imply identical barrier behavior or an inevitable tie in every canonical encounter.

The game intentionally follows the user's requested one-second coexistence rule. It does not simulate barrier size changes, binding vows, external barrier destruction or every sorcerer's changing condition.

| Game tier | Domains | Basis and uncertainty |
| --- | --- | --- |
| 3 · Master | Unlimited Void, Malevolent Shrine | Their equal refinement is directly described in the cited account; Void also overwhelms Jogo's domain. |
| 2 · Advanced | Womb Profusion | Balance interpretation of Kenjaku's exceptional barrier skill and open domain. Its ordering against every listed domain is not canonically established. |
| 1 · Complete | Iron Mountain, Self-Embodiment, Mutual Love, Captivating Skandha, Yuji, Death Gamble, Ryu, Uro | Neutral baseline for the remaining complete/unknown domains, not a claim they all canonically tie. Unknown Ryu/Uro effects remain labeled interpretations. |
| 0 · Incomplete | Chimera Shadow Garden | Gameplay interpretation of Megumi's incomplete barrier; he can disrupt other domains in the story, which this simplified ranking does not fully reproduce. |

Additional context: [Womb Profusion](https://jujutsu-kaisen.fandom.com/wiki/Womb_Profusion), [Chimera Shadow Garden](https://jujutsu-kaisen.fandom.com/wiki/Chimera_Shadow_Garden), and [Domain Expansion](https://jujutsu-kaisen.fandom.com/wiki/Domain_Expansion). No invented ranking is presented as a definitive canon hierarchy. All standard-tier equal casts can clash in the game. Damages, energy, global cooldown locks, and this tier table should be playtested with real players and adjusted as balance data accumulates.
