# Architecture

## Shape

```
┌──────────────────────────┐
│ Expo / React Native app  │
│  expo-router, Zustand,   │
│  TanStack Query          │
└────────┬─────────────────┘
         │ HTTPS  /api/v1            WSS  /ws/chat
         ▼                            ▼
┌──────────────────────────────────────────────┐
│ Spring Boot 3 (Java 21, virtual threads)     │
│  api · feed · square · pixel · connection    │
│  chat · store · safety · notification · ai   │
└──┬──────────┬──────────┬──────────┬──────────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
Postgres    Redis    S3 / R2    AI provider
(truth)  (limits)  (2 buckets)  (OpenAI / FLUX / stub)
```

The client never talks to an AI provider or to storage credentials. Image
uploads go device → pre-signed URL → private bucket; the API only ever handles
object *keys*.

## Mobile

```
app/                      expo-router file routes only — thin, no logic
src/
  theme/                  tokens → semantic themes → provider
  ui/                     the design system (Text, Button, PixelCharacter, …)
  api/                    typed wire contract + axios client + query keys
  features/<domain>/      hooks, stores and domain components
  lib/                    config, storage, analytics, haptics, image, push
  constants/              interests, moods, tags, and all user-facing copy
```

Decisions worth knowing:

- **Two-tier persistence.** Auth tokens live in Keychain/Keystore
  (`secureStorage`); everything else in AsyncStorage. Neither ever throws — a
  storage failure degrades the session, it doesn't crash the app.
- **One auth bridge.** `api/client.ts` holds no state; the auth store injects
  token getters at load. That keeps the HTTP layer importable from anywhere
  without a cycle, and puts the whole token lifecycle in one file.
- **Single-flight refresh.** A 401 triggers at most one refresh; concurrent
  requests await the same promise and then replay. Only idempotent verbs retry
  on transient failures.
- **One shared chat socket.** A module singleton, not per-screen state, so
  messages keep arriving (and driving the tab badge) while the user is in the
  feed or the square. It reconnects with jittered backoff and queues outbound
  frames while down.
- **Optimistic where it matters.** Hearts patch every cache that can show the
  post and roll back on failure; messages render immediately and reconcile on
  ACK. Both are safe because both server endpoints are idempotent.
- **Copy is centralised.** `constants/copy.ts` exists so the product's voice —
  never evaluative, never "pass" or "reject" — is reviewable in one place.
- **Prices are never hardcoded.** `useStoreCatalog` merges the server catalog
  with the platform store's localised prices; the server's KRW value is only a
  fallback for the moment before the store answers.

## Server

```
app/pixme/
  api/          controllers + DTOs + ResponseAssembler
  common/       errors, cursors, clock, rate limiter, text sanitizer
  security/     JWT, filter, security config
  auth/         Apple/Kakao verification, refresh-token rotation
  user/         accounts, profiles, interests, settings, stats
  pixel/        uploads, generation pipeline, posts, history
  reaction/     hearts
  connection/   waves and mutual connections
  chat/         conversations, messages, WebSocket
  feed/         ranking and per-viewer exposure
  square/       scenes, placement, curation
  store/        catalog, receipts, credits, entitlements
  safety/       blocks, reports, auto-escalation
  notification/ notification centre + push fan-out
  ai/           provider abstraction + prompt library
  storage/      object storage abstraction
  job/          scheduled maintenance, reminders, purge
```

### The generation pipeline

```
POST /pixels/uploads          → pre-signed PUT, upload row
   client PUTs the photo directly to the private bucket
POST /pixels/generate         → validate, charge, create row, publish event
   after commit → virtual thread:
        10% fetch original
        25% safety screen      → reject ⇒ refund
        45% analysis            → no person ⇒ refund
        70% render
        90% store character
       100% COMPLETED           → notify
GET  /pixels/generations/{id}  → client polls real progress
POST /pixels/{id}/publish      → becomes today's PIXME
```

Three things here were bugs before they were design:

1. **Dispatch happens after commit.** Submitting to the executor inside the
   transaction races the commit; the worker wins often enough that generations
   silently never run. `GenerationQueuedEvent` +
   `@TransactionalEventListener(AFTER_COMMIT)` fixes it, with
   `fallbackExecution = true` so a non-transactional caller still works.
2. **The pipeline is its own bean.** Each stage needs `REQUIRES_NEW` so progress
   commits independently and a late failure doesn't roll back earlier states.
   Spring's transaction advice is proxy-based, so those annotations are silently
   ignored when called on `this` — hence `GenerationPipeline` is separate from
   `GenerationService`.
