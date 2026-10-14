import { Image } from 'react-native';

/**
 * Preview mode — the whole app running against in-memory fake data instead of
 * the real API.
 *
 * <p>Exists for one reason: previewing screens before a backend is reachable
 * (or reachable from wherever you're looking at the app). Every network call
 * in `src/api` is swapped for a deterministic local implementation when this
 * is on — see `src/api/mock.ts` and `src/api/index.ts`.
 *
 * <p>Enabled with an env var, never by default, so it can never accidentally
 * ship:
 *
 * ```bash
 * EXPO_PUBLIC_PIXME_MOCK=1 npx expo start --web
 * ```
 */
export const MOCK_MODE = process.env.EXPO_PUBLIC_PIXME_MOCK === '1';

/**
 * 1x1 fully transparent pixel — a valid `uri` when an asset fails to resolve.
 *
 * <p>Verified transparent (RGBA 0,0,0,0). The previous value here looked like
 * the same thing but was a 1-bit greyscale pixel with no alpha, i.e. opaque
 * black — so every unresolved character rendered as a black square instead of
 * quietly disappearing.
 */
const BLANK_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==';

/**
 * The preview cast — one asset per real account, not a pool of anonymous
 * strangers.
 *
 * <p>Preview mode used to invent six made-up people and rotate three renders
 * between them, which meant the same face appeared under two names. Now each
 * render belongs to exactly one identity, and those identities are the real
 * accounts this build is tested with, so what you see in the square is what
 * those accounts will actually look like once they sign in:
 *
 * <ul>
 *   <li>{@code cheol1998@kakao.com} — 나 (master)
 *   <li>{@code ahdzz11@naver.com} — the App Review account (master)
 *   <li>{@code cheer997979@naver.com} — 민주
 * </ul>
 *
 * <p>All three are genuine API-generated renders from live OpenAI
 * verification runs, normalized through the real `CharacterNormalizer` —
 * never hand-drawn mockups, so screen layouts are judged against what
 * generation actually produces.
 *
 * <p>Resolution differs by platform and both paths matter: on web Metro's
 * `require` already hands back `{ uri, width, height }`, while on native it
 * returns an opaque asset id that only `Image.resolveAssetSource` can expand
 * — and that function does not exist at all in react-native-web, so calling
 * it unconditionally throws there. Resolved defensively either way: this runs
 * at module-eval time, before any component exists to show an error boundary.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const CHEOL = resolveAsset(
  require('../../assets/mock/generated-character-cheol.png'),
);

/**
 * The App Review account's two renders — same person, same source photo, two
 * generation runs. Index 1 exists so one account in the preview has a
 * non-empty Collection to look at; it is deliberately *not* handed to a
 * different name, which is the bug this replaced.
 */
const AHDZZ = [
  resolveAsset(require('../../assets/mock/generated-character-1.png')),
  resolveAsset(require('../../assets/mock/generated-character-2.png')),
].filter((uri): uri is string => uri !== null);

/**
 * 민주's render — background-removed from a raw OpenAI output via `rembg`
 * segmentation, since that export was already flattened against an opaque
 * black vignette (no real alpha channel left to recover by threshold).
 */
const MINJU = resolveAsset(
  require('../../assets/mock/generated-character-minju.png'),
);

/** 성철's Y2K-style run of the same source photo — see {@link MOCK_PROMO}. */
const CHEOL_Y2K = resolveAsset(
  require('../../assets/mock/generated-character-cheol-y2k.png'),
);
/* eslint-enable @typescript-eslint/no-require-imports */

/** 나 — cheol1998@kakao.com. */
export const MOCK_CHEOL_URI: string = CHEOL ?? BLANK_PIXEL;

/** The App Review account — ahdzz11@naver.com. Index 0 is current. */
export const MOCK_AHDZZ_URIS: string[] =
  AHDZZ.length > 0 ? AHDZZ : [BLANK_PIXEL];

/** 민주 — cheer997979@naver.com. */
export const MOCK_MINJU_URI: string = MINJU ?? BLANK_PIXEL;

/** Fallback for call sites that only need *some* character. */
export const MOCK_CHARACTER_URI = MOCK_CHEOL_URI;

/**
 * Dresses the preview for promo capture:
 * `EXPO_PUBLIC_PIXME_MOCK=1 EXPO_PUBLIC_PIXME_MOCK_PROMO=1`.
 *
 * <p>Two effects, both about what a *screenshot* has to show, and neither
 * inventing anyone: the same three real accounts stand together in front of
 * the fountain instead of spread to the canvas edges, and generation returns
 * {@link MOCK_CHEOL_Y2K_URI} — the real run of the same photo the ad opens on
 * — so the result screen shows the character the viewer just watched being
 * made rather than an unrelated render.
 */
export const MOCK_PROMO = process.env.EXPO_PUBLIC_PIXME_MOCK_PROMO === '1';

/** 성철's Y2K render — the ad's hero, generated from `cheol-photo.jpg`. */
export const MOCK_CHEOL_Y2K_URI: string = CHEOL_Y2K ?? BLANK_PIXEL;

/**
 * Renders handed out to freshly *generated* characters, cycled per generation.
 *
 * <p>Every mock generation used to return {@link MOCK_CHARACTER_URI}, the same
 * image already published as today's status — so the result screen compared
 * the two, found them identical and showed "이미 선택한 PIXME예요" every single
 * time. The whole result flow was unreachable in the preview. Distinct images
 * also make a retry visibly a *different* render, which is the entire point of
 * the compare step.
 */
export const MOCK_GENERATED_URIS: string[] = [
  ...MOCK_AHDZZ_URIS,
  MOCK_MINJU_URI,
].filter((uri) => uri !== BLANK_PIXEL);

type AssetModule = number | { uri?: string } | undefined | null;

function resolveAsset(module: AssetModule): string | null {
  try {
    // Web: Metro already resolved it to a served URL.
    if (module && typeof module === 'object' && typeof module.uri === 'string') {
      return module.uri;
    }
    // Native: an asset id that needs expanding. Guarded because
    // react-native-web does not implement this at all.
    const resolve = (
      Image as unknown as {
        resolveAssetSource?: (value: AssetModule) => { uri?: string } | null;
      }
    ).resolveAssetSource;
    if (typeof resolve === 'function') {
      return resolve(module)?.uri ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
