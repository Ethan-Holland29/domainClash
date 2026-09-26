# DomainClash

Webcam hand tracking and gesture recognition prototype with guided personal sign recording. The Combat tab includes a turn-based duel with character-specific passives and effects.

## Run

Use Node 22.12+ and run `npm install`, then `npm run dev`. Open the local address printed by Vite in a browser with webcam support. `npm run build` checks TypeScript and creates the production build.

## Teach your signs

Allow the camera, select a move, and choose **Record this sign**. You have five seconds to prepare and then hold the sign still for two seconds. Choose **Save as another example** to add the capture without removing earlier examples. **Replace examples & next** replaces all examples for this sign. Choose a character, then record only the moves you want to use. Ultimate signs can be recorded later. One or two hands are supported for any recorded move. This records your chosen pose, rather than prescribing choreography.

References contain numerical landmarks, not pictures or video. They are saved in this browser for this exact site address (including its port). Export a JSON backup before switching browsers, addresses, or clearing browser data. Import merges a backup, replacing matching moves.

Recognition uses only saved references assigned to the selected character. Unsaved moves stay disabled. Similar-looking signs within the selected character are rejected or left unrecognized to reduce accidental activations. Recording and review temporarily suppress gesture events.

## Limitations

This is template matching, not a trained machine-learning model. Hold signs at a similar orientation to your recording. Palm scaling and wrist-relative coordinates accommodate moderate distance and position changes. Overlapping fingers, tracking errors, and nearly identical signs can still be difficult to distinguish. Live thresholds need testing with your own webcam.

The MediaPipe runtime and hand model are served from public/wasm and public/models to avoid depending on a remote model load each session. If updating @mediapipe/tasks-vision, refresh public/wasm from that package's wasm directory.

## Character setup

Basic Punch remains a shared attack. Character kits:

| Character | Abilities | Ultimate | Meter |
| --- | --- | --- | --- |
| Satoru Gojo | Reversal: Red, Amplification: Blue | Domain Expansion: Unlimited Void | Domain |
| Megumi Fushiguro | Ten Shadows: Shikigami Summon — Nue, Demon Dogs, Mahoraga | Domain Expansion: Chimera Shadow Garden | Domain |
| Ryomen Sukuna | Cleave | Domain Expansion: Malevolent Shrine | Domain |
| Choso | Piercing Blood | Supernova | Blood |
| Ryu Ishigori | Granite Blast | Way Too Sweet! | Ultimate (provisional resource label) |

Hollow Purple unlocks during combat after two uses each of Red and Blue. It currently uses a button rather than a recorded sign. Ryu uses an Ultimate meter label. Each summon has its own sign. Demon Dogs retains the DIVINE_DOGS storage key to preserve existing recordings.

Character switching cancels captures and resets recognition. Other characters' signs remain intact. Dismantle and the old shared Domain Expansion key are ignored when reading older backups. New moves remain inactive until recorded.

## Guided recognition demo

Choose **Start sign demo** after the camera is ready. Lower both hands out of view between trials, wait for the countdown, then perform the named sign. A pass requires the existing recognizer's stable hold confirmation against the character's full kit. Choose Next sign after a pass, Retry sign to repeat, or Skip sign to flag a miss. Missing recordings are listed separately. Basic Punch is tested once under Gojo. Export the test report to review incorrect matches and skipped signs. This test never changes saved pose references; a pass is evidence for that trial, not a guarantee across lighting and camera angles.

Recording stability uses palm positions, with a 300 ms grace period for brief tracking glitches. Finger-tip and depth jitter do not trigger movement cancellation. Fingers still contribute to recognition; occlusion can still make a sign difficult to distinguish.

One-handed signs match either hand through horizontal reflection of the saved reference. Existing recordings require no conversion. Keep a similar finger shape and palm-facing direction. Two-handed signs retain their original spatial relationships.

For difficult signs, add 3–5 examples with small natural angle changes. Each capture contributes multiple samples; the displayed count is samples, not recording sessions. Up to 250 samples per sign are retained. At the limit, adding fails without removing existing data. Backup export/import includes all examples.

## Recognition troubleshooting and development inputs

