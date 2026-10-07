import { del, post } from '../client';
import type { HeartResponse } from '../types';

export const reactionsApi = {
  /** Idempotent: hearting twice is a no-op, matching the "no double heart" rule. */
  sendHeart: (dailyStatusId: string) =>
    post<HeartResponse>(`/daily-status/${dailyStatusId}/heart`),

  removeHeart: (dailyStatusId: string) =>
    del<HeartResponse>(`/daily-status/${dailyStatusId}/heart`),
};
