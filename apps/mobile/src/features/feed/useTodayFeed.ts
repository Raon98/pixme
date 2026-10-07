import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { pixelsApi, qk, type Page, type PixelPost } from '@/api';
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
  return useInfiniteQuery<Page<PixelPost>, Error>({
    queryKey: qk.feed.today(),
    queryFn: ({ pageParam }) =>
      pixelsApi.todayFeed(
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
  data: { pages: Page<PixelPost>[] } | undefined,
): PixelPost[] {
  if (!data) return [];
  return data.pages.flatMap((page) => page.items);
}

/**
 * Whether the user still needs to make today's PIXME. Drives the create-tab
 * badge, the feed's "make yours" prompt and the daily reminder suppression.
 */
export function useTodayStatus() {
  return useQuery({
    queryKey: qk.feed.status(),
    queryFn: () => pixelsApi.todayStatus(),
    staleTime: 60_000,
  });
}
