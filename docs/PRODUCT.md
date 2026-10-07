# PIXME — product rules

This file records the decisions that the code enforces, and why. If a change
contradicts something here, the change is probably wrong — or this file needs
updating first.

## One sentence

PIXME turns today's photo into a pixel character, publishes it as your
"today", and lets people browse each other's day and react lightly.

## What PIXME must never become

Tinder with pixel avatars · a looks-rating app · an AI photo filter · random
chat · an avatar game · a metaverse · a Cyworld clone · a plain OOTD feed · a
dress-up game.

Romance can happen. The product is not a dating service and nothing in it is
optimised for matching.

## The rules, and where they live in the code

### One representative PIXME per person per day

The single most load-bearing rule. The feed and the square are legible because
they are "today, one card per person".

- Enforced by a **partial unique index**, not by application discipline:
  `pixel_posts_one_representative_per_day` in `V1__init.sql`.
- A user may generate several candidates; publishing again replaces the
  representative post and demotes the previous one to their private record
  (`PixelPostService.publish`).
- Re-publishing the same generation is idempotent.

### Every PIXME shares one skeleton

The person and the outfit change. The construction — proportions, head-to-body
ratio, scale, pixel density, how far features are simplified, pose, canvas
occupancy, foot baseline, centring — never does. That is what makes a square
full of strangers look like one world instead of a collage.

Enforced in three places, because a prompt alone is not enough:

1. The official reference image is sent to the provider as **Image B** on every
   generation (`MasterCharacterReference`).
2. Its geometry is **measured** at startup into `CharacterSpec` and stated
   numerically in the prompt, so a vague reading of the picture cannot drift.
3. Every result is **conformed** to that spec by `CharacterNormalizer` —
   trimmed, nearest-neighbour scaled, centred, soles on the baseline.

The face is the one deliberate nuance: its **shape** follows the person (eye
shape, brows, lips — the character should look like them), while its
**rendering** is fixed by the reference. See `AI.md`.

### The day boundary is a product decision

`postDate` is resolved in `Asia/Seoul`, not UTC, so a PIXME made at 1am belongs
to that night. `ServiceClock` owns this and is injectable so the boundary is
testable (`ServiceClockTest`).

### Moving on is neutral

There is no dislike, pass, or reject affordance anywhere — not in the UI, not
in the API, not in the schema. Scrolling to the next person carries no
semantics. The only outgoing signals are ♡ and 👋.

### A wave reveals nothing until it is returned

`👋` creates a one-directional `connection_requests` row. The recipient is
**never** shown a queue of who waved at them:

- `GET /connections` returns `pendingIncoming` as a permanently empty list.
- `GET /notifications/badge` returns `pendingConnections: 0`.
- The push for an incoming wave is anonymous: "누군가 친해지고 싶어해요".

Both fields exist so the client contract survives if this is ever revisited.
Showing the sender would make *not* waving back socially costly, which is the
whole thing we are avoiding.

### Mutual 👋 creates the conversation atomically

`ConnectionService.request` detects the opposite row, creates the connection
and the conversation in one transaction, and seeds the system opener so the
thread is never an empty room. The pair is stored in canonical order with a
unique index, so two simultaneous waves cannot produce two connections.

> Ordering uses `Connection.compareUuids`, not `UUID.compareTo` — Java compares
> the halves as signed longs while Postgres compares bytes unsigned, and the two
> disagree for any UUID with the high bit set.

### A heart is one bit, forever

`reactions` has a unique index on `(from_user_id, post_id, type)` and the insert
is `ON CONFLICT DO NOTHING`, so a double-tap or a retried request is a no-op.
There is exactly one reaction type; adding a second would turn the heart into a
rating.

### No ranks, anywhere

The square's rails are unordered sets of people, never 1st/2nd/3rd. The "many
hearts today" rail blends reaction **rate** with recency and a new-user term,
and a user appears in at most one rail — specifically so the same faces don't
own it every day (`SquareService.buildCurations`).

### Discovery optimises for variety, not desirability

