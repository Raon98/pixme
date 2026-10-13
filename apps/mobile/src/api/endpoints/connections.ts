import { del, get, post } from '../client';
import type { ConnectionListResponse, ConnectRequestResponse } from '../types';

export const connectionsApi = {
  /**
   * "👋 친해지고 싶어요". Mutual requests auto-create the conversation.
   *
   * `message` is an optional one-liner — invisible to the recipient unless
   * and until the wave becomes mutual, at which point it opens the chat.
   */
  request: (userId: string, message?: string | null) =>
    post<ConnectRequestResponse>(`/users/${userId}/connect`, undefined, {
      params: message ? { message } : undefined,
    }),

  cancel: (userId: string) =>
    del<ConnectRequestResponse>(`/users/${userId}/connect`),

  list: () => get<ConnectionListResponse>('/connections'),

  /** Marks the celebration screen as seen so it isn't shown twice. */
  acknowledge: (connectionId: string) =>
    post<void>(`/connections/${connectionId}/acknowledge`),
};
