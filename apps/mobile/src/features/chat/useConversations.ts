import { useQuery } from '@tanstack/react-query';

import { chatApi, qk } from '@/api';

export function useConversations() {
  return useQuery({
    queryKey: qk.chat.conversations(),
    queryFn: () => chatApi.conversations(),
    staleTime: 15_000,
  });
}