Use **Check a problem sign** outside the guided demo. Select the expected move, perform it, and read whether tracking lost a hand, the pose differs from saved references, or another sign is too similar. Export diagnostic report captures up to 30 seconds of sampled scores and hand counts, with no video. A current-frame pose match does not bypass the recognizer's hold and debounce.

Manual ability test buttons send the same typed ability inputs as camera confirmations, with a distinct source marker. They work without a camera, are disabled during the guided demo, and do not produce sign-test passes. The Combat tab includes a turn-based duel with character-specific passives and effects. For poses whose fingers remain occluded, an easier substitute recorded under the same move is an available gameplay control.

A clearly strongest pose can now qualify through a slower acceptance path: its distance must stay below 1.5 times the normal cutoff and lead its nearest rival by at least 0.02 and 20% of its own distance. This path requires at least a one-second hold, preserving the existing brief-gap pause, hand-count protection and debounce. A closest label alone is not acceptance; distant and ambiguous poses remain rejected. These thresholds need live validation.

## Combat and selection

Select a character, choose an opponent, and start a match. The duel alternates one action per fighter, with a 1.5-second opponent response delay and no time limit on the player's choice. Leaving Combat or hiding the page pauses response timing. Switching characters or restarting clears match state. Buttons and recorded camera signs use the same combat rules; technique names animate with a reduced-motion alternative.

Character selection has nine filled square slots, using local artwork and character backgrounds. Hover, focus or tap a character to preview, then confirm. Basic Punch recognition uses a 0.23 matching cutoff with stability and ambiguity checks.

## Current combat rules (notebook implementation)

The universal stats supersede the earlier prototype balance: 200 HP; punch damage 10, meter gain 5, miss chance 10%; techniques gain 20 meter with a 5% miss chance. At least 100 meter is required for an ultimate; all accumulated meter is spent when used. Player and computer fighters use the same rules. Pick the opponent before starting a match.

Gojo has Limitless (20% incoming damage reduction below 40 meter), Red (20 damage), Blue (10 damage and drains 20 opposing meter), Unlimited Void (40 damage and two enemy attack attempts with a 33% chance to self-hit for 5 instead), and Hollow Purple (100 damage, unlocked after two uses each of Red and Blue, followed by three skipped attack turns). Purple currently uses a button because no gesture has been recorded for it.

Megumi has Shadow Dweller (10% chance at the start of his turn to deal 10 damage and gain 10 meter), Demon Dogs (heal 20 and bite for 5 on three turns while allowing normal attacks), and Nue (equal odds of 15/20/30/5 damage). Dogs and Nue are once per match; Chimera Shadow Garden deals 20 and randomly refreshes one summon. Below 50 HP, Mahoraga can be called: Megumi stays active through three opposing responses, then is sacrificed and replaced by Mahoraga with 30 HP and 30 attack damage. Mahoraga starts at half incoming damage and halves it again each turn, with damage rounded down. Its victory or defeat ends the Megumi player's match.

Explicit interpretation choices: healing caps at the fighter’s maximum HP; each turn means that fighter's own turn; dogs first bite on the summoning turn; missed moves still gain/spend meter and count as uses; summons consume their attempt even on a miss; Hollow Purple costs 100 meter; adaptation has no cap, so sufficiently adapted damage rounds down to zero.

Run `npm test` for the deterministic combat regression suite and `npm run build` for the application build. Character selection now has nine filled square slots.

Regular cursed techniques now have independent two-turn cooldowns. Gojo's Red and Blue each have a three-turn cooldown; Ryu's Granite Blast has a one-turn cooldown. These count full subsequent turns of the user of the move: Red on turn 1 is blocked on turns 2–4 and ready on turn 5. Misses also start cooldowns. The computer obeys the same restrictions. Punches and ultimates keep their existing rules; Megumi's summons remain governed by their one-use restrictions and Chimera Shadow Garden refresh, not timed cooldowns.


### Ryu, Choso and Sukuna

