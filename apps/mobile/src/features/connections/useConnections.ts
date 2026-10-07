import { useQuery } from '@tanstack/react-query';

import { connectionsApi, qk } from '@/api';

export function useConnections() {
  return useQuery({
    queryKey: qk.connections.list(),
    queryFn: () => connectionsApi.list(),
    staleTime: 30_000,
  });
}
