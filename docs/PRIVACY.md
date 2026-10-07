# Privacy

PIXME ships without identity verification — no PASS, no phone, no real-name or
ID check. That is a deliberate trade: the safety model is reporting, blocking
and content screening instead. The corresponding obligation is to hold as
little as possible, and to be precise about what we do hold.

## What we store

| Data | Why | Visible to others |
| --- | --- | --- |
| Provider id (Apple/Kakao) | Account identity | No |
| Email (when the provider gives one) | Account recovery, support | No |
| Nickname, bio, interests | The profile | Yes |
| Birth date | Age floor (14+) only | **No** — not even as an age |
| Generated characters | The product | Yes |
| **Original photos** | Input to generation | **Never** |
| Captions, moods, tags | The post | Yes |
| Hearts, connections, messages | The social graph | Only to the parties |
| Push tokens | Notifications | No |
| Purchase receipts | Entitlements, disputes | No |

Gender is optional, never collected by default, and never shown.

## The original photo

The most sensitive thing the product touches, handled accordingly:

1. **It never passes through the API.** The client gets a pre-signed PUT and
   uploads device → private bucket. The application tier never sees the bytes.
2. **EXIF is stripped on the device** before upload, so GPS and device metadata
   never leave the phone.
3. **It is never serialised into any response.** `ResponseAssembler.post` has no
   path that can populate it; even the owner's history DTO reports only
   *whether* an original still exists.
4. **Reading one is an explicit, owner-only request.** `GET
   /pixels/{id}/original` returns a 5-minute signed URL, and the client does not
   cache it to disk.
5. **Keys are random and date-partitioned**, never derived from a nickname or a
   sequence, so one key cannot be guessed from another.
6. **Retention is bounded.** Default 180 days, then a scheduled job deletes the
   photo and keeps the character and the record.
7. **Retention is optional.** With "원본 사진 보관" off, the photo is deleted the
   moment the character exists — at publish time, not by a later job.
8. **Individually deletable.** `DELETE /pixels/{id}/original` at any time.

Abandoned uploads — photo picked, flow left — are reaped hourly.

## Account deletion

Two phases, because both immediacy and reversibility matter.

**Immediately** on `DELETE /users/me`: status `DELETED`, invisible on every
public surface, nickname and bio released, all sessions revoked, push tokens
removed.

**After the grace period** (default 7 days, `AccountPurgeJob`): characters and
originals deleted from object storage first — while we still know their keys —
then the account row, which cascades posts, generations, uploads, reactions,
connections, conversation membership, notifications, blocks and reports.

Signing back in during the grace period restores the account rather than
creating a duplicate. Store purchase records are retained where law requires.

## Analytics

Event properties carry ids, enums, counts and durations — never nickname, bio,
caption, email, image URL, birth date or message content. The client enforces
this at the boundary: `lib/analytics.ts` scrubs forbidden keys and warns in
development. The server applies the same rule.

## Tokens

Access tokens are short-lived stateless JWTs. Refresh tokens are opaque random
strings stored **hashed**, so a database leak cannot be replayed, and they
rotate on every use — presenting an already-rotated token is detectable and
revokes every session for that account.

## Third parties

| Service | Receives | Why |
| --- | --- | --- |
| Apple / Kakao | Nothing from us; we verify their token | Sign-in |
| AI provider | The original photo (transient) | Generation |
| Expo Push → APNs/FCM | Device token, notification text | Notifications |
| Apple / Google billing | Receipts | Purchases |
| S3 / Cloudflare R2 | Photos and characters | Storage |

The AI provider's retention terms are the one external dependency that
materially affects this policy and must be reviewed before launch — see
`RELEASE.md`.
