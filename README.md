# PIXME (픽미)

> 오늘의 나를 픽셀로. — *Pixel your day.*

PIXME turns one photo of what you're actually wearing today into a pixel
character, publishes it as your "today", and lets you wander through everyone
else's day and react lightly.

It is **not** a dating app with pixel avatars, a photo filter, or an avatar
dress-up game. The product is **record + self-expression + discovery +
relationships**, in that order. The AI conversion is the entry point, not the
point.

---

## The daily loop

```
today's photo → pixel character → publish as today's PIXME
     → receive ♡  → browse other people's today
     → ♡ / 👋     → mutual 👋 becomes a connection → conversation
     → tomorrow, a new photo
```

Everything in this repo is built to make that loop work and keep working.

## Repository layout

```
apps/
  mobile/     Expo + React Native + TypeScript client
  server/     Spring Boot 3 (Java 21) API, WebSocket chat, AI orchestration
docs/
  PRODUCT.md        the product rules and why they are what they are
  ARCHITECTURE.md   how the two halves fit together
  API.md            the HTTP + WebSocket contract
  AI.md             character art direction and prompt strategy
  PRIVACY.md        what we store, for how long, and why
  RELEASE.md        App Store / Play submission checklist
```

## Running it

### Character reference

Before anything looks right, drop the official character image at
`apps/server/src/main/resources/pixme/master-character-v1.png`. It is sent to
the AI provider as the style reference on every generation, and the server
measures it at startup to fix the character geometry that every output is
conformed to. See that directory's README; the server runs without it but warns
loudly, and characters drift.

### Backend

```bash
cd apps/server
docker compose up -d postgres redis        # local dependencies
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

The `local` profile uses `pixme.ai.provider=stub`, which draws a real (if
crude) pixel character procedurally — the entire create flow works offline with
no AI provider key and no spend.

```bash
mvn test                                   # 72 tests; needs postgres + redis up
```

The integration tests run against Postgres on purpose: the schema expresses
product rules in Postgres features (a partial unique index for "one
representative PIXME per day", `DISTINCT ON` for the chat list). An in-memory
database would pass while skipping exactly the guarantees worth testing. Object
storage is faked in-process, so MinIO is optional.

Create the test database once:

```bash
docker exec -it <postgres-container> psql -U pixme -d postgres \
  -c "CREATE DATABASE pixme_test OWNER pixme;"
```

### Mobile

```bash
cd apps/mobile
cp .env.example .env                       # point PIXME_API_BASE_URL at your server
npm install
npm start
```

Apple sign-in and in-app purchases need a native build (`npm run ios`), not Expo
Go. Everything else — feed, square, create flow against the stub provider,
chat — runs in Expo Go.

```bash
npm run typecheck
```

## Configuration

Nothing secret lives in either source tree.

- The client reads only public values from `app.config.ts` → `extra`
  (API base URL, Kakao *REST* key, legal links). No AI, storage or billing
  credential ever ships in the bundle.
- The server reads everything from the environment; `application.yml` contains
  defaults and no credentials. See `docs/ARCHITECTURE.md` for the full list.

Prices are **not** in code. The store catalog (products, copy, ordering,
fallback prices) is a database table, and the app always prefers the platform
store's localised price.

## Operating levers

`GET /api/v1/system/config` is unauthenticated so the client can learn, before
sign-in, that the service is in maintenance or that its build is too old:

- `pixme.maintenance.active` — shows the maintenance screen
- `pixme.minimum-supported-version` — forces an update
- `features.*` — dark-launch switches

## Scope of this build

Shipped: the full daily loop, the square, hearts, waves, mutual connections,
text chat (WebSocket with a REST fallback), personal pixel history, the store
and PIXME+, reporting/blocking with automatic escalation, per-type push
settings, and account deletion with a two-phase purge.

Deliberately out of scope for v1, and why:

| Not built | Reason |
| --- | --- |
| Identity verification (PASS, phone, real name) | The safety model is reporting, blocking and content screening. Collecting identity would add friction and a large liability for little protection. |
| Photos / voice in chat | Re-introduces the risks that identity-free sign-up is designed to avoid. The conversation starter is already the character. |
| Boost, rewarded ads | Flags exist (`features.boost`, `features.rewardedAds`) and are off. Paid visibility needs to be designed so it cannot read as buying popularity. |
| Multi-node realtime fan-out | The socket is a latency optimisation over a REST source of truth; a user on another instance degrades to push + next fetch. Scaling out means adding Redis pub/sub behind `ChatSessionRegistry` and nothing else. |
