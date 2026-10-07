import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  qk,
  reactionsApi,
  type DailyStatusEntry,
  type HeartResponse,
  type Page,
} from '@/api';
import { analytics } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';

/**
 * Hearting is the lightest possible gesture in PIXME, so it must feel
 * instant: we patch every cache that can show this status optimistically and
 * roll back on failure. The server is idempotent, so a double-tap can never
 * produce two hearts.
 */
function patchCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  dailyStatusId: string,
  update: (status: DailyStatusEntry) => DailyStatusEntry,
) {
  queryClient.setQueriesData<{ pages: Page<DailyStatusEntry>[]; pageParams: unknown[] }>(
    { queryKey: qk.feed.today() },
    (data) => {
      if (!data) return data;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === dailyStatusId ? update(item) : item,
          ),
        })),
      };
    },
  );

  queryClient.setQueryData<DailyStatusEntry>(qk.dailyStatus.detail(dailyStatusId), (status) =>
    status ? update(status) : status,
  );
}

export function useHeart() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ dailyStatusId, next }: { dailyStatusId: string; next: boolean }) =>
      next ? reactionsApi.sendHeart(dailyStatusId) : reactionsApi.removeHeart(dailyStatusId),

    onMutate: async ({ dailyStatusId, next }) => {
      const snapshot = queryClient.getQueryData<DailyStatusEntry>(
        qk.dailyStatus.detail(dailyStatusId),
      );

      patchCaches(queryClient, dailyStatusId, (status) => ({
        ...status,
        heartedByMe: next,
        heartCount: Math.max(0, status.heartCount + (next ? 1 : -1)),
      }));

      return { snapshot, dailyStatusId, next };
    },

    onError: (_error, variables, context) => {
      // Roll back to the pre-tap values.
      patchCaches(queryClient, variables.dailyStatusId, (status) => ({
        ...status,
        heartedByMe: !variables.next,
        heartCount: Math.max(0, status.heartCount + (variables.next ? -1 : 1)),
        ...(context?.snapshot
          ? {
              heartedByMe: context.snapshot.heartedByMe,
              heartCount: context.snapshot.heartCount,
            }
          : {}),
      }));
    },

    onSuccess: (response: HeartResponse, variables) => {
      // Trust the server count (other people are hearting concurrently).
      patchCaches(queryClient, variables.dailyStatusId, (status) => ({
        ...status,
        heartedByMe: response.heartedByMe,
        heartCount: response.heartCount,
      }));

      analytics.track(variables.next ? 'HEART_SENT' : 'HEART_REMOVED', {
        dailyStatusId: variables.dailyStatusId,
      });
    },
  });

  return {
    toggleHeart: (status: DailyStatusEntry) => {
      const next = !status.heartedByMe;
      if (next) haptics.heart();
      else haptics.tap();
      mutation.mutate({ dailyStatusId: status.id, next });
      return next;
    },
    isPending: mutation.isPending,
  };
}
