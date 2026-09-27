# Original controls and character effects

The active app is `src/progress/main.ts`. The older `src/game/Game.ts` renderer is not the app entry point.

## Recognition preserved

Compared against `/Users/epacheco/Projects/DomainClash/src/handTracking` on September 26, 2026: the recognizer, geometry, filtering, tolerance, KNN matcher, tracker and types are identical. Gesture definitions export `withLearning` for the combined roster adapter and use the requested 300-instance Trusted threshold. The original project is unchanged. Progress and online move IDs remain mapped to the original dataset labels; the 500 ms hold, 0.7 entry threshold, 0.45 release threshold, 0.15 ambiguity margin and release latch are preserved.

Press **D** or **Debug (D)** for the original blue Left / orange Right landmarks and wrist identifiers, finger states, confidence, candidate/confirmed recognition, scores, original dataset labels, guide numbers and per-check explanations. The original debug renderer and panels were brought across from the original project. The score panel updates at 10 Hz; recognition still processes each new camera frame.

**Gesture settings → Record** is the only training screen (Sign Demo, Diagnose, Manual and the second trainer were removed). Choose an ability, hold the posture, press Record posture (R), then Stop recording (R) when finished. Each new tracked hand frame is saved once; empty frames and repeated frame timestamps do not count. The live count marks the ability Trusted at 300 saved instances and recording continues until stopped. Frames are written in batches and the matcher retrains once recording stops, so saving keeps up with the camera and Stop finishes promptly. Import merges (never deletes or replaces) and Export writes the original dataset format, including any combined-build pose recordings in an extra field the original importer ignores. Browser storage is scoped to the address/port: export recordings from the original site's address and import them here when the two copies use different origins.

## Visuals

Every active ability is mapped to cropped Jujutsu Kaisen anime imagery or manga excerpts; Mahoraga retains the supplied cutout. The previous procedural attack shapes and comic-frame fallback are removed. See [technique-art-sources.md](technique-art-sources.md) for provenance and shared imagery used by game-specific actions, and `public/art/techniques/sources.json` for crop metadata.

Images are cropped and masked offline into optimized WebP assets. They are animated still-image cutouts, not extracted video sequences. No AI image generation was used. Runtime loads are local to the game.

## Performance and validation

- Removed duplicate geometry/filter/KNN evaluation from the active recognition path. Regression test compares confirmation/release events against the previous path.
- Effects use a single demand-driven loop per visible camera pane, bounded at 12 simultaneous casts. Idle, hidden and disposed layers stop scheduling frames.
- Cached prepared technique sprites; no per-particle blur filters or camera redraw into the effects canvas.
- Pixel width capped at 1440, device scale capped at 1.5, with gradual quality reduction under sustained frame pressure. Recognition and debug overlay resolution are independent.
- Technique art fits the actual viewport pixels, with no fixed 16:9 letterbox. Directed attacks enlarge toward the viewer from the center. Domains cover the full combat area; summons preserve their proportions.
- Opponent network effects use the opponent pane. Combat rules and server authority are unchanged.
- Debug includes camera-free effect previews and render diagnostics. Draw time is JavaScript submission time, not total GPU time or webcam inference time.

Run `npm test` and `npm run build`. Tests cover all effect lifetimes, queue bounds, visibility/disposal, recognition equivalence and accepted/rejected combat effects. Live webcam accuracy and a two-person online session still need hands-on testing; no end-to-end FPS guarantee is implied.