3. **Progress is real.** The percentages above are written by the pipeline, so
   the client's three-stage loading copy tracks the actual position instead of
   a timer that can finish before the server does.

### The AI seam

```java
interface PixelImageProvider {
    String name();
    SafetyVerdict checkSafety(byte[] image, String mimeType);
    ImageAnalysis analyzeImage(byte[] image, String mimeType);
    GeneratedCharacter generateCharacter(GenerationRequest request);
    GeneratedCharacter generateVariant(GenerationRequest request);
}
```

Three implementations ship: `openai`, `flux`, `stub`. All are registered;
`pixme.ai.provider` picks one, so switching vendor — or A/B-ing two on the same
input — is configuration. Analysis is a separate step from rendering so that
"다시 만들어보기" reuses the outfit description instead of re-reading the photo,
and so prompt versions can be compared on stored analyses.

See `AI.md`.

### Pagination

Every list is keyset-paginated on `(timestamp, id)` with an opaque Base64
cursor. Offsets would shift every later page as new posts arrive, which the user
experiences as duplicate and skipped cards.

The feed pages the *candidate window* and ranks inside it; the cursor points at
the oldest candidate fetched, not the lowest-ranked card shown, so reordering
can't cause the next page to skip.

> Cursor predicates use an open upper bound (`Cursors.OPEN_TIMESTAMP`) rather
> than a `:param is null` branch. Postgres cannot infer the type of a bound
> null and rejects the statement outright — which would have broken the first
> page of every chat.

### Transactions and concurrency

| Risk | Mechanism |
| --- | --- |
| Two requests spend the last credit | `SELECT … FOR UPDATE` on `generation_credits` |
| Double heart | unique index + `ON CONFLICT DO NOTHING` |
| Two conversations for one pair | canonical ordering + unique index |
| Two representative posts in a day | partial unique index |
| Replayed store receipt | unique index on `(platform, transaction_id)` |
| Double credit refund | partial unique index on the ledger |
| Lost heart increments | atomic `UPDATE … SET x = x + 1` |
| Stolen refresh token | rotation + replay detection ⇒ revoke all sessions |

### Realtime

Plain JSON frames over `/ws/chat` (`SEND`, `READ`, `SUBSCRIBE`, `PING` up;
`MESSAGE`, `ACK`, `READ`, `CONVERSATION_UPDATED`, `ERROR`, `PONG` down). Not
STOMP: four frame types don't justify a broker protocol.

The token travels in the handshake query string because React Native's
`WebSocket` cannot set headers. It is a short-lived access token and the URL is
never logged.

REST remains the source of truth. Every socket operation has a REST equivalent,
so a socket that can't connect degrades to a working chat rather than a broken
one.

### Environment

| Variable | Purpose |
| --- | --- |
| `PIXME_DB_URL` / `_USER` / `_PASSWORD` | Postgres |
| `PIXME_REDIS_HOST` / `_PORT` / `_PASSWORD` | Redis |
| `PIXME_JWT_SECRET` | HS256 signing key, ≥32 bytes (startup fails otherwise) |
| `PIXME_APPLE_CLIENT_IDS` | Accepted `aud` values for Apple identity tokens |
| `PIXME_KAKAO_REST_API_KEY` / `_CLIENT_SECRET` | Kakao code exchange |
| `PIXME_STORAGE_*` | Bucket names, region, optional endpoint, keys |
| `PIXME_AI_PROVIDER` | `openai` · `flux` · `stub` |
| `PIXME_OPENAI_API_KEY` / `PIXME_FLUX_API_KEY` | Provider credentials |
| `PIXME_EXPO_ACCESS_TOKEN` | Push delivery |
| `PIXME_APPLE_*` / `PIXME_GOOGLE_SERVICE_ACCOUNT_JSON` | Receipt validation |
| `PIXME_MAINTENANCE` / `PIXME_MIN_APP_VERSION` | Operating levers |
| `PIXME_ORIGINAL_RETENTION` / `PIXME_DELETION_GRACE` | Retention policy |

### Scheduled work

| Job | Cadence | Why it's not optional |
| --- | --- | --- |
| Reap stuck generations | 60s | The refund promise across crashes and deploys |
| Reap abandoned uploads | hourly | Deletes photos for uploads never generated |
| Purge expired originals | daily 03:30 | This job *is* the retention policy |
| Prune exposures/placements | daily 04:00 | Keeps discovery bookkeeping bounded |
| Reconcile subscriptions | hourly | Stores notify unreliably; polling stops a lapsed sub granting forever |
| Delete expired refresh tokens | daily 04:45 | Hygiene |
| Daily reminder | 19:30 KST | The one proactive nudge |
| Account purge | daily 05:00 | Phase two of deletion |
