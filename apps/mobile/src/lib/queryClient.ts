import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/errors';

/**
 * Shared query client.
 *
 * Retry policy is intentionally conservative: auth and validation failures
 * must surface immediately (retrying a 401 just delays the re-login prompt),
 * while transient network/5xx failures get two attempts with backoff.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
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
