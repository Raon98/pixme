import { get, post } from '../client';
import type {
  Conversation,
  Message,
  Page,
  SendMessageRequest,
} from '../types';

export const chatApi = {
  conversations: () => get<Conversation[]>('/conversations'),

  conversation: (conversationId: string) =>
    get<Conversation>(`/conversations/${conversationId}`),

  /** Newest-first, cursor-paginated (the UI renders inverted). */
  messages: (conversationId: string, cursor?: string | null, limit = 40) =>
    get<Page<Message>>(`/conversations/${conversationId}/messages`, {
      params: { cursor: cursor ?? undefined, limit },
    }),

  /**
   * REST send. The WebSocket is the fast path; this is the fallback when the
   * socket is down, and both are deduplicated server-side on
   * `clientMessageId`.
   */
  sendMessage: (conversationId: string, body: SendMessageRequest) =>
    post<Message>(`/conversations/${conversationId}/messages`, body),

  markRead: (conversationId: string, lastMessageId: string) =>
    post<void>(`/conversations/${conversationId}/read`, { lastMessageId }),
};
