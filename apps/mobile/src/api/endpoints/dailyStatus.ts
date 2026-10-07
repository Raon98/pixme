import { get, put } from '../client';
import type {
  DailyStatusEntry,
  DailyStatusSummary,
  Page,
  TodayStatusResponse,
  UpsertStatusRequest,
} from '../types';

export const dailyStatusApi = {
  /** The vertical "오늘" feed — active users' statuses, server-ranked. */
  todayFeed: (cursor?: string | null, limit = 10) =>
    get<Page<DailyStatusEntry>>('/daily-status/today', {
      params: { cursor: cursor ?? undefined, limit },
    }),

  /**
   * Today's own status plus everything the create/status screen needs —
   * free allowance, and whether the square's visibility explanation has been
   * shown yet.
   */
  myToday: () => get<TodayStatusResponse>('/daily-status/me'),

  /**
   * Upserts today's status — free, and independent of generating anything
   * new. Omit `pixelCharacterId` for a pure text edit, or send only it for a
   * free Current PIXME switch.
   */
  upsertMyToday: (body: UpsertStatusRequest) =>
    put<DailyStatusEntry>('/daily-status/me', body),

  /** Owner's own history, newest day first. */
  myHistory: (cursor?: string | null, limit = 30) =>
    get<Page<DailyStatusSummary>>('/daily-status/history', {
      params: { cursor: cursor ?? undefined, limit },
    }),

  detail: (dailyStatusId: string) =>
    get<DailyStatusEntry>(`/daily-status/${dailyStatusId}`),

  /** Another user's public history, for their profile grid. */
  userHistory: (userId: string, cursor?: string | null, limit = 30) =>
    get<Page<DailyStatusSummary>>(`/users/${userId}/pixels`, {
      params: { cursor: cursor ?? undefined, limit },
    }),
};
