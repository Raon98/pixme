import { login } from '@react-native-seoul/kakao-login';

import type { ProviderOutcome } from './apple';

/**
 * Kakao sign-in via the native SDK (KakaoTalk app handoff, falling back to an
 * in-app browser when KakaoTalk isn't installed).
 *
 * <p>Replaced the system-browser authorization-code flow this app started
 * with: Kakao's own "리다이렉트 URI" registration only accepts http/https, never
 * a custom URI scheme, so there was no way to register `pixme://oauth/kakao`
 * at all. The native SDK sidesteps the redirect URI entirely — it talks to
 * KakaoTalk directly via the app's platform registration (iOS bundle
 * id / Android package + key hash in the Kakao console), not a web redirect.
 *
 * <p>Trade-off worth knowing: unlike the old flow, the access token now
 * passes through this app (`AuthService.signInWithKakaoAccessToken` on the
 * server calls Kakao's `/v2/user/me` with it once and never stores it) —
 * the Kakao REST client secret still never ships in the bundle, only the
 * already-public native app key does.
 */
export async function signInWithKakao(): Promise<ProviderOutcome<string>> {
  try {
    const token = await login();
    return { status: 'success', payload: token.accessToken };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The native SDK signals a user-dismissed login as a rejected promise,
    // not a distinct result type — matched by message rather than a typed
    // cancellation, since that's all it gives us.
    if (/cancel/i.test(message)) {
      return { status: 'cancelled' };
    }
    return { status: 'error', error };
  }
}
