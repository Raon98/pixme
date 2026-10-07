import { del, post } from '../client';
import type { HeartResponse } from '../types';

export const reactionsApi = {
  /** Idempotent: hearting twice is a no-op, matching the "no double heart" rule. */
  sendHeart: (postId: string) =>
    post<HeartResponse>(`/pixels/${postId}/heart`),

  removeHeart: (postId: string) =>
    del<HeartResponse>(`/pixels/${postId}/heart`),
};
