# DomainClash — Cursed Technique Studio

A Jujutsu Kaisen-inspired augmented-camera experience: your live webcam is the main scene, and animated cursed techniques emerge from tracked palms and fingertips. There are no stick-figure fighters. Canvas compositing combines the mirrored camera with layered glows, energy ribbons, particles, beams and liquid shadows.

## Start

```powershell
cd C:\Users\giann\DomainClash
npm ci
npm run dev
```

Open the URL printed by Vite and choose **Enable my camera**. Use localhost or HTTPS, allow camera access, and keep your hands inside the camera image. Solo camera frames remain in the browser. In a private match, an authenticated live preview is shared with the opponent. MediaPipe model/WASM files are bundled under public/tracking and served by the same website.

**Preview effects** works without a camera: move the pointer over the scene to position the source, then press `1`, `2` or `3`. The technique cards also activate effects. If a hand is tracked, keyboard activation uses that hand instead of the pointer.

## Techniques and controls

All **18 moves** appear in the launch guide with hand arrangements, effect descriptions, sound motifs, cooldowns, and notes about webcam approximations. The supplied reference illustration can be expanded in the guide. Open **Move guide** at any time to review it.

The preview dock always shows **three cards**. Scroll up/down over the cards, swipe vertically, click the arrow controls, or press `PageUp`/`PageDown`. Keys `1`–`3` cast the current visible cards. All hand gestures remain armed on every page. Scrolling only changes the preview cards and keys 1–3.

- **Cleave**: Open palm. Cooldown 1s.
- **Piercing Blood**: Index out; ring + pinky folded. Cooldown 1s.
- **Chimera Shadow Garden**: Two close, clasped fists. Cooldown 14s.
- **Malevolent Shrine**: Middle + ring up; index + pinky curled. Cooldown 15s.
- **Unlimited Void**: One hand; crossed index + middle. Cooldown 13s.
- **Coffin of the Iron Mountain**: Interlace diagonally; fingers partly bent. Cooldown 14s.
- **Self-Embodiment of Perfection**: Thumbs together; raised finger steeple. Cooldown 14s.
- **Authentic Mutual Love**: One upright palm + one fist. Cooldown 14s.
- **Horizon of the Captivating Skandha**: Cupped clasp; palms slightly apart. Cooldown 14s.
- **Yuji Itadori’s unnamed domain expansion**: Paired upright index fingers. Cooldown 13s.
- **Womb Profusion**: Crossed raised fingers; lower fingers folded. Cooldown 15s.
- **Idle Death Gamble**: Pinch circle above a flat palm. Cooldown 15s.
- **Ryu Ishigori’s unknown domain expansion**: Thumb arch; index + pinky lifted. Cooldown 14s.
- **Takako Uro’s unknown domain expansion**: Cross wrists; fists with thumbs out. Cooldown 14s.

Additional regular moves: **Lapse Blue**, **Reversal Red**, **Hollow Purple**, and **Black Flash**. All six regular attacks share one second of recovery. Their effects finish within half a second, and a new regular cast clears the previous effect.

Hold domain signs for 650ms (Cleave 380ms, Piercing Blood 420ms), then relax for at least 180ms before repeating. Shadow Garden now uses a closed clasp, replacing the old open-palm shortcut. Interlaced/hidden fingers use documented silhouette approximations; use the cards when tracking struggles.

**Free cast** is the default: every technique is unlocked, health stays full, and domain meter refills. Cooldowns still apply, and domains cannot overlap. Domains have 2.4-second openings, 7–9-second active environments, and 13–15-second cooldowns measured from activation. **Reset** clears the session for demonstrations. **Duel mode** restores HP, enemy attacks, meter and win/lose rules.

`P` / `Esc`: pause. `D`: diagnostics. **Sound on/off**: mute. **Stop camera** releases the device. Hidden tabs pause the simulation.

Research, precise hand instructions, references and interpretation notes are in [DOMAIN_RESEARCH.md](docs/DOMAIN_RESEARCH.md). Ryu and Uro's VFX are explicitly interpretations because their domains' details are unrevealed.

