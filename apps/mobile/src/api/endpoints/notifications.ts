import { get, post } from '../client';
import type { AppNotification, NotificationBadge, Page } from '../types';

export const notificationsApi = {
  list: (cursor?: string | null, limit = 30) =>
    get<Page<AppNotification>>('/notifications', {
      params: { cursor: cursor ?? undefined, limit },
    }),

  badge: () => get<NotificationBadge>('/notifications/badge'),

  markRead: (notificationId: string) =>
    post<void>(`/notifications/${notificationId}/read`),

  markAllRead: () => post<void>('/notifications/read-all'),
};
