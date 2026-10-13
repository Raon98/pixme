import { MutationCache, QueryClient } from '@tanstack/react-query';

import { ApiError, errorMessage } from '@/api/errors';

/**
 * Shared query client.
 *
 * Retry policy is intentionally conservative: auth and validation failures
 * must surface immediately (retrying a 401 just delays the re-login prompt),
 * while transient network/5xx failures get two attempts with backoff.
 */
/**
 * Last-resort reporter for mutations that failed with nobody watching.
 *
 * <p>Set by the app shell at startup. A mutation with its own `onError` is
 * left alone — this only catches the ones that would otherwise fail in total
 * silence (block a user, switch Current PIXME, mark all read…), where the
 * screen just sits there and the user cannot tell whether it worked.
 */
let reportMutationError: ((message: string) => void) | null = null;

export function setMutationErrorReporter(report: (message: string) => void) {
  reportMutationError = report;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // Respect a hand-written handler; it will have said something better.
        if (mutation.options.onError) return;
        reportMutationError?.(errorMessage(error));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && !error.isRetryable) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(8000, 500 * 2 ** attempt),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
