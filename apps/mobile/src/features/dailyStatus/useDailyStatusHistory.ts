import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  dailyStatusApi,
  qk,
  type DailyStatusSummary,
  type Page,
} from '@/api';
import { config } from '@/lib/config';
import { formatMonthTitle } from '@/lib/format';

export function useMyHistory() {
  return useInfiniteQuery<Page<DailyStatusSummary>, Error>({
    queryKey: qk.dailyStatus.history(),
    queryFn: ({ pageParam }) =>
      dailyStatusApi.myHistory(
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
  items: DailyStatusSummary[];
}

/**
 * Groups history into months. The grid reads as a personal record ("내가 이런
 * 옷도 입었구나"), so month headers matter more than a flat infinite grid.
 */
export function groupByMonth(
  data: { pages: Page<DailyStatusSummary>[] } | undefined,
): HistorySection[] {
  if (!data) return [];

  const sections = new Map<string, HistorySection>();

  for (const page of data.pages) {
    for (const item of page.items) {
      const monthKey = item.statusDate.slice(0, 7);
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

export function useMyDailyStatusDetail(dailyStatusId: string) {
  return useQuery({
    queryKey: qk.dailyStatus.detail(dailyStatusId),
    queryFn: () => dailyStatusApi.detail(dailyStatusId),
    staleTime: 60_000,
  });
}

export function useUserHistory(userId: string) {
  return useInfiniteQuery<Page<DailyStatusSummary>, Error>({
    queryKey: qk.dailyStatus.byUser(userId),
    queryFn: ({ pageParam }) =>
      dailyStatusApi.userHistory(
        userId,
        pageParam as string | null,
        config.rules.historyPageSize,
      ),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
  });
}
