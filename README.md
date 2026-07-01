# StrangerChat

A modern, anonymous **stranger video / audio / text chat** platform — a production-oriented Omegle-style app. Random 1:1 matching over WebRTC, a Redis-backed matchmaking engine, JWT auth (email + OTP + Google + guest), and Razorpay + UPI premium subscriptions, all wired together as a Docker-deployable monorepo.

> **Honest scope.** This is a real, runnable foundation with the hard subsystems implemented properly — the matching engine, WebRTC perfect-negotiation signalling, auth with refresh-token rotation, payments with verified webhooks, and the security middleware. Surfaces that are inherently large or need third‑party models (the full admin UI, NSFW/VPN/bot ML) ship as **working hook‑points with safe no‑op defaults** so you can drop in a provider without rearchitecting. See [What's implemented vs. what to extend](#whats-implemented-vs-what-to-extend).

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Quick start (Docker)](#quick-start-docker)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [The realtime contract](#the-realtime-contract)
- [Payments](#payments)
- [Free vs. Premium](#free-vs-premium)
- [Security](#security)
- [What's implemented vs. what to extend](#whats-implemented-vs-what-to-extend)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

**Realtime chat**
- Anonymous video, audio, and text modes
- Random 1:1 matching with **Skip / Next**
- Typing indicator, live online counter, connection timer
- Mute mic, toggle camera, switch camera, fullscreen
- Live network-quality indicator (sampled from `getStats()`)
- Partner country flag, gender, age, verified/premium badges
- Automatic ICE restart and reconnection on network drops

**Matching filters** (country, gender, age range, language, interest, relationship status, verified-only, premium-only, new-users, distance)
- **Free:** unlimited *random* chat, plus **3 minutes/day** of filtered matching
- **Premium:** unlimited filtering + priority placement in the queue

**Accounts**
- Email + password, email **OTP** code, **Google** sign-in, and one-tap **anonymous guest**
- JWT **access tokens** (short-lived, in memory) + **refresh-token rotation** with reuse detection (httpOnly cookie)

**Premium / payments**
- Plans: **Monthly ₹69**, **6 Months ₹299**, **Yearly ₹699**
- **Razorpay** checkout (cards/UPI/netbanking) with **server-side signature verification** → instant activation
- Dynamic **UPI QR** generation for direct‑UPI flows
- Idempotent, HMAC-verified Razorpay **webhook**

**Safety & anti-abuse**
- Report & block, automatic ban escalation on repeat reports
- Redis-backed IP/route rate limiting
- Profanity filter + pluggable moderation hooks (text/image/NSFW)
- Helmet, CORS, input validation (zod), SQL-injection-safe (Prisma)

**SEO & PWA**
- Per-route metadata, OpenGraph + Twitter cards, JSON-LD `WebApplication`
- Dynamic `robots.txt`, `sitemap.xml`, and web app `manifest`

---

## Architecture

```
                         ┌──────────────────────────────┐
        Browser  ───────▶│            Nginx             │  (single public origin :80)
   (Next.js client)      │  /  /api  /socket.io  /_next │
                         └───────┬───────────────┬──────┘
                                 │               │
                      HTTP/WS    │               │   HTTP / WS
                                 ▼               ▼
                       ┌──────────────┐   ┌──────────────┐
                       │   Frontend   │   │   Backend    │
                       │  Next.js 14  │   │ Express +    │
                       │  standalone  │   │ Socket.io    │
                       └──────────────┘   └───┬─────┬────┘
                                              │     │
                                  ┌───────────┘     └──────────┐
                                  ▼                            ▼
                          ┌──────────────┐            ┌──────────────┐
                          │  PostgreSQL  │            │    Redis     │
                          │   (Prisma)   │            │ queue/locks/ │
                          │              │            │ presence/RL  │
                          └──────────────┘            └──────────────┘

   WebRTC media is peer-to-peer. coTURN (STUN/TURN) provides relay
   for peers behind symmetric NAT. Only signalling crosses the backend.
```

- **Matching engine** — a singleton over a Redis **sorted set** (premium users get a score boost for priority), guarded by a short-lived **distributed lock** so two workers never pair the same socket. Compatibility is mutual (both peers' filters must agree) with optional Haversine distance gating.
- **WebRTC** — the backend is a dumb relay: it forwards `signal` payloads to the other peer in the room. All glare handling lives client-side in the **perfect-negotiation** hook; the lexicographically smaller userId is the *polite* peer.
- **Auth** — access tokens are kept **in memory** (not localStorage) to shrink XSS blast radius; the long-lived refresh token is an **httpOnly cookie**, rotated on every use with family-wide revocation on reuse detection.

**Stack:** Next.js 14 · React 18 · TypeScript · TailwindCSS · Framer Motion · React Query · Socket.io · WebRTC · Node · Express · Prisma · PostgreSQL · Redis · Razorpay · Docker · Nginx · coTURN · GitHub Actions.

---

## Project structure

```
strangerchat/
├── backend/                     # Node + Express + Socket.io API
│   ├── prisma/
│   │   ├── schema.prisma         # full data model (users, subs, payments, reports…)
│   │   └── seed.ts               # seeds plans, countries, interests, admin user
│   ├── src/
│   │   ├── config/               # env (zod-validated), prisma, redis clients
│   │   ├── utils/                # jwt, password (bcrypt), otp, mailer, profanity, moderation, logger
│   │   ├── middleware/           # auth, error handling, rate limiting, validation
│   │   ├── matching/             # Redis matchmaking engine + types
│   │   ├── socket/               # Socket.io handlers, ICE config, server wiring
│   │   ├── modules/              # auth, payments, users, admin route handlers
│   │   ├── app.ts                # express app (webhook mounted raw BEFORE json)
│   │   └── server.ts             # http + socket bootstrap, graceful shutdown
│   ├── Dockerfile
│   └── .env.example
├── frontend/                    # Next.js 14 app-router client
│   ├── public/                   # favicon, icons, OG image, manifest assets
│   └── src/
│       ├── app/
│       │   ├── page.tsx          # landing
│       │   ├── chat/             # the core chat experience (orchestrates everything)
│       │   ├── premium/          # plans + Razorpay/UPI checkout
│       │   ├── login/            # email / OTP / Google / guest
│       │   ├── payment/          # success + failed result pages
│       │   ├── robots.ts · sitemap.ts · manifest.ts
│       │   ├── layout.tsx · providers.tsx · globals.css
│       ├── components/           # VideoStage, ControlBar, ChatPanel, FilterBar, modals, …
│       ├── hooks/                # useWebRTC, useMediaDevices, useSocket, useOnlineCount
│       └── lib/                  # api (axios + refresh), socket, shared types
│   ├── Dockerfile
│   └── .env.example
├── infra/
│   ├── nginx/nginx.conf          # reverse proxy (HTTP + WebSocket upgrade)
│   └── coturn/turnserver.conf    # TURN/STUN config
├── .github/workflows/ci.yml      # typecheck, lint, build, docker build
├── docker-compose.yml            # postgres + redis + coturn + backend + frontend + nginx
└── README.md
```

---

## Quick start (Docker)

**Prerequisites:** Docker + Docker Compose.

```bash
# 1) Backend secrets
cp backend/.env.example backend/.env
#    Fill in JWT secrets at minimum. Payments/Google are optional to boot.

# 2) (optional) root overrides for the web build — public origin, Razorpay key, Google client id
#    Defaults to http://localhost if unset.
#    export PUBLIC_ORIGIN=https://your-domain.com
#    export NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx
#    export NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com

# 3) Build & run the whole stack
docker compose up -d --build

# 4) Open the app
open http://localhost
```

On first boot the backend syncs the database schema automatically (`prisma db push` when no migration history is present — see [Database](#database)). To load the starter data (plans, countries, interests, admin):

```bash
docker compose exec backend npx prisma db seed
```

Default admin (change immediately): `admin@strangerchat.app` / `Admin@12345`.

> **TURN note.** coTURN runs with host networking and must advertise your server's real public IP. Set `external-ip` and a strong secret in `infra/coturn/turnserver.conf`, and point `TURN_URL/TURN_USERNAME/TURN_CREDENTIAL` in `backend/.env` at it. Without a reachable TURN server, peers behind symmetric NAT can't connect.

---

## Local development

Run Postgres + Redis however you like (Docker is easiest):

```bash
docker run -d --name sc-pg  -e POSTGRES_USER=strangerchat -e POSTGRES_PASSWORD=strangerchat -e POSTGRES_DB=strangerchat -p 5432:5432 postgres:16-alpine
docker run -d --name sc-rd  -p 6379:6379 redis:7-alpine
```

**Backend**

```bash
cd backend
cp .env.example .env            # set DATABASE_URL, REDIS_URL, JWT secrets
npm install
npx prisma db push              # sync schema to the dev DB
npm run seed                    # plans, countries, interests, admin
npm run dev                     # http://localhost:4000
```

**Frontend**

```bash
cd frontend
cp .env.example .env            # NEXT_PUBLIC_API_URL=http://localhost:4000, etc.
npm install
npm run dev                     # http://localhost:3000
```

The dev client talks directly to the API on `:4000`. In Docker, everything is same-origin behind Nginx.

### Database

The schema is the single source of truth in `backend/prisma/schema.prisma`.

- **Prototyping / first run:** `prisma db push` syncs the schema directly (no migration files). This is what the container does when no `prisma/migrations/` directory is committed.
- **Production change management (recommended):** generate real migrations and commit them:
  ```bash
  cd backend
  npx prisma migrate dev --name init      # creates prisma/migrations/*
  git add prisma/migrations
  ```
  Once migrations exist, the container automatically switches to `prisma migrate deploy`.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|:---:|---|
| `NODE_ENV` | | `development` / `production` |
| `PORT` | | API port (default `4000`) |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `CLIENT_URL` | ✅ | Public web origin (CORS + cookies) |
| `COOKIE_DOMAIN` | | Cookie domain for the refresh token |
| `JWT_ACCESS_SECRET` | ✅ | ≥16 chars |
| `JWT_REFRESH_SECRET` | ✅ | ≥16 chars |
| `ACCESS_TTL` | | Access token TTL (default `15m`) |
| `REFRESH_TTL_DAYS` | | Refresh token TTL in days (default `30`) |
| `GOOGLE_CLIENT_ID` | | Enables Google sign-in verification |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | | Enables Razorpay checkout + verification |
| `RAZORPAY_WEBHOOK_SECRET` | | Verifies incoming Razorpay webhooks |
| `UPI_ID` | | VPA for dynamic UPI QR (e.g. `name@bank`) |
| `UPI_NAME` | | Payee name shown in UPI apps |
| `STUN_URLS` | | Comma-separated STUN URLs |
| `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` | | TURN relay credentials |
| `FREE_FILTER_SECONDS` | | Daily free filtering allowance (default `180`) |
| `SMTP_*` / `MAIL_FROM` | | SMTP for OTP/email; logs to console if unset |

### Frontend (`frontend/.env` — build-time, `NEXT_PUBLIC_*`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base (e.g. `http://localhost:4000`, or your origin behind Nginx) |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.io origin |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for SEO |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Optional; otherwise fetched from `/api/payments/config` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Optional; enables the Google button |

---

## The realtime contract

Socket.io handshake auth: `auth.token` = the access JWT.

**Client → Server**

| Event | Payload | Notes |
|---|---|---|
| `queue:join` | `{ mode, filters?, lat?, lng? }` | Enters the matchmaking pool |
| `queue:leave` | — | Leaves the pool → `queue:left` |
| `signal` | `{ roomId, description? \| candidate? }` | Relayed verbatim to the partner |
| `peer:state` | `{ audio, video }` | Mic/cam state, relayed as-is |
| `chat:message` | `{ text }` | Server sanitizes, relays to partner only |
| `chat:typing` | `boolean` | Relayed to partner |
| `skip` | — | Ends the call → `skip:done` |
| `next` | — | Ends + re-queues with last params |
| `report` | `{ reason?, details? }` | → `report:received` |
| `block` | — | Blocks current partner → `block:done` |

**Server → Client**

| Event | Payload | Notes |
|---|---|---|
| `connected` | `{ userId, online }` | On socket connect |
| `presence:count` | `number` | Live online count (raw number) |
| `match:found` | `{ roomId, polite, mode, partner, iceServers }` | Pairing result |
| `queue:waiting` | — | Still searching |
| `premium:required` | `{ reason }` | Free filter quota exhausted; filters stripped |
| `partner:left` | — | Partner disconnected/skipped |
| `chat:message` | `{ text, ts }` | Incoming partner message |
| `chat:typing` | `boolean` | Partner typing state |
| `peer:state` | `{ audio, video }` | Partner mic/cam state |
| `skip:done` · `queue:left` · `report:received` · `block:done` | — | Acks |
| `banned` | — | Access suspended |
| `error:queue` | `{ error }` | Matchmaking error |

Because the backend only relays `signal`, the client includes its own `roomId` in every signal and owns all negotiation. The sender of a `chat:message` appends its own bubble locally (the server only forwards to the partner).

---

## Payments

Two paths are implemented:

1. **Razorpay (auto-verified, instant).** `POST /api/payments/order` creates an order; the client opens Razorpay Checkout; on success the client posts the `order_id / payment_id / signature` to `POST /api/payments/verify`, which **verifies the HMAC signature server-side** and activates the subscription immediately. A separate HMAC-verified, idempotent **webhook** (`/api/payments/webhook`, mounted with a raw body) is the source of truth for asynchronous status.
2. **Direct UPI QR.** `POST /api/payments/upi-qr` builds a `upi://pay?...` intent for the configured VPA and returns a QR data-URL. A static-VPA deep link has **no payment callback**, so it can't be programmatically auto-verified — confirmation comes via a PSP webhook or the admin `/upi/confirm` endpoint, while the client polls `/api/payments/:id/status`. For hands-off instant activation, prefer the Razorpay path (it also renders a UPI QR inside Checkout).

Configured UPI VPA: `jainilmaru10thb@oksbi` (override via `UPI_ID`).

---

## Free vs. Premium

| | Free | Premium |
|---|---|---|
| Random video/audio/text | ✅ Unlimited | ✅ Unlimited |
| Filtered matching | ⏱️ 3 min/day | ✅ Unlimited |
| Queue priority | Standard | **Boosted** |
| Ads | Shown* | Removed |

\* Ad slots are placeholders — wire your own ad provider.

The free daily filter allowance is enforced **server-side** (Redis, `FREE_FILTER_SECONDS`); the client mirrors a countdown and shows the upgrade modal when the server emits `premium:required`.

---

## Security

- **Tokens:** in-memory access token + httpOnly refresh cookie with rotation and reuse detection (family revocation).
- **Transport:** Helmet, strict CORS to `CLIENT_URL`, security headers at both Nginx and the app.
- **Input:** every payload validated with zod; Prisma parameterizes all queries (no raw SQL).
- **Abuse:** Redis-backed rate limiting per IP/route, report→ban escalation, profanity filter, moderation hook-points.
- **Payments:** Razorpay signature + webhook HMAC verified with timing-safe comparison; idempotent activation.
- **TURN:** coTURN configured to deny relaying to private/loopback ranges (SSRF/LAN protection).

> Always run behind HTTPS in production and set strong secrets. Rotate the seeded admin password before exposing the app.

---

## What's implemented vs. what to extend

**Fully implemented**
- Redis matchmaking engine (priority, locking, mutual compatibility, distance)
- WebRTC perfect-negotiation signalling, ICE restart, network-quality sampling
- Auth: email+password, OTP, Google verification, guest; refresh rotation + reuse detection
- Payments: Razorpay order/verify, UPI QR, verified idempotent webhook, subscription activation
- Security middleware, rate limiting, validation, report/block + ban escalation
- Full Prisma data model, seed data, SEO routes, PWA manifest
- Dockerized stack + Nginx + coTURN + CI

**Working hook-points (safe no-op defaults — bring your own provider)**
- **Moderation / NSFW** (`backend/src/utils/moderation.ts`): functions are called at the right places and currently pass-through. Plug in an image/text classifier (e.g. a vision model or a service like AWS Rekognition / Hive) here.
- **VPN / bot / spam scoring**: fields (`vpnFlagged`, `trustScore`) and check seams exist; integrate an IP-intelligence provider and your heuristics.
- **Admin panel**: backend admin routes (dashboard counts, ban, reports, settings) exist; the rich admin **UI** (revenue charts, live-user heatmaps, log viewer) is intentionally left as a separate build on top of those endpoints.
- **Email**: a console-logging mailer is the default; set `SMTP_*` to send real OTP/transactional mail.
- **Ads**: placeholder slots only.

These seams are deliberate: they're the parts that depend on paid third-party models or are large enough to be their own project, and they're isolated so you can implement them without touching the core.

---

## Roadmap

- Rich admin dashboard UI (revenue, retention, live heatmaps, moderation queue)
- Real NSFW/abuse detection integration + automated actions
- IP intelligence (VPN/proxy) and device fingerprinting for ban evasion
- Interest-weighted and language-aware match ranking
- Group rooms and friend re-connect
- E2E test suite (Playwright) + load testing for the matching engine
- Observability: structured logs, metrics, tracing, alerting

---

## License

Provided as a starting point for your own product. Review and harden before production use, and ensure your deployment complies with local laws on anonymous communication, age verification, and content moderation.
