import { del, get, post } from '../client';
import type { ConnectionListResponse, ConnectRequestResponse } from '../types';

export const connectionsApi = {
  /** "👋 친해지고 싶어요". Mutual requests auto-create the conversation. */
  request: (userId: string) =>
    post<ConnectRequestResponse>(`/users/${userId}/connect`),

  cancel: (userId: string) =>
    del<ConnectRequestResponse>(`/users/${userId}/connect`),

  list: () => get<ConnectionListResponse>('/connections'),

  /** Marks the celebration screen as seen so it isn't shown twice. */
  acknowledge: (connectionId: string) =>
    post<void>(`/connections/${connectionId}/acknowledge`),
};
