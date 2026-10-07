import { useMutation, useQueryClient } from '@tanstack/react-query';

import { dailyStatusApi, qk, type DailyStatusEntry, type UpsertStatusRequest } from '@/api';
import { analytics } from '@/lib/analytics';

/**
 * Upserts today's status — free, and independent of generating anything new.
 * Used both by the post-generation flow (mood/message/tags alongside a new
 * Current PIXME) and by a pure "오늘 상태 바꾸기" edit from MY.
 */
export function useUpsertDailyStatus() {
  const queryClient = useQueryClient();

  return useMutation<DailyStatusEntry, unknown, UpsertStatusRequest>({
    mutationFn: (body) => dailyStatusApi.upsertMyToday(body),

    onSuccess: async (status) => {
      analytics.track('DAILY_STATUS_UPDATED', {
        dailyStatusId: status.id,
        freshCharacter: status.freshCharacter,
        hasMood: !!status.mood,
        hasMessage: !!status.message,
        tagCount: status.tags.length,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.feed.status() }),
        queryClient.invalidateQueries({ queryKey: qk.feed.today() }),
        queryClient.invalidateQueries({ queryKey: qk.square.today() }),
        queryClient.invalidateQueries({ queryKey: qk.dailyStatus.mine() }),
        queryClient.invalidateQueries({ queryKey: qk.dailyStatus.history() }),
        queryClient.invalidateQueries({ queryKey: qk.me.profile() }),
      ]);
    },
  });
}
