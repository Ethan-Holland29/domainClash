# Private multiplayer

## Run one shared server

Requires Node 24 or newer. In the project folder:

```powershell
npm ci
npm run build
npm start
```

Open `http://localhost:3001`. The server serves both the built game and its private-match API. Player 1 selects **Private match** on the launch guide (or **Multiplayer** in the toolbar), creates a room and gives its ten-character code to Player 2. Player 2 opens the **same server URL**, selects Multiplayer and joins with that code. Both press **Ready to fight**. Creating or joining requests camera access automatically. The toolbar and room menu can also enable/retry it. Both players see themselves on the left and the opponent on the right. Hand recognition runs locally; compressed camera frames are relayed through the authenticated room API.

The code locates a room on this server; it is not an Internet address. Running two separate servers creates two separate room lists.

## Different networks / online deployment

Deploy this repository as **one Node web service**. `render.yaml` is a Render blueprint, and `Dockerfile` supports a container host. Build: `npm ci && npm run build`. Start: `npm start`. Health: `/health`. The service respects `PORT` and binds `0.0.0.0`. Use the host's HTTPS URL on both computers: HTTPS is required for remote webcam access.

[Render's Node deployment guide](https://render.com/docs/deploy-node-express-app), [web service configuration](https://render.com/docs/web-services), and [Docker deployment](https://render.com/docs/docker) describe provider setup. Choose a plan in your own hosting account; no hosting purchase or deployment was made by this update. A service that sleeps when idle may delay the first connection. Use exactly one running instance: rooms are currently held in process memory, so restarts end matches and multiple replicas do not share rooms. Do not deploy this as a static-only site.

A same-origin deployment needs no environment variables beyond the provider's PORT. If intentionally proxying from a separate frontend, configure `ALLOWED_ORIGINS` as a comma-separated list of exact trusted frontend origins. Do not use wildcard origins.

## Same-Wi-Fi development with cameras

One computer runs `npm run server` on port 3001. Each computer runs a local Vite frontend, proxying to that shared computer. On the other computer, in PowerShell:

```powershell
$env:MATCH_SERVER_URL = 'http://HOST-LAN-IP:3001'
npm run dev
```

Replace HOST-LAN-IP with the server computer's actual LAN address. Open the printed **localhost** Vite URL on each computer. This keeps camera access on a secure localhost context while forwarding match messages to the shared server. The host's firewall must permit the chosen server port on the private network; this update does not alter firewall settings. Direct `http://HOST-LAN-IP:3001` supports pointer play, but browsers generally restrict cameras on plain HTTP remote origins. Prefer HTTPS hosting for normal play.

## Fight rules

- 100 HP, 100 cursed energy, 12 energy regenerated per second. Three-minute round; highest remaining HP wins, ties draw.
- Every regular attack shares a **1,000ms server-enforced recovery**, including switches to a different move. Regular attacks resolve after a 180ms telegraph. Effects finish within 500ms and each new regular cast clears the previous cast.
- Cleave: 8 damage / 8 energy; Piercing Blood: 10 / 12; Blue: 7 / 10; Red: 12 / 18; Purple: 18 / 35; Black Flash: 14 / 24. These are game balance values, not canonical numbers. Heavy moves consume energy faster than it regenerates.
- **Guard** (Space/button): costs 10 energy, protects for 450ms, recovers for 1.8s. Regular hits deal 45% damage rounded upward while guarded. Domain sure-hits bypass guard.
- Domains cost 35 / 45 / 55 / 65 energy for refinement tiers 0 / 1 / 2 / 3, open over 2.4 seconds, then last their existing 7–9 seconds and deal 3 damage per second. Their existing 13–15-second cooldown begins at activation and now locks **all domain choices** for that player so changing domain names cannot bypass recovery. Regular attacks are locked during your own domain opening.
- Higher refinement overrides the opposing lower-tier domain. Lower-tier attempts are rejected without spending energy. An equal-tier response within **1,000ms inclusive**, measured at server receipt, creates a Domain Clash. Both domains remain visible; their sure-hit damage cancels during overlap. Equal-tier responses outside that window are rejected. When one expires, the survivor's sure-hits resume.
- Domain tiers are a documented adaptation, not a claim that canon supplies a total ranking. See [BATTLE_RESEARCH.md](BATTLE_RESEARCH.md).
- “Domain Clash!” uses a low-pitched browser speech-synthesis announcer plus a synthesized cue and visible banner. Voice availability/timbre depends on the browser/OS; the visual banner always works. Sound-off cancels speech.
- Opponent techniques are shown coming from the opposite edge; each player's own attacks originate at their tracked hand. This is a technique duel with timed guard, not positional hit-box combat or a shared webcam stream.

## Reliability boundaries

The server owns health, energy, timers, phase, damage and domain arbitration. Clients submit only actions; client-supplied damage/timestamps/health are ignored. Duplicate/fast casts cannot bypass recovery. Simultaneous lethal pending hits can draw. Match completion freezes damage; leaving or missing heartbeats for 15 seconds forfeits. Both players must explicitly ready before the shared countdown. Online matches do not pause when a tab is hidden; use a foreground tab to avoid browser timer throttling.

Rooms have exactly two seats, unguessable session tokens, random 40-bit codes, request limits, bounded JSON bodies, bounded event history, origin checks and expiration. Room codes should be shared privately. They are bearer invitations, not user accounts. Lost/expired sessions require a new room. State is polled every 150ms; high latency can affect whether a response reaches the one-second clash window. No guarantee of zero bugs or Internet-wide production scaling is made.

Run `npm test` and `npm run build`. Tests cover room isolation, authentication, full rooms, countdowns, cooldown switches, energy limits, guard, clashes at boundaries, overrides, late inputs, disconnects, simultaneous KOs and match timeouts. Browser smoke testing used two independent clients on the same local server; two physical computers across the Internet have not yet been tested.


## Low-latency video and inputs

Both players see themselves on the left and the opponent on the right. Direct WebRTC video targets 24 FPS with a 900 kbps bitrate cap and up to 640-pixel send width. Cloudflare's public STUN service is used for connection discovery. No microphone is requested. The existing authenticated JPEG preview (up to 8 FPS) remains a fallback if NAT/firewalls block direct connectivity. The status below the game distinguishes **Direct live video** from **Preview fallback**. No TURN service is configured, so direct video cannot be guaranteed on every network. A managed TURN service is a future hosting choice; none has been purchased or activated.

An authenticated WebSocket pushes match state every 50 ms and carries player actions without HTTP polling. HTTP polling remains a reconnect fallback. Server-side health, energy, domain priority and cooldown validation remain authoritative. Local regular-attack visuals and sound can start immediately after a valid local input; matching confirmations do not replay the effect. Rejected predictions never apply damage. Domains remain server-confirmed.

Hand inference runs in a classic background worker using the bundled official MediaPipe runtime. Only one inference is in flight; frames are downscaled and older camera frames are skipped instead of queued. A bounded-rate main-thread compatibility path remains for browsers without worker/OffscreenCanvas support. Camera capture targets 960x540 at 24 FPS. No hand landmarks are sent to the opponent.

Camera video in direct mode goes between participants; signaling passes only to the opponent in the authenticated room. In preview fallback, the server retains just the latest bounded JPEG per player in memory and clears stale frames after two seconds and at room end. No recording is implemented. Stop camera stops its stream; leaving/finishing tears down direct video and fallback transport.

Camera permission and tracking have separate messages. Tracking failures keep a working camera visible and offer **Retry hand tracking**. Permission/device errors explain how to retry. Model and runtime files are bundled at `/tracking/`.

## Connection checks

Open `/connection-check.html` (linked in the multiplayer menu) for a synthetic two-session test. It uses animated images instead of a webcam, shows both decoded video-frame counters, tests the actual direct-camera/client classes and reports background-tracker results. This tests the current browser and server route, not the connection between two separate households. Press Stop or close it afterwards.

49 automated tests cover prior combat rules, room/video isolation, pending-camera cancellation, WebSocket authentication and event delivery, rejection of attack spam and local-effect reconciliation. Browser checks use synthetic media, not physical hand accuracy.

Technical references: [WebRTC signaling](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling), [MediaPipe synchronous inference and workers](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [Cloudflare STUN/TURN](https://developers.cloudflare.com/realtime/turn/).
