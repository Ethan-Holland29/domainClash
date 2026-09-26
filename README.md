# DomainClash — updated progress edition

The default website now uses the screens, styling, artwork, character selection, and full solo combat rules from **domainClash-domainclash-progress (2).zip**. Main's hand recognizer powers combat and sign testing. Kevin's existing online room system remains available through **Online 1v1**.

## Run

Install Node.js 22.12 or newer (tested with Node 24), then:

```sh
npm install
npm run build
npm start
```

Open **http://localhost:3001**. Pick P1 on the left and the solo opponent on the right; the character preview is in the middle. Click a portrait to fix the pick, then confirm each fighter and choose **Play solo**. Hovering no longer replaces a clicked pick. Technique buttons work without a camera. Press **Enable camera** for hand signs.

For development, run `npm run server` and `npm run dev` in separate terminals. Vite forwards multiplayer requests to port 3001. The Node server serves the built game and online API together; a static-only host cannot provide online matches.

## Updated screens and combat

The nine-character selection screen retains the updated archive's portraits, titles, passives, font, backgrounds, and layout. Combat retains its camera area, player cards, health and domain meters, move buttons, passive notices, battle log, and technique banners. Solo uses the archive's full fighter rules, including cooldowns, summons, passives, and unlockable techniques such as Hollow Purple.

Gesture settings retain **Test signs**, **Diagnose**, **Record**, and **Manual**. Online and camera controls are small additions to that layout. Character picks play a rising chime; other buttons play a short tap. Sounds start only after user interaction and also cover controls added during online matches.

## Hand recognition

`src/signs/handTracking` contains main's recognition engine. The progress adapter uses main's exact existing sign definitions, confidence filtering, aspect-correct geometry, score thresholds, ambiguity checks, smoothing, movement checks, and hold/release timing. World landmarks and handedness confidence are retained. One held sign casts once and must be released before repeating; a stalled camera cannot complete a hold.

The tracker and bundled WASM runtime are pinned to **MediaPipe 1.0.1**, matching main's lockfile. Camera capture requests main's **1280 × 720** resolution without an artificial frame-rate cap. Recognition evaluates each move once per frame. New recordings retain full image/world landmarks, actual aspect ratio, handedness, and timestamps; each capture collects main's 100 samples rather than reconstructing simplified poses.

Some moves in main already required training: Blue, Red, Divine Dogs, and Nue have no built-in recordings. Added progress techniques require their own recordings. Built-in signs stay available when other moves are trained. New techniques retain their own identities instead of being mapped to unrelated signs.

1. Enable the camera, then open **Gesture settings → Record**.
2. Choose a move marked **record first** and record a distinct, steady pose.
3. Save the example. At least 20 samples are required. Add variations if needed.
4. Use **Test signs** or **Diagnose**, then return to combat.
5. Export a backup to preserve your recordings outside browser storage.

Existing progress-format backups remain supported. **Import backup** also accepts main's exported gesture dataset, including NONE counterexamples. Recordings from a different browser or website address must be exported there and imported here; they are not included in the main ZIP. Full recordings take precedence over simplified legacy examples for the same sign, while the legacy backup remains stored. Main-format recordings already stored by the previous merged build on the same browser origin are restored automatically. Training samples are hand landmark numbers, not video. The MediaPipe model and runtime are bundled under `public/tracking`.

## Online 1v1

Both players open the **same server address** and press **Multiplayer** on the opening screen. One creates a private match and shares its 10-character code; the other joins. The room has a centered 3 × 3 roster, P1's preview on the left, and P2's on the right. Each browser controls only its own pick. Both press **Confirm fighter · Play with both** to lock their choices and enter the fight together.

The fight keeps P1's camera on the left and P2's on the right, with fighter stats, move buttons and hand-sign instructions in the middle. Each player sees their own tracking statistics and their opponent's reported hand count and FPS. Character switching is disabled during a match.

The server sends one authoritative result: the winner sees a personalized **VICTORY** banner while the loser sees **DEFEAT**. Draws show **DRAW**. After seven seconds, both return to the same private room's character menu with fresh health and unlocked picks. Both must confirm again for a rematch.

- Keys **1–3**, move buttons, or trained signs attack. **Space** or **Guard** blocks briefly.
- Online retains Kevin's real-time three-move kits and balance: 100 HP, regenerating cursed energy, recovery times, refinement-based domain clashes, and three-minute rounds.
- Solo uses the updated progress turn-based rules. Its larger kits and passives do not change the existing online protocol.
- The server decides damage, cooldowns, results, and disconnect forfeits.
- Enabling the camera in a room shares an opponent preview. No microphone or video recording is used. Stop camera ends the preview.

`npm start` listens on port 3001 on all interfaces by default. Set `HOST=127.0.0.1` for local-only use. Internet play requires a Node host behind HTTPS; remote webcam access also needs HTTPS (localhost works). A Dockerfile is included. Rooms are held in memory, so use one server instance; restarting clears rooms.

## Public hosting

`render.yaml` configures a **Free** Node web service pinned to **domainclash-3combined**. Import this repository as a Render Blueprint and review the Free plan before deploying. No paid database, disk, or autoscaling is configured. The free service sleeps after inactivity and may take about a minute to wake; restarts clear rooms. See [Render's free-service limits](https://render.com/docs/free). A signed-in hosting account is required for permanent deployment.

A temporary Cloudflare Quick Tunnel can share the local server over HTTPS without an account or billing. Run `cloudflared tunnel --url http://127.0.0.1:3001` while the game server is running and share the printed URL. It stops when the computer or tunnel stops and is not permanent hosting. See [Cloudflare's Quick Tunnel documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/). For public tunnels, set `TRUST_LOCAL_CLOUDFLARE=1` on the loopback-bound server to apply anonymous room-creation limits per visitor.

CloudFront can front an existing server, but cannot itself execute this Node multiplayer server. No AWS resources or billable services have been provisioned.

## Verification and source layout

`npm test` runs 125 checks covering main recognition, coordinate adapters, learned-pose compatibility, release/stall behavior, fixed picks, server-enforced character locking, synchronized results and rematches, camera lifecycle, updated progress combat rules, room isolation, and HTTP/WebSocket matches. `npm run build` typechecks and creates `dist`.

- `src/progress`: updated archive's active screens, combat rules, and integration adapters.
- `src/signs`: main's gesture engine and dataset support.
- `src/multiplayer`, `server`: Kevin's room protocol and camera transport.
- `server/roster.json`, `server/rules.json`: online kits and balance.
- `public/art`, `public/fonts`, `public/tracking`: supplied artwork, font, and local tracking assets.

Browser checks cover both selection layouts, fixed picks, solo opponent selection, and a two-tab match through simultaneous victory/defeat and automatic rematch selection. Real webcam accuracy with different hands, lighting, and internet camera transport still needs hands-on testing. Camera inference and real internet latency depend on each player's device and connection.

Included art and font come from the supplied archives. This is an unofficial Jujutsu Kaisen fan project. Original ZIPs remain untouched. Workspace backups and extracted sources are in `.merge-backup` and `.merge-sources`, excluded from Git and the deliverable ZIP.
