import { useQuery } from '@tanstack/react-query';

import { qk, storeApi } from '@/api';

export function useCredits() {
  return useQuery({
    queryKey: qk.me.credits(),
    queryFn: () => storeApi.credits(),
    staleTime: 60_000,
  });
}
