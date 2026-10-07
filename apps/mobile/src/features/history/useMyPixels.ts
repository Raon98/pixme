import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  pixelsApi,
  qk,
  type MyPixelPost,
  type Page,
  type PixelPostSummary,
} from '@/api';
import { config } from '@/lib/config';
import { formatMonthTitle } from '@/lib/format';

export function useMyPixels() {
  return useInfiniteQuery<Page<MyPixelPost>, Error>({
    queryKey: qk.pixels.mine(),
    queryFn: ({ pageParam }) =>
      pixelsApi.myPixels(
        pageParam as string | null,
        config.rules.historyPageSize,
      ),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
  });
}

export interface HistorySection {
  title: string;
  monthKey: string;
  items: MyPixelPost[];
}

/**
 * Groups history into months. The grid reads as a personal record ("내가 이런
 * 옷도 입었구나"), so month headers matter more than a flat infinite grid.
 */
export function groupByMonth(
  data: { pages: Page<MyPixelPost>[] } | undefined,
): HistorySection[] {
  if (!data) return [];

  const sections = new Map<string, HistorySection>();

  for (const page of data.pages) {
    for (const item of page.items) {
      const monthKey = item.postDate.slice(0, 7);
      const existing = sections.get(monthKey);
      if (existing) {
        existing.items.push(item);
      } else {
        sections.set(monthKey, {
          monthKey,
          title: formatMonthTitle(`${monthKey}-01`),
          items: [item],
        });
      }
    }
  }

  return [...sections.values()].sort((a, b) =>
    b.monthKey.localeCompare(a.monthKey),
  );
}

export function useMyPixelDetail(postId: string) {
  return useQuery({
    queryKey: qk.pixels.detail(postId),
    queryFn: () => pixelsApi.myDetail(postId),
    staleTime: 60_000,
  });
}

export function useUserPixels(userId: string) {
  return useInfiniteQuery<Page<PixelPostSummary>, Error>({
    queryKey: qk.pixels.byUser(userId),
    queryFn: ({ pageParam }) =>
      pixelsApi.userPixels(
        userId,
        pageParam as string | null,
        config.rules.historyPageSize,
      ),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
  });
}
