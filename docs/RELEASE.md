# Release checklist

Everything below is a real prerequisite for a first App Store / Play
submission. Items marked **blocking** cannot be deferred — they are either a
legal requirement, a store rejection risk, or a correctness hole.

## Accounts and credentials

- [ ] **blocking** Apple Developer Program; bundle id `com.pixme.app`
- [ ] **blocking** Sign in with Apple capability enabled, and `PIXME_APPLE_CLIENT_IDS`
      set to exactly the bundle ids you ship. Without the `aud` check, a token
      minted for *any* app would authenticate here.
- [ ] **blocking** Kakao Developers app; REST key in the client, **client secret
      on the server only**
- [ ] **blocking** `PIXME_JWT_SECRET` ≥32 random bytes, per environment. The
      app refuses to start otherwise.
- [ ] **blocking** `PIXME_APPLE_ROOT_CERTS` pointing at Apple's root CA. Without
      it, receipt chains are not anchored and the server logs a loud warning —
      acceptable in development, never in production.
- [ ] **blocking** Google Play service account JSON for receipt validation
- [ ] AI provider key, with a spend cap configured
- [ ] Expo access token for push

## Store configuration

- [ ] IAP products created and **approved**, with ids matching the `products`
      table (`app.pixme.credit.1|3|10`, `app.pixme.style.*`,
      `app.pixme.decor.*`, `app.pixme.plus.monthly`)
- [ ] Subscription group and localised prices for PIXME+
- [ ] **blocking** Subscription metadata in-app: price, period, auto-renewal,
      and how to cancel. Apple rejects subscriptions without this.
- [ ] **blocking** "구매 복원" reachable without an account action — it is on the
      store screen and in Settings
- [ ] Sandbox tested end to end: purchase, grant, restore, **deferred/pending
      payment on Play**, and expiry

## Legal and privacy

- [ ] **blocking** Terms and Privacy Policy live at the URLs in
      `app.config.ts` → `extra`, reachable **before** sign-in (they are linked
      on the login screen)
- [ ] **blocking** Privacy Policy states: photos are uploaded to generate a
      character, sent to an AI provider, retained for *N* days, and deletable
      individually or by turning retention off
- [ ] **blocking** App Privacy / Data Safety declarations match reality —
      photos, email, user content, identifiers. Cross-check against
      `PRIVACY.md`; an inaccurate declaration is a rejection and a compliance
      problem.
- [ ] **blocking** Account deletion reachable **in-app** (MY → 설정 → 계정 삭제).
      Required by App Store guideline 5.1.1(v) for any app with account
      creation.
- [ ] **blocking** AI provider data-retention terms reviewed and reflected in
      the policy. This is the one external dependency that materially changes
      what we can promise.
- [ ] Age rating: 17+ on iOS. The app has user-generated content and
      unmoderated 1:1 chat.
- [ ] 14+ age floor enforced (it is, in `UserService.requireMinimumAge`) and
      stated in the terms
- [ ] Korea: 위치정보 사업자 신고 **not** required — no location data is
      collected. Confirm with counsel that 통신과금 does not apply given all
      payments go through the platform stores.

## Safety — guideline 1.2 for UGC apps

Apple requires all four of these for apps with user-generated content. All are
implemented; verify each is reachable in the built binary:

- [ ] **blocking** A method for filtering objectionable material →
      pre-generation safety screen + text sanitiser on nicknames, bios,
      captions and tags
- [ ] **blocking** A mechanism to report offensive content → report sheet on
      profiles, posts and chats, with "also block" defaulted on
- [ ] **blocking** The ability to block abusive users → immediate, total and
      symmetric
- [ ] **blocking** Published contact information for support →
      `PIXME_SUPPORT_EMAIL`, linked in Settings
- [ ] A human can act on reports within 24h. Automatic escalation suspends an
      account after 3 distinct reporters in 24h, but that is a holding action,
      not a substitute for review.
- [ ] Moderation runbook written: who reviews, what the actions are, how a
      suspended user appeals

## Build

- [ ] `npm run typecheck` clean; `mvn test` green
- [ ] Permission strings reviewed in Korean (camera, photo library,
      notifications) — they are in `app.config.ts`
- [ ] **blocking** Push permission is requested *after* the first publish, not
      at launch. Verify on a real device; a launch-time prompt tanks opt-in.
- [ ] App icon, splash, notification icon at required sizes
- [ ] Screenshots for every required device size, showing real characters
- [ ] `PIXME_VARIANT=production`; verify the bundle contains no AI or storage
      key (`npx expo export` and grep)
- [ ] Crash reporting wired (`PIXME_SENTRY_DSN`)
- [ ] `pixme.purchase.allow-sandbox=false` in production

## Infrastructure

- [ ] Postgres with automated backups and PITR
- [ ] Redis (the rate limiter fails open, so this is availability, not
      correctness)
- [ ] **blocking** Originals bucket is private, with no public policy and no
      CDN in front of it. Verify by requesting an object key directly.
- [ ] Characters bucket behind a CDN with long cache TTLs (objects are
      immutable)
- [ ] Lifecycle rule on the originals prefix as a second line of defence behind
      the retention job
- [ ] Scheduled jobs confirmed running in production — in particular
      `reapStuckGenerations`, which is what makes the refund promise hold
      across deploys
- [ ] Alerts on: generation failure rate, provider latency and spend, stuck
      generations, 5xx rate, push failure rate
- [ ] Maintenance and force-update levers tested (`PIXME_MAINTENANCE`,
      `PIXME_MIN_APP_VERSION`) — these are the only way to stop a bad release

## Day-one content

A social app with an empty square is a dead app. Before any marketing:

- [ ] Seed the square so a first user sees other people's day, not a blank
      plaza
- [ ] Verify the new-user feed quota actually surfaces newcomers at low volume
- [ ] Decide the launch geography — the square is global in this build, which
      is fine while volume is low and will need segmentation later

## Known limitations to decide on before launch

| Limitation | Impact |
| --- | --- |
| Realtime chat is single-node | A user on another instance misses the instant frame and gets it via push + next fetch. Fine at launch; add Redis pub/sub behind `ChatSessionRegistry` before scaling out. |
| Square is one global space, newest *N* occupants | Once a day exceeds the canvas, older posters drop off the canvas (they remain in the feed). Needs segmentation or pagination at volume. |
| Moderation is report-driven | No proactive review of published characters. Acceptable because output is stylised pixel art, but the queue needs a human. |
| Dark mode is structural, not finished | Every component reads semantic colours and it is selectable in Settings, but light mode is what has been designed. |
