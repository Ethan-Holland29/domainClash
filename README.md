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

The nine-character selection screen retains the updated archive's portraits, titles, passives, font, backgrounds, and layout. Combat retains its camera area, player cards, health and domain meters, move buttons, passive notices, battle log, and technique banners. Solo and online now share one Pokémon-style turn-based engine (`shared/battle.mjs`): both fighters choose a move, priority and Speed decide who goes first, and the battle text plays line by line. Everyone has the same health, cursed energy and stats; only domain users and Megumi's Mahoraga get a built-in edge. Kits, lore notes and the balance results are in [docs/battle-system.md](docs/battle-system.md).

**Gesture settings** has one training screen: **Record**. Online and camera controls are small additions to that layout.

## Hand recognition

`src/signs/handTracking` contains main's recognition engine. The progress adapter uses main's exact existing sign definitions, confidence filtering, aspect-correct geometry, score thresholds, ambiguity checks, smoothing, movement checks, and hold/release timing. World landmarks and handedness confidence are retained. One held sign casts once and must be released before repeating; a stalled camera cannot complete a hold.

Some moves in main already required training: Blue, Red, Divine Dogs, and Nue have no built-in recordings. Added progress techniques require their own recordings. Built-in signs stay available when other moves are trained. New techniques retain their own identities instead of being mapped to unrelated signs.

1. Enable the camera, then open **Gesture settings → Record**.
2. Choose the ability, hold its posture, and press **Record posture (R)**.
3. Every new tracked hand frame is saved once (empty frames and repeated frames are skipped). The live count marks the ability **Trusted at 300** instances; recording continues until you press **Stop recording (R)**. At least 20 are needed before a taught move works.
4. Return to combat.
5. **Export Dataset** saves every recording in the original DomainClash dataset format; **Import Dataset** validates a file and **merges** compatible samples (existing recordings are never deleted or replaced; already-saved samples are skipped; invalid samples are listed, not imported). Older combined-build pose backups (`domainclash-signs.json`) are merged too.

Existing progress-format backups remain supported (import them from Record). Main-format recordings already stored by the previous merged build on the same browser origin are restored automatically. Training samples are hand landmark numbers, not video. The MediaPipe model and runtime are bundled under `public/tracking`.

## Online 1v1

Both players open the **same server address** and press **Multiplayer** on the opening screen. One creates a private match and shares its 10-character code; the other joins. The room has a centered 3 × 3 roster, P1's preview on the left, and P2's on the right. Each browser controls only its own pick. Both press **Confirm fighter · Play with both** to lock their choices and enter the fight together.

The fight keeps P1's camera on the left and P2's on the right, with fighter stats, move buttons and hand-sign instructions in the middle. Each player sees their own tracking statistics and their opponent's reported hand count and FPS. Character switching is disabled during a match.

The server sends one authoritative result: the winner sees a personalized **VICTORY** banner while the loser sees **DEFEAT**. Draws show **DRAW**. After seven seconds, both return to the same private room's character menu with a fresh battle and unlocked picks. Both must confirm again for a rematch.

- Online uses the same turn-based battle and kits as solo. Trained signs (the same recordings as solo), move buttons, or number keys lock in your move; **Space** is Guard.
- A turn resolves once both players have chosen. You see that your opponent has chosen, never what. After the previous turn's text, a player has 30 seconds to choose before a move is picked for them.
- The server runs the battle engine and decides every result and disconnect forfeit.
- Enabling the camera in a room shares an opponent preview. No microphone or video recording is used. Stop camera ends the preview.

`npm start` listens on port 3001 on all interfaces by default. Set `HOST=127.0.0.1` for local-only use. Internet play requires a Node host behind HTTPS; remote webcam access also needs HTTPS (localhost works). A Dockerfile is included. Rooms are held in memory, so use one server instance; restarting clears rooms.

## Public hosting

`render.yaml` configures a **Free** Node web service pinned to **domainclash-3combined**. Import this repository as a Render Blueprint and review the Free plan before deploying. No paid database, disk, or autoscaling is configured. The free service sleeps after inactivity and may take about a minute to wake; restarts clear rooms. See [Render's free-service limits](https://render.com/docs/free). A signed-in hosting account is required for permanent deployment.

A temporary Cloudflare Quick Tunnel can share the local server over HTTPS without an account or billing. Run `cloudflared tunnel --url http://127.0.0.1:3001` while the game server is running and share the printed URL. It stops when the computer or tunnel stops and is not permanent hosting. See [Cloudflare's Quick Tunnel documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/). For public tunnels, set `TRUST_LOCAL_CLOUDFLARE=1` on the loopback-bound server to apply anonymous room-creation limits per visitor.

CloudFront can front an existing server, but cannot itself execute this Node multiplayer server. No AWS resources or billable services have been provisioned.

## Verification and source layout

`npm test` runs 106 checks covering main recognition, coordinate adapters, learned-pose compatibility, release/stall behavior, fixed picks, server-enforced character locking, synchronized results and rematches, camera lifecycle, the turn-based battle engine and its balance simulation, solo battle playback, turn-based online matches, room isolation, and HTTP/WebSocket matches. `node scripts/balance.mjs` prints the full AI-vs-AI win-rate table. `npm run build` typechecks and creates `dist`.

- `shared/battle.mjs`: the turn-based battle engine shared by solo (browser) and online (server).
- `src/progress`: updated archive's active screens, solo battle and online screens, and integration adapters.
- `src/signs`: main's gesture engine and dataset support.
- `src/multiplayer`, `server`: Kevin's room protocol and camera transport.
- `server/roster.json`, `server/rules.json`: the earlier real-time kits, still used by the legacy sign catalog in `src/combat` (online kits now come from `shared/battle.mjs`).
- `public/art`, `public/fonts`, `public/tracking`: supplied artwork, font, and local tracking assets.

Browser checks cover both selection layouts, fixed picks, solo opponent selection, and a two-tab match through simultaneous victory/defeat and automatic rematch selection. Real webcam accuracy with different hands, lighting, and internet camera transport still needs hands-on testing. Camera inference and real internet latency depend on each player's device and connection.

Included art and font come from the supplied archives. This is an unofficial Jujutsu Kaisen fan project. Original ZIPs remain untouched. Workspace backups and extracted sources are in `.merge-backup` and `.merge-sources`, excluded from Git and the deliverable ZIP.

## Technique imagery

Technique effects can use supplied images instead of the code-drawn effects: see [docs/technique-art-sources.md](docs/technique-art-sources.md) for the source list, the abilities still missing imagery, and how to add images you own or have permission to use. Only user-supplied art is bundled; nothing is downloaded or generated.