`FeedRanker` scores recency, bounded interest overlap, reaction *rate* (not
count), a new-user boost, and penalties for already-seen posts and
over-exposed authors. There is no attractiveness signal and no match
prediction. The jitter term is deliberately small — it breaks ties, it must
never override a real signal.

A fifth of each page is reserved for accounts younger than a week, interleaved
rather than clustered. Without it, newcomers never surface and the app feels
dead to the people who just arrived.

### Relationships are free; self-expression is paid

Enforced structurally: there is no `ProductKind` that can gate a heart, a wave,
a connection, a conversation, the feed or the square. What is sellable is extra
generations, styles and decoration.

**Clothing is never sold.** The entire premise is that the character wears what
the person actually wore.

### Free generation is an onboarding grant, not a daily allowance

There is **no** daily free generation. A new account gets three free chances,
and they are deliberately three *different currencies* rather than a counter of
three:

| # | Currency | Scope |
| --- | --- | --- |
| 1 | First generation | Once per account. Nobody should pay to find out what the product does. |
| 2 | First retry | Once, and **only on the first character's result screen**. |
| 3 | Bonus free credit | One, usable any time afterwards. |

After those, generation is paid.

The retry exists for one reason: to stop someone leaving because the very first
AI result disappointed them. So it is scoped to that moment and cannot be
hoarded — a later "make another PIXME" spends the bonus credit, never the
retry. Once it has been used, the user picks between the two candidates side by
side, because comparing is much easier than remembering.

The bonus credit exists so a user can discover the thing the whole product rests
on: *a different outfit produces a different PIXME.*

Collapsing these into one number would lose exactly the distinctions that make
them work — and would make a refund unable to give back the right thing, which
is why `SpendKind` is recorded on every generation.

### The user never pays for a character they didn't get

- The allowance is spent *before* dispatch, so two parallel requests can't both
  use the last credit.
- Every non-success terminal state refunds — provider error, timeout, crash, or
  a photo the safety screen rejects.
- Refunds are keyed to the generation, with a partial unique index on
  `(reference_id, GENERATION_REFUND)`, so they can happen at most once.
- `MaintenanceJobs.reapStuckGenerations` covers the case where the worker dies
  mid-flight, which is the only way a credit could otherwise be silently lost.

The free daily slot and paid credits are separate fields on
`generation_credits`. Conflating them is how you end up charging someone who
still had a free generation, or denying tomorrow's free one to someone who
bought credits.

### Never invent what the photo doesn't show

A selfie yields a bust; an upper-body shot fades out below the hips; only a
full-body photo gets legs and shoes. `PromptLibrary.framingClause` states this
as an explicit prohibition, because "I wasn't wearing that" is the one failure
users notice instantly. Covered by `PromptLibraryTest`.

### The app is quiet

- Hearts are grouped: ten hearts on one post is one notification that updates
  in place, and only the first one pushes.
- Only messages and connections make a sound.
- The daily reminder is at most once a day, evening only, and suppressed
  entirely for anyone who already published.
- Every notification type is individually switchable, and a disabled type is
  neither pushed nor written.

### The original photo is the most sensitive thing we hold

It goes straight from the device to a private bucket via a pre-signed URL — the
API never sees the bytes. It is never serialised into any response; the only way
to see one is an explicit, owner-only request for a short-lived signed URL. The
user can turn retention off entirely, in which case it is deleted the moment
the character exists. See `PRIVACY.md`.

## Monetisation shape

| Thing | Price source |
| --- | --- |
| First generation, its retry, one bonus credit | Free, once per account |
| Further generations | `products` table, 1 / 3 / 10 packs |
| Styles | `products` table, non-consumable unlocks |
| Decoration (backgrounds, frames, effects, themes) | `products` table |
| PIXME+ | Subscription; monthly credit grant + cosmetics |

Prices live in App Store Connect / Play Console and in the `products` table as
a display fallback. The client always prefers the store's localised price. No
price is hardcoded in either source tree.

Ads are off. If they ever ship, it is rewarded-only ("watch an ad for one more
generation") and never interstitial.
