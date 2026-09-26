# DomainClash

Webcam hand tracking and gesture recognition prototype with guided personal sign recording. The Combat tab includes a basic match prototype.

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

| Character | Abilities | Ultimate | Future meter |
| --- | --- | --- | --- |
| Satoru Gojo | Reversal: Red, Amplification: Blue | Domain Expansion: Unlimited Void | Domain |
| Megumi Fushiguro | Ten Shadows: Shikigami Summon — Nue, Demon Dogs, Mahoraga | Domain Expansion: Chimera Shadow Garden | Domain |
| Ryomen Sukuna | Cleave | Domain Expansion: Malevolent Shrine | Domain |
| Choso | Piercing Blood | Supernova | Blood |
| Ryu Ishigori | Granite Blast | Way Too Sweet! | Ultimate (provisional resource label) |

Hollow Purple is deferred. Meter types now label the prototype resource; character-specific resource mechanics remain provisional. Ryu uses a neutral ultimate meter label until resource mechanics are specified. Each summon has its own sign. Demon Dogs retains the DIVINE_DOGS storage key to preserve existing recordings.

Character switching cancels captures and resets recognition. Other characters' signs remain intact. Dismantle and the old shared Domain Expansion key are ignored when reading older backups. New moves remain inactive until recorded.

## Guided recognition demo

Choose **Start sign demo** after the camera is ready. Lower both hands out of view between trials, wait for the countdown, then perform the named sign. A pass requires the existing recognizer's stable hold confirmation against the character's full kit. Choose Next sign after a pass, Retry sign to repeat, or Skip sign to flag a miss. Missing recordings are listed separately. Basic Punch is tested once under Gojo. Export the test report to review incorrect matches and skipped signs. This test never changes saved pose references; a pass is evidence for that trial, not a guarantee across lighting and camera angles.

Recording stability uses palm positions, with a 300 ms grace period for brief tracking glitches. Finger-tip and depth jitter do not trigger movement cancellation. Fingers still contribute to recognition; occlusion can still make a sign difficult to distinguish.

One-handed signs match either hand through horizontal reflection of the saved reference. Existing recordings require no conversion. Keep a similar finger shape and palm-facing direction. Two-handed signs retain their original spatial relationships.

For difficult signs, add 3–5 examples with small natural angle changes. Each capture contributes multiple samples; the displayed count is samples, not recording sessions. Up to 250 samples per sign are retained. At the limit, adding fails without removing existing data. Backup export/import includes all examples.

## Recognition troubleshooting and development inputs

Use **Check a problem sign** outside the guided demo. Select the expected move, perform it, and read whether tracking lost a hand, the pose differs from saved references, or another sign is too similar. Export diagnostic report captures up to 30 seconds of sampled scores and hand counts, with no video. A current-frame pose match does not bypass the recognizer's hold and debounce.

Manual ability test buttons send the same typed ability inputs as camera confirmations, with a distinct source marker. They work without a camera, are disabled during the guided demo, and do not produce sign-test passes. The Combat tab includes a basic match prototype. For poses whose fingers remain occluded, an easier substitute recorded under the same move is an available gameplay control.

A clearly strongest pose can now qualify through a slower acceptance path: its distance must stay below 1.5 times the normal cutoff and lead its nearest rival by at least 0.02 and 20% of its own distance. This path requires at least a one-second hold, preserving the existing brief-gap pause, hand-count protection and debounce. A closest label alone is not acceptance; distant and ambiguous poses remain rejected. These thresholds need live validation.

## Combat milestone

Select a character and open Combat, then Start match. Both sides start with 100 HP. Basic Punch deals 4 damage, adds 10 meter, and has a 0.7-second cooldown. Character abilities deal 8 damage, add 20 meter, and have independent 1.8-second cooldowns. Ultimates require 100 meter, deal 30 damage and consume the meter. The opponent deals 5 damage every 3 seconds. Only accepted hits build meter.

Choso uses Blood; Gojo, Megumi and Sukuna use Domain; Ryu uses Ultimate. Blood generation and consumption currently follow the same prototype charging rules, pending dedicated Choso mechanics. All attacks automatically hit; summons and domains have placeholder damage, without cinematic or persistent effects yet. Match simulation pauses outside Combat and while the document is hidden. Character changes reset the match. Restart clears health, cooldowns and meter. Buttons and camera signs use the same combat rules. Balance constants are in src/combat/CombatManager.ts.

Basic Punch uses a 0.23 matching cutoff (previously 0.19), retaining stability and ambiguity checks.

## Turn-based update

The current duel alternates player actions and one automatic opponent response after a 1.5-second technique reveal. There is no time limit on the player's choice. Basic Punch is available every player turn; other techniques require one intervening player turn before reuse. Cooldowns are now turns, superseding the earlier millisecond balance notes. Leaving Combat pauses response timing. Technique names animate across the screen, with a reduced-motion alternative.

Open #characters (or Change fighter) for the five-character portrait grid. Hover, focus, or tap to preview, then Enter the arena to select. Artwork is remotely loaded manga imagery with source links in the selection screen and URLs in src/characters/Portraits.ts. No generated artwork is used. Remote images may be unavailable if their host blocks loading.
