import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';

import type { KakaoAuthRequest } from '@/api';
import { config } from '@/lib/config';

import type { ProviderOutcome } from './apple';

const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';

/**
 * Kakao sign-in via the system browser (OAuth 2.0 + PKCE).
 *
 * Deliberately not the Kakao native SDK: the authorization-code flow needs no
 * extra native module, works in Expo Go for development, and — crucially —
 * the code is exchanged for tokens *on our server*, so no Kakao client secret
 * ever ships inside the app.
 */
export async function signInWithKakao(): Promise<
  ProviderOutcome<KakaoAuthRequest>
> {
  if (!config.kakao.restApiKey) return { status: 'unavailable' };

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'pixme',
    path: 'oauth/kakao',
  });

  const codeVerifier = base64UrlEncode(Crypto.getRandomBytes(32));
  const codeChallenge = toBase64Url(
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier,
      { encoding: Crypto.CryptoEncoding.BASE64 },
    ),
  );

  const request = new AuthSession.AuthRequest({
    clientId: config.kakao.restApiKey,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ['profile_nickname'],
    usePKCE: false, // we manage the verifier ourselves to forward it verbatim
    extraParams: {
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    },
  });

  try {
    const result = await request.promptAsync({
      authorizationEndpoint: KAKAO_AUTHORIZE_URL,
    });

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { status: 'cancelled' };
    }
    if (result.type === 'error') {
      return {
        status: 'error',
        error: new Error(result.error?.message ?? 'kakao authorize failed'),
      };
    }
    if (result.type !== 'success') {
      return { status: 'error', error: new Error('kakao authorize failed') };
    }

    const code = result.params.code;
    if (!code) {
      return {
        status: 'error',
        error: new Error(result.params.error ?? 'kakao authorize failed'),
      };
    }

    return {
      status: 'success',
      payload: { authorizationCode: code, redirectUri, codeVerifier },
    };
  } catch (error) {
    return { status: 'error', error };
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let out = '';
  for (const byte of bytes) out += chars[byte % chars.length];
  return out;
}

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