- **Ryu — Jane, You’re Early:** Granite Blast starts at 25 damage, loses 5 per attempted use (minimum 5), grants 15 meter, and has a one-turn cooldown. Way Too Sweet heals 40 HP (capped at 200) and restores blast damage to 25; it does not damage the opponent or clear an existing cooldown.
- **Choso — Flowing Red Scale:** Each cumulative 10 actual HP lost grants one blood stack; partial damage carries over. Piercing Blood deals 20, or 35 if Megumi successfully summoned Nue or Demon Dogs during his current or preceding turn. Supernova deals 40, forces the opponent to spend their next turn wiping blood, and consumes all blood stacks to apply 5 damage per affected turn for one turn per stack. The first blood tick is at the start of the blinded turn. Defensive reductions still apply. Repeated Supernova extends bleed duration without multiplying its per-turn damage. Blood stacks and the 100-point Blood meter are separate resources.
- **Sukuna — Finger Lickin’:** Starts at 175 HP; punches deal 5. At the end of each third completed turn, automatically eats one finger (maximum five), gaining 10 current/max HP and 10 meter. Maximum HP reaches 225. Cleave deals 15 + 10 per finger. Meter can overcharge to 150. Malevolent Shrine spends all meter and deals 15 per complete 30 meter: 45 at 100–119, 60 at 120–149, 75 at 150.

The crossed-out Sukuna parry/bleed passive is not implemented. Existing miss rules apply: attempted moves spend meter, trigger cooldowns and consume Choso's stacks even on a miss; a missed Supernova adds no opponent effects and a missed Way Too Sweet does not heal/reset. Skipped turns count toward finger timing and cooldowns. When blindness overlaps Hollow Purple recovery, the same skipped turn advances both counters. All nine kits apply equally to the computer opponent.

### Final four playable kits

- **Yuji — Unbreakable Spirit:** Punches have a 33% chance to Black Flash for double damage. Receives double technique damage and 33% less ultimate damage, rounded down per hit. Straight Hands costs 80 meter and rolls four independent 10/20-damage hits.
- **Toji — Heavenly Restriction:** Ignores passive bonus damage (including Shadow Dweller, Curse Army attacks and stack-based bleeding) and bypasses passive defenses. Does not disable opponents’ meter gains or Sukuna’s finger benefits. Punch deals 15 and grants 10 meter. At 100 meter his next turn automatically loses 20 HP, clears meter and skips. Cursed Tools uniformly rolls 30/35/40 damage; on hit, 33% chance to give the opponent +10 damage on their next turn, consumed even if they miss/skip.
- **Geto — Curse Army:** Each own turn rolls Grade 3 (25%, 5 damage), Grade 2 (40%, 10 damage and 10 meter), Grade 1 (25%, 10 meter and 33% damage reduction through the following opponent turn), or Special (10%, 50 meter). Curse Swallow heals 30 up to max HP and pauses the next two summons. Uzumaki rolls ten spirits with these probabilities, sums +5/−5/+10 for Grades 3/2/1, doubles once per Special, halves once if above 100, floors and clamps at zero.
- **Yuta — Bottomless Cursed Energy:** Every attack attempt grants 5 extra meter, including Copy. Rika deals 20 and transfers up to 15 available enemy meter. Copy uniformly rolls another ultimate, including Hollow Purple, retaining extra effects and applying 80% damage/healing, rounded down. Megumi/Sukuna/Choso receive +10 base damage before scaling. Copied Chimera grants a one-time Nue or Demon Dogs action; copied Purple requires three recovery turns; copied Supernova blinds but has no blood stacks to spend. Copy cannot roll itself or Toji (no ultimate).

New techniques use the normal two-turn cooldown. Existing miss rules remain. All kits work for the opponent AI and reset completely between matches. Six new recording slots are available; buttons work immediately, camera signs require recording. Borrowed Chimera summons use their on-screen action button. Portraits and supplied backgrounds remain unchanged.

Passive activation banners appear under the camera (blue Player 1, red Player 2), queue for 2.4 seconds each, and put their character message in the battle log. Ryu announces his constant passive at match start; Gojo announces Limitless at match start and whenever his meter falls from 40 or higher to below 40, Megumi successful sabotage, Choso new stacks, and Sukuna each finger. Simultaneous activations show Player 1 first. Restart clears queued banners.
