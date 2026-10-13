import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { decorationsApi, qk, type DecorationSlot } from '@/api';
import { useAuthStore } from '@/features/auth/authStore';

export function useDecorations() {
  const signedIn = useAuthStore((state) => state.sessionState === 'signed-in');

  return useQuery({
    queryKey: qk.decorations.list(),
    queryFn: () => decorationsApi.list(),
    staleTime: 60_000,
    // Owned decorations are a per-account view; asking before there is an
    // account just earns a 401.
    enabled: signedIn,
  });
}

export function useApplyDecoration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      slot,
      unlockCode,
    }: {
      slot: DecorationSlot;
      unlockCode: string | null;
    }) => decorationsApi.apply(slot, unlockCode),
    onSuccess: async (response) => {
      // The response is the whole view, so the picker updates without a
      // refetch; the feed and profile still need one because every card
      // carries its author's decorations inline.
      queryClient.setQueryData(qk.decorations.list(), response);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.feed.today() }),
        // `refetchType: 'none'` — only marks it stale. This screen is reached
        // from MY, which stays mounted underneath and would otherwise fire an
        // eager background refetch for a tab the user cannot currently see.
        // That request's completion mid-flight landed right on top of the
        // back-navigation transition and showed up as the pull-to-refresh
        // spinner starting, then visually hanging. MY already re-fetches on
        // its next real interaction (pull-to-refresh, remount), which is soon
        // enough for a cosmetic change.
        queryClient.invalidateQueries({
          queryKey: qk.me.profile(),
          refetchType: 'none',
        }),
      ]);
    },
  });
}
