# API

Base path `/api/v1`. JSON throughout. Bearer access token on everything except
the four public routes below.

## Conventions

**Errors** always come back in one envelope:

```json
{ "code": "NO_GENERATION_AVAILABLE", "message": "생성권이 없어요.", "traceId": "a1b2c3d4" }
```

`code` is the contract — the client switches on it to pick copy and recovery
behaviour, so codes are append-only. `message` is Korean and safe to display
verbatim. Unexpected failures never leak their message; only the `traceId`,
which is also logged.

`TOKEN_EXPIRED` and `UNAUTHORIZED` are distinct on purpose: the first means
"refresh and retry", the second means "sign in again".

**Pagination** is cursor-based:

```json
{ "items": [...], "nextCursor": "MTc2MDAwMDAwMDAwMDpkZWFk...", "hasMore": true }
```

Cursors are opaque; pass `nextCursor` back verbatim or omit it for the first
page.

**Timestamps** are ISO-8601 UTC. `postDate` is a plain `YYYY-MM-DD` calendar
date in the service timezone (`Asia/Seoul`).

## Public

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/auth/apple` | `identityToken` + raw `nonce`; verified against Apple's JWKS, issuer, `aud` and nonce |
| `POST` | `/auth/kakao` | `authorizationCode` + `redirectUri`; the code→token exchange happens server-side |
| `POST` | `/auth/refresh` | Rotates. A replayed token revokes every session (`REFRESH_TOKEN_REUSED`) |
| `POST` | `/auth/logout` | Revokes one refresh token |
| `GET` | `/system/config` | Minimum version, maintenance flag, feature flags. Reachable before sign-in by design |

## Me and profiles

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/users/me` | Also allowed with an incomplete profile |
| `PATCH` | `/users/me` | Partial. Omitted fields are untouched. Birth date is write-once |
| `DELETE` | `/users/me` | Phase one of deletion; see `PRIVACY.md` |
| `GET` | `/users/nickname-availability?nickname=` | `TAKEN` · `FORBIDDEN` · `INVALID_FORMAT` |
| `GET` | `/interests` | Server-owned taxonomy |
| `GET` | `/users/{userId}` | 404, not 403, for a blocked user — confirming existence tells them too much |
| `GET` | `/users/{userId}/pixels` | Public history, paginated |
| `POST`/`DELETE` | `/users/{userId}/block` | Immediate and total; severs the connection and the conversation |
| `GET` | `/users/me/blocks` | |
| `POST`/`DELETE` | `/users/me/push-tokens` | Re-registering a token re-points it at the current user |

## The create flow

```
POST /pixels/uploads              { mimeType, byteSize }
  → { uploadId, uploadUrl, headers, expiresAt }
PUT  <uploadUrl>                  the photo, device → private bucket
POST /pixels/generate             { uploadId, style } → QUEUED generation
GET  /pixels/generations/{id}     poll until terminal
POST /pixels/{generationId}/publish
```

`uploadId` is our row id, never the storage key. One upload can be generated
from once (`UPLOAD_ALREADY_USED`).

Generation status: `QUEUED → PROCESSING → COMPLETED | FAILED |
REJECTED_UNSAFE`. `progress` is real pipeline position, not a timer.
`usedFreeGeneration` / `usedCredit` say what it cost; any non-`COMPLETED`
terminal state has already refunded it.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/pixels/generate/retry` | Re-renders a stored analysis — same outfit, new render |
| `GET` | `/pixels/today` | The vertical feed, ranked server-side |
| `GET` | `/pixels/today-status` | Drives the create-button dot and the retry cost copy |
| `GET` | `/pixels/me` | Owner history. Reports *whether* an original exists, never a URL |
| `GET` | `/pixels/{postId}` | 404 if not public and not yours |
| `GET` | `/pixels/{postId}/original` | Owner only. Short-lived signed URL. The only way to see an original |
| `DELETE` | `/pixels/{postId}/original` | Deletes the photo; character and record survive |
| `POST` | `/pixels/{postId}/unpublish` | Leaves the feed, stays in your record |
| `DELETE` | `/pixels/{postId}` | |

Publish body: `{ caption?, mood?, tags?, replaceRepresentative }`. Without
`replaceRepresentative`, a second publish on the same day returns
`ALREADY_PUBLISHED_TODAY` — the app turns that into the "바꿀까요?" confirmation
rather than silently overwriting someone's day.

## Reactions, connections, chat

| Method | Path | Notes |
| --- | --- | --- |
| `POST`/`DELETE` | `/pixels/{postId}/heart` | Idempotent both ways. Not on your own post; not across a block |
| `POST` | `/users/{userId}/connect` | 👋. Mutual ⇒ `{ status: "CONNECTED", connection }` with a ready conversation |
| `DELETE` | `/users/{userId}/connect` | Withdraws a pending wave |
| `GET` | `/connections` | `pendingIncoming` is always `[]` — see `PRODUCT.md` |
| `POST` | `/connections/{id}/acknowledge` | Marks the celebration seen, per user |
| `GET` | `/conversations` | |
| `GET` | `/conversations/{id}/messages` | Newest-first; the UI renders inverted |
| `POST` | `/conversations/{id}/messages` | Idempotent on `clientMessageId` |
| `POST` | `/conversations/{id}/read` | |

Conversations exist only for an active mutual connection; there is no code path
that produces one otherwise (`NOT_CONNECTED`).

## Square, notifications, store, safety

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/square/today` | Scene, props, occupants with server-assigned coordinates, curation rails |
| `GET` | `/notifications` | |
| `GET` | `/notifications/badge` | `pendingConnections` is always `0` |
| `POST` | `/notifications/{id}/read`, `/notifications/read-all` | |
| `GET` | `/store/products` | Catalog + PIXME+ benefits. Fallback prices only |
| `POST` | `/purchases/verify` | Server-side receipt validation is the only thing that grants |
| `POST` | `/purchases/restore` | Resolves products by store SKU |
| `GET` | `/entitlements`, `/credits` | |
| `POST` | `/reports` | `alsoBlock` blocks in the same action |

Purchase verification returns `GRANTED` · `ALREADY_GRANTED` · `PENDING` ·
`INVALID`. `PENDING` is a real Play state (deferred payment methods); the client
must not treat it as a grant.

Square placement is persisted per `(day, post)`, so a refresh never rearranges
the crowd and everyone sees the same arrangement. Occupant coordinates are in a
1000 × 1400 canvas space; the client scales them.

## WebSocket

`wss://…/ws/chat?token=<access token>` — the query string because React
Native's `WebSocket` cannot set headers.

Up: `SEND`, `READ`, `SUBSCRIBE`, `PING`.
Down: `MESSAGE`, `ACK`, `READ`, `CONVERSATION_UPDATED`, `ERROR`, `PONG`.

`ACK` carries the canonical message so the client can reconcile its optimistic
bubble. Sends are deduplicated with REST on `clientMessageId`, so a reconnect
mid-send cannot duplicate a bubble.

## Rate limits

Fixed-window, per user, in Redis — generation (10/h), hearts (60/min), waves
(60/h), messages (60/min), reports (20/day). Over the limit returns
`RATE_LIMITED` (429).

The limiter **fails open**: if Redis is unreachable nobody is blocked. Losing a
limiter is better than losing the service, and the hard per-day caps in the
database still protect the expensive path.
