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
 * The one test character every mock PIXME post uses.
 *
 * <p>`Image.resolveAssetSource` works for a bundled `require(...)` on every
 * platform Expo targets, including web, where Metro serves the file and this
 * simply returns its URL. Resolved defensively: this runs at module-eval
 * time, before any component exists to show an error boundary, so a failure
 * here must degrade to a visibly-broken image rather than a blank app.
 */
export const MOCK_CHARACTER_URI = resolveMockCharacterUri();

function resolveMockCharacterUri(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const resolved = Image.resolveAssetSource(require('../../assets/mock/sample-character.png'));
    if (resolved?.uri) return resolved.uri;
  } catch {
    // fall through to the placeholder below
  }
  // 1x1 transparent pixel — keeps every <PixelCharacter uri={...} /> call
  // valid even if the asset failed to resolve for some reason.
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
}
