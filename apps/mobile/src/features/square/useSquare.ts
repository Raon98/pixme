import { useQuery } from '@tanstack/react-query';

import { qk, squareApi } from '@/api';
import { config } from '@/lib/config';

/**
 * Today's square.
 *
 * The server returns the scene (time-of-day / season), prop layout, curation
 * rails and — importantly — each occupant's canvas coordinate. Placement is
 * server-owned so that it is stable across refreshes, non-overlapping, and
 * identical for everyone looking at the same square.
 */
export function useSquare() {
  return useQuery({
    queryKey: qk.square.today(),
    queryFn: () => squareApi.today({ limit: config.rules.squarePageSize }),
    staleTime: 2 * 60_000,
  });
}
