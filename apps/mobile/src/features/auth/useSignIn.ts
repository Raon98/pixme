import { useCallback, useState } from 'react';

import { authApi } from '@/api';
import { errorMessage } from '@/api/errors';
import { copy } from '@/constants/copy';
import { haptics } from '@/lib/haptics';
import { logger } from '@/lib/logger';

import { useAuthStore } from './authStore';
import { signInWithApple } from './providers/apple';
import { signInWithKakao } from './providers/kakao';

const log = logger('sign-in');

export type SignInMethod = 'apple' | 'kakao';

/**
 * Drives the login screen. Owns the per-provider pending flag so the two
 * buttons can show independent spinners, and funnels every failure into a
 * single user-readable message.
 */
export function useSignIn() {
  const applyAuthResponse = useAuthStore((state) => state.applyAuthResponse);
  const [pending, setPending] = useState<SignInMethod | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (method: SignInMethod) => {
      setPending(method);
      setError(null);

      try {
        if (method === 'apple') {
          const outcome = await signInWithApple();
          if (outcome.status === 'cancelled') {
            setError(copy.auth.cancelled);
            return false;
          }
          if (outcome.status !== 'success') {
            if (outcome.status === 'error') log.warn('apple failed', outcome.error);
            setError(copy.auth.failed);
            return false;
          }
          const response = await authApi.apple(outcome.payload);
          await applyAuthResponse(response);
        } else {
          const outcome = await signInWithKakao();
          if (outcome.status === 'cancelled') {
            setError(copy.auth.cancelled);
            return false;
          }
          if (outcome.status !== 'success') {
            if (outcome.status === 'error') log.warn('kakao failed', outcome.error);
            setError(copy.auth.failed);
            return false;
          }
          const response = await authApi.kakao(outcome.payload);
          await applyAuthResponse(response);
        }

        haptics.celebrate();
        return true;
      } catch (unknownError) {
        log.warn('sign-in request failed', unknownError);
        setError(errorMessage(unknownError));
        return false;
      } finally {
        setPending(null);
      }
    },
    [applyAuthResponse],
  );

  return {
    signIn: run,
    pending,
    error,
    clearError: () => setError(null),
  };
}
