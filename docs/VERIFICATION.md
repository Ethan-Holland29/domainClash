# Verification — camera VFX studio

## Automated checks

`npm test`: **21 tests pass**. `npm run build`: TypeScript and Vite production build pass.

Coverage includes:
- Gesture stability, release/rearm, held-pose spam prevention, missing/invalid landmarks, two-hand priority and scale tolerance.
- Health, cooldowns, windups, meter, Domain gating, cinematic/active duration, match outcomes and restart.
- Camera-denial errors and stream cleanup with media-device mocks.
- Distinct generated audio cues, unlock, mute and cleanup with Web Audio mocks.
- Shared camera projection: mirror exactly once, retain the full image, and align landmarks at wide and portrait viewport sizes.
- Palm source for Cleave, fingertip source and mirrored direction for Piercing Blood, midpoint source for Domain, and deterministic pointer preview.
- Free cast cannot kill either fighter and preserves cast timing; switching back restores Duel rules.

Duel simulations still win after using Domain: primary-only ~13.3s, secondary-only ~14.8s, mixed ~9.1s. Those optimal keyboard runs are regression checks, not human balance studies.

## Browser checks completed

- Studio menu, camera-centered layout and free-cast controls render.
- Camera/model initialize; a tracked hand is reported in the live status badge.
- Full mirrored camera image is visible in the main scene with a blurred side fill.
- Red convergence orb is visually composited over live video.
- In camera-off preview, Cleave produces the fan of luminous cuts, Piercing Blood produces the red/white beam, and Domain produces the expanding transition followed by liquid shadows and tendrils.
- Domain transitions to active and expires; technique availability returns.
- MediaPipe emits internal delegate/feedback/projection initialization messages, including an informational CPU delegate line logged at error level. No application exception was observed during these smoke checks.

## Remaining real-hand checks

- Move either hand across the frame: verify fingertip charge alignment and palm slash alignment, especially near image edges.
- Try both hands together and confirm Domain starts between them.
- Test bright/dim lighting, close/far hands, fast motion and finger occlusion.
- Hold a pose for several seconds; it should cast once until released.
- Confirm tracking loss removes aura and camera-mode input requests a visible hand instead of casting at a fallback position.
- Resize during live tracking and assess actual camera/device frame rate.

No camera screenshots or recordings are stored in the project. Effects use 2D compositing; there is no room-depth reconstruction or body-aware occlusion. Automated geometry tests cannot establish real-world hand-recognition accuracy.


## Fourteen-move expansion (September 26, 2026)

- 28 automated tests pass. Added coverage for all domain identities/timers/cooldowns, non-overlap, all eleven new canvas draw paths at multiple phases, distinct audio profiles, five three-card pages, off-page recognition filtering, and positive/negative synthetic pose fixtures for every new domain.
- Browser: all eleven new move buttons activated with cooldown feedback; wheel scrolling changed the three-card page; first/last page bounds worked; no captured console errors. Visual inspection included Shrine, Void, volcanic rocks/lava and jackpot reels.
- Responsive check at 390x844: no document-width overflow, three long-name cards fit their heights, guide contains all 14 entries with no horizontal overflow, start/resume button remains reachable.
- Real-person recognition accuracy for the newly added interlaced poses has NOT been validated. Synthetic landmarks confirm geometric paths, not tracking reliability or user accuracy. Test varied skin tones, hand proportions, lighting, occlusion and orientation before claiming robust recognition.
- Audio profiles have distinct rhythms, pitches and textures; final subjective listening on the user's speakers remains useful. Domain environments are procedural Canvas 2D, not filmed CGI or 3D reconstruction.


## Private multiplayer and global gestures

- 43 automated tests pass, including an actual HTTP server test with separate session tokens. Every move can be recognized independently of the preview page. Four new regular gesture fixtures confirm distinct winning recognition paths. Regular visual replacement/expiry and cross-move recovery have regressions.
- Real browser check with two independent tabs against the production Node server: created a private room, joined by code, both readied, shared countdown, Cleave reduced the other client from 100 to 92 HP, Shrine/Void produced a same-second clash with both environments shown and no overlapping sure-hit damage, and leaving awarded victory to the remaining player. No captured console errors.
- Domain edge tests: exactly 1000ms accepted; 1001ms equal response rejected; stronger override; lower-tier rejection; shared domain cooldown; sure-hit resumption after one domain expires; stale input rejection.
- Match edge tests: energy exhaustion, guard, simultaneous knockout draw, disconnect, both-disconnected draw, time limit, room isolation, unauthorized access, full rooms, invalid IDs, state freeze after finish.
- Narration uses the browser's available speech voice; subjective voice/audio quality and newly added real-hand gestures still require user testing. Cross-Internet play requires hosting and has not been tested on two physical computers.


## Background-tracker timing regression

Fixed the camera capture timestamp being used as the arrival/freshness clock for asynchronous inference. Each result now includes main-thread receipt time. A TrackingInput adapter consumes each result once, keeps its landmarks visible between arrivals, and uses a bounded cadence-aware expiry (350–1500 ms). Gesture progress uses only fresh samples, with at least four matching observations still required. A tracker stall suspends a pending hold without re-arming a previously cast pose; genuinely empty results can still release it. Results delayed more than two seconds are rejected.

52 tests pass, including a simulated 450 ms inference delay with results every 500 ms, duplicate-frame/stall handling, explicit release, and out-of-order/overly old results. This regression is exercised through the same adapter used by Game, with real gesture geometry. No physical webcam accuracy claim is made by these synthetic tests.