## Private multiplayer

Build and start the shared server:

```powershell
npm run build
npm start
```

Open `http://localhost:3001`, select **Private match**, create a room, and share its code. The other player must open the **same server URL** and join with that code. Both press Ready. The server owns HP, energy, cooldowns, damage, domain overrides and clashes; each player sees themselves on the left and their opponent on the right. Creating or joining starts camera permission and tracking automatically.

For computers on different networks, deploy the included Node service using `render.yaml` or `Dockerfile`, then share its HTTPS URL. Localhost URLs are not accessible from your friend's computer. Full setup, LAN-camera instructions, match rules and limits: [MULTIPLAYER.md](docs/MULTIPLAYER.md). Research and domain tiers: [BATTLE_RESEARCH.md](docs/BATTLE_RESEARCH.md).

## Rendering and architecture

- `CameraProjection.ts`: shared, mirrored coordinate transform for the camera and hand landmarks. The full source image is contained in the scene; a dim, blurred copy fills unused sides. This avoids cropping hands out of the main image.
- `GameRenderer.ts`: live video compositing, hand aura, cast lifecycle and typography. DPR is capped at 1.5; particle and cast lists are bounded.
- `TechniqueEffects.ts`: Cleave, Piercing Blood and Shadow Garden. `ExpandedDomains.ts`: eleven distinct additional domain environments.
- `MoveCatalog.ts`: names, instructions, duration and cooldowns. `DomainSigns.ts`: silhouette detection. `DomainSounds.ts`: twelve distinct domain sound profiles.
- `VfxPrimitives.ts`: additive glows, lightning ribbons, rings and particles.
- Camera, tracking, recognition, combat, Domain state, audio and UI remain independent modules.

The current effects use real-time Canvas 2D compositing with perspective-like rings and layered lighting. They do not reconstruct the room or segment the body for physical occlusion. Released projectiles retain their launch position; the blood charge follows the fingertip until firing. Camera projection and mirroring are tested at wide and portrait sizes.

TypeScript, Vite, MediaPipe Hand Landmarker 0.10.21, Canvas 2D and Web Audio. All effect geometry is generated at runtime; no ripped video/audio assets are required. Visual references are recorded in [ART_DIRECTION.md](docs/ART_DIRECTION.md).

## Verify

```powershell
npm test
npm run typecheck
npm run build
npm run preview
```

49 automated tests cover combat/gesture regressions, camera errors, audio, camera projection, effect origins and free-cast safety. Browser smoke checks cover the studio layout and technique activation. See [VERIFICATION.md](docs/VERIFICATION.md) for remaining real-hand checks.

## Tuning

`MoveCatalog.ts` owns move cooldowns, domain durations and hold times. `GameConfig.ts` owns base combat rules and tracking settings. The rendering modules own animated geometry. Audio uses distinct synthesized cues; optional original/licensed files can be configured in `AudioManager` through `GameConfig.audio`.

Duel mode retains 100 HP per side; Cleave deals 5 damage and adds 10 meter, Piercing Blood deals 12 and adds 20. A full meter activates a 2.4-second Domain cinematic, followed by 7–9 seconds of boosted damage and periodic hits. Free cast removes health/meter constraints but keeps cast timing.

## Remaining improvements

Real-user calibration under different lighting, faster worker-based tracking, body-aware occlusion, WebGL volumetric effects and richer sound design. Spring Boot/PostgreSQL remain deferred.

In camera mode, a hand must be visible before casting, including keyboard-triggered casts. This prevents effects from appearing at an unrelated screen position when tracking is lost. Capture requests 960x540 at 24 FPS where supported; lower-resolution cameras remain compatible.

Multiplayer uses direct WebRTC video where supported, live WebSocket match updates and immediate local regular-attack feedback. Hand tracking runs in a background worker. The on-screen connection status identifies slower fallback connections. See `/connection-check.html` for a synthetic transport/tracking check.
