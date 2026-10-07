import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { pixelsApi, qk } from '@/api';
import { analytics } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';

/** The PIXME Collection — every confirmed character, free to re-select as Current. */
export function useCollection() {
  return useQuery({
    queryKey: qk.pixels.collection(),
    queryFn: () => pixelsApi.collection(),
    staleTime: 60_000,
  });
}

/**
 * Free switch among owned characters — never calls a provider. Also updates
 * today's status, so the switch shows up on Today/광장 immediately.
 */
export function useSetCurrentPixel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (characterId: string) => pixelsApi.setCurrent(characterId),
    onSuccess: async (character) => {
      haptics.selection();
      analytics.track('PIXEL_KEPT', { characterId: character.id, isCurrent: true });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.pixels.collection() }),
        queryClient.invalidateQueries({ queryKey: qk.feed.status() }),
        queryClient.invalidateQueries({ queryKey: qk.feed.today() }),
        queryClient.invalidateQueries({ queryKey: qk.square.today() }),
        queryClient.invalidateQueries({ queryKey: qk.dailyStatus.mine() }),
        queryClient.invalidateQueries({ queryKey: qk.me.profile() }),
      ]);
    },
  });
}
