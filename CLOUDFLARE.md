# DomainClash public hosting

Public URL: https://domainclash.domainclash.workers.dev

The site and multiplayer backend run on Cloudflare, independently of the development computer. No GitHub repository, domain purchase, credit card, or paid upgrade is required for this deployment.

## Updating

Use Node 24 or newer. From this project folder:

```sh
npm ci
npx wrangler login
npm test
npm run deploy
```

Wrangler stores account authorization outside the project. Never commit credentials. Deploying replaces the live backend and may interrupt active matches; publish between play sessions.

## Testing

```sh
npm run build
npm run dev:cloudflare
```

In a second terminal:

```sh
node scripts/check-cloudflare.mjs
```

To verify the deployed backend:

```sh
node scripts/check-cloudflare.mjs https://domainclash.domainclash.workers.dev
```

Open `/connection-check.html` and click Run checks to test two synthetic camera streams, live connections, and the hand-tracking worker. This needs no webcam permission. It does not replace testing two different home networks with real hands.

## Architecture and free-tier limits

- Worker static assets serve the game and MediaPipe files. The Worker routes only `/api/*` and `/health` to backend code.
- One SQLite-capable Durable Object shares an authoritative arena across up to 64 rooms and 160 live sockets, keeping duration usage bounded. Room state is ephemeral; runtime resets or deployments may require creating a new room.
- Live sockets push state at 20 Hz; application heartbeats detect disconnected browsers and stop feeding slow connections. Health, damage, energy, domain rules and cooldowns use the same Match engine as the local Node server.
- WebRTC sends video directly between players. The authenticated, bounded JPEG fallback retains only each player's latest frame for up to two seconds, in memory. It is never recorded to storage. No microphone is requested.
- Cloudflare's free plans have daily quotas, including 100,000 Worker requests and Durable Object request/duration allowances. Reaching a free quota can interrupt service until reset. This is a stable, computer-independent URL, not an unlimited-traffic or guaranteed-uptime service.
- Normal WebSocket play minimizes HTTP requests. Polling and JPEG camera fallback consume the daily request allowance faster, particularly on networks that prevent direct WebRTC. No paid TURN relay is configured.
- No automatic paid upgrade is configured. Check Cloudflare's Workers dashboard for usage before sharing broadly.

Official references: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).
