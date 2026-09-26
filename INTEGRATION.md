# Test-Integration-All-1

This integration keeps the `domainclash-progress` artwork, nine-character roster, solo UI, move damage, passives, meter, turn rules and per-move cooldowns. Multiplayer uses the same CombatManager on the server; the second player replaces the bot.

## Source revisions

| Source | Revision | Used for |
| --- | --- | --- |
| domainclash-progress | ef29f0ef4bf01fe92b8283c1da5fdf7e0207f8c9 | Base UI, assets, combat, trainer, six existing signs |
| main | 99ef1e86448ecff40eb6674f6af864ecae015954 | Built-in domain recognizers and geometry in src/integration/mainSigns |
| DomainClash-Kevin | b8fec0d20388b8af6ad3b2e26555e93a2c187232 | Regular-sign geometry, private rooms, WebSocket transport, WebRTC and JPEG fallback |

No recorded gesture dataset exists in these revisions. The user chose built-in signs. Browser-local recordings remain supported and override only the corresponding built-in sign. Gesture instructions describe built-ins; a personal recording may use a different pose.

## Gesture precedence

- Progress's Punch, Cleave, Piercing Blood, Demon Dogs, Nue and Mahoraga are unchanged.
- Main supplies Unlimited Void, Malevolent Shrine and Chimera Shadow Garden. Its Authentic Mutual Love and Ryu diamond signs provide labeled shortcuts for Copy and Way Too Sweet; the diamond is also reused for Uzumaki.
- Kevin supplies Red and Blue, with Black Flash's fist reused for Straight Hands, Red's circle for Curse Swallow, and Purple's horns for Cursed Tools.
- Granite Blast's index, Rika's spread palm and Supernova's paired index signs are additional shortcuts using Kevin's geometry. These moves do not have matching recordings in the source revisions.
- Because built-in fist shapes overlap, Auto preserves Punch. Select Blue or Straight Hands in **Gesture focus** to use those fists, or record distinct personal signs. Gesture focus can also help overlapping two-hand signs. Main's domain geometry is retained, not replaced with guessed recordings.
- Hollow Purple retains progress's button activation after two Red uses, two Blue uses and full meter.

## Play

Choose **Multiplayer**, create a private match and share the code. The other player joins with the code. Each player browses the center roster and confirms their fighter; both confirmations start a three-second countdown. P1 stays left and P2 right on both screens. The center shows health, meter and the local player's move controls. Fighter switching is locked during the round. A completed round returns both connected players to selection after five seconds. **Play with bot** leaves the room for solo play.

The server validates turn ownership, selected kit, meter, cooldowns and a shared one-second attack interval. Round numbers reject old inputs after a rematch. Idle/disconnected players time out; an abandoned match cannot continue accepting attacks. A match has a ten-minute time limit. Rooms and camera frames are transient, not persisted. Deployment/restart may end active rooms.

Camera access can be granted before joining or retried during battle. Webcam video uses direct WebRTC when possible (up to 24 FPS), adapting resolution and bitrate to connection and encoder conditions. Restrictive networks use authenticated WebSocket JPEG previews at up to 12 FPS, with HTTP previews as a last resort. The relay permits one unacknowledged frame per receiver and the decoder keeps only the newest pending frame, preventing a stale-frame backlog. No microphone audio is captured. Landmark recognition runs locally in a background worker, with a compatibility fallback. Video is shared only inside the private room; relay frames are not saved. Internet latency and restrictive networks can still reduce smoothness.

All 21 combat actions have distinct colored canvas effects and synthesized sound signatures. Effects originate at the tracked palm position, including on the opponent's screen, and a new move replaces the previous animation. Accepted server casts trigger multiplayer effects; rejected or stale casts do not. The top-bar Sound button saves the mute preference. Reduced-motion settings shorten and simplify effects.

## Local development

Use Node 22.12+ (tested with Node 24).

```sh
npm ci
npm run build
npm start
```

Open http://localhost:3001. For hot reload, run the backend with `PORT=3006` and `npm run dev` in a second terminal (Vite port 5176). In PowerShell use `$env:PORT='3006'; npm run server`.

```sh
npm test
npm run build
npm run dev:cloudflare
```

## Public hosting

Live integration: https://domainclash-integration.domainclash.workers.dev

GitHub Pages serves static sites and cannot run this private-room/WebSocket backend by itself. The integrated app is configured for the existing Cloudflare account as the separate Worker **domainclash-integration**, using Worker assets and a SQLite-class Durable Object compatible with the free plan. It does not overwrite the older `domainclash` deployment.

```sh
npx wrangler login
npm run deploy
```

No paid services or upgrades are required by this configuration. Free quotas are shared with other apps on the account; this is not a promise of unlimited traffic or guaranteed uptime. Relayed video consumes more server resources than direct WebRTC. At the free-plan limit, service can be unavailable until the quota resets. See [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

## Validation

61 automated tests cover the original 49 combat cases plus gesture precedence, saved-sign fallback, human turn ownership, server cooldowns, round isolation, knockout/rematch, disconnect settlement, HTTP authentication, live WebSocket state, video relay isolation/backpressure and effect coverage/anchors. Production TypeScript/Vite and Wrangler bundle builds are checked. Browser checks cover room creation/joining, both confirmations, camera exchange, P1/P2 layout, locked fight controls, background tracking and effect previews.

The deployed endpoint also passed `node scripts/smoke-multiplayer.mjs https://domainclash-integration.domainclash.workers.dev`. This creates two temporary players, verifies HTTP/WebSocket behavior and bidirectional attacks, then leaves their room.

Real-world recognition accuracy still depends on lighting, occlusion and camera position; no complete physical-hand test dataset was available. Two test clients on one computer share its camera/GPU, so that setup does not establish two-computer frame rate or internet latency.
