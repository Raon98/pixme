# PIXME — mobile

Expo + React Native + TypeScript. See `../../docs/ARCHITECTURE.md` for how this
fits with the API.

## Running

```bash
cp .env.example .env     # point PIXME_API_BASE_URL at your server
npm install
npm start
```

Works in Expo Go except Apple sign-in and in-app purchases, which need a native
build (`npm run ios` / `npm run android`).

With the server on `pixme.ai.provider=stub`, the whole create flow works
offline against a procedurally drawn character — no AI key, no spend.

## Layout

| Path | Contents |
| --- | --- |
| `app/` | expo-router routes. Thin by design: layout and wiring, no domain logic |
| `src/theme/` | Design tokens → semantic light/dark themes → provider |
| `src/ui/` | The design system. Nothing outside it sets a raw colour or spacing |
| `src/api/` | Typed wire contract, axios client, query keys |
| `src/features/<domain>/` | Hooks, Zustand stores, domain components |
| `src/lib/` | config, storage, analytics, haptics, image, push, logger |
| `src/constants/` | Interests, moods, tags — and every user-facing string |

## Conventions

- **No hardcoded design values.** Components read semantic colours from the
  theme (`colors.accent`, not `'#7C6CF0'`) and spacing from tokens. That is what
  makes dark mode a config change rather than a refactor.
- **All copy in `constants/copy.ts`.** The product's voice — warm, never
  evaluative, never "pass"/"reject" about a person — is reviewable in one file.
- **Every screen has loading, empty and error states.** A new user's first five
  minutes are almost entirely empty states; each one names the situation and
  offers exactly one next action.
- **Server owns ranking, placement and pricing.** The client renders what it is
  given. No feed scoring, no square layout maths, no price constants.
- **`any` is not used.** `npm run typecheck` runs with `strict` plus
  `noUncheckedIndexedAccess` and `noUnusedLocals`.

## Screens

Splash · Onboarding · Login · Profile setup · Today feed · Square (+ occupant
sheet) · Create (sheet → preview → generating → result → publish) · User
profile · Pixel detail · Connection success · Conversations · Chat · MY · Pixel
history (grid + calendar) · Notifications · Settings (+ notifications, privacy,
blocked users, delete account) · Report · Store · PIXME+ · Purchase success.

## Build

```bash
npm run typecheck
eas build --profile production --platform ios
```

`eas.json` carries per-environment API URLs. Nothing secret is in this tree:
the client holds only public values (API base URL, Kakao *REST* key, legal
links). Verify before submitting:

```bash
npx expo export --platform ios && grep -ri "sk-\|secret" dist/ | head
```
