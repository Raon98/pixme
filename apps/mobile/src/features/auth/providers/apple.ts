import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import type { AppleAuthRequest } from '@/api';

export type ProviderOutcome<T> =
  | { status: 'success'; payload: T }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'error'; error: unknown };

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Apple sign-in.
 *
 * We generate a nonce, hash it for Apple, and send the *raw* nonce to our
 * server so it can verify the `nonce` claim inside the identity token. Without
 * this, a stolen identity token could be replayed.
 */
export async function signInWithApple(): Promise<
  ProviderOutcome<AppleAuthRequest>
> {
  if (!(await isAppleSignInAvailable())) return { status: 'unavailable' };

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { status: 'error', error: new Error('missing identityToken') };
    }

    const fullName = credential.fullName
      ? [credential.fullName.familyName, credential.fullName.givenName]
          .filter(Boolean)
          .join('')
      : null;

    return {
      status: 'success',
      payload: {
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode ?? undefined,
        fullName: fullName || null,
        email: credential.email ?? null,
        nonce: rawNonce,
      },
    };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'ERR_REQUEST_CANCELED'
    ) {
      return { status: 'cancelled' };
    }
    return { status: 'error', error };
  }
}
