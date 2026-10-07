import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { dailyStatusApi, qk, type DailyStatusEntry, type Page } from '@/api';
import { config } from '@/lib/config';

/**
 * The vertical "오늘" feed.
 *
 * Ranking is entirely server-side (recency, interest overlap, exposure caps,
 * new-user boost, block/report filtering) — the client only pages through the
 * cursor it is given. That keeps a single ranking implementation and means we
 * can tune discovery without an app release.
 */
export function useTodayFeed() {
  return useInfiniteQuery<Page<DailyStatusEntry>, Error>({
    queryKey: qk.feed.today(),
    queryFn: ({ pageParam }) =>
      dailyStatusApi.todayFeed(
        pageParam as string | null,
        config.rules.feedPageSize,
      ),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // The feed is "today's" content: refetching on every focus would shuffle
    // cards under the user's thumb, so we keep it stable for a few minutes.
    staleTime: 3 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Flattens pages for the virtualized list. */
export function flattenFeed(
  data: { pages: Page<DailyStatusEntry>[] } | undefined,
): DailyStatusEntry[] {
  if (!data) return [];
  return data.pages.flatMap((page) => page.items);
}

/**
 * Today's own status plus the free generation allowance. Drives the create-tab
 * badge, the feed's "오늘 상태 남기기" prompt and the daily reminder suppression.
 */
export function useTodayStatus() {
  return useQuery({
    queryKey: qk.feed.status(),
    queryFn: () => dailyStatusApi.myToday(),
    staleTime: 60_000,
  });
}
