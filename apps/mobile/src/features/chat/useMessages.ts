import { useCallback } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { chatApi, qk, type Message, type Page } from '@/api';
import { analytics } from '@/lib/analytics';
import { config } from '@/lib/config';

import { useAuthStore } from '../auth/authStore';
import { chatSocket } from './socket';

type MessagePages = { pages: Page<Message>[]; pageParams: unknown[] };

export function useMessages(conversationId: string) {
  return useInfiniteQuery<Page<Message>, Error>({
    queryKey: qk.chat.messages(conversationId),
    queryFn: ({ pageParam }) =>
      chatApi.messages(
        conversationId,
        pageParam as string | null,
        config.rules.chatPageSize,
      ),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 10_000,
  });
}

export function flattenMessages(
  data: { pages: Page<Message>[] } | undefined,
): Message[] {
  if (!data) return [];
  return data.pages.flatMap((page) => page.items);
}

/**
 * Sends a message.
 *
 * Optimistic by design: a chat that waits for a round-trip feels broken. The
 * socket is tried first; if it is down the REST call is used, and both paths
 * are deduplicated server-side on `clientMessageId`, so a reconnect mid-send
 * can never duplicate a bubble.
 */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const myId = useAuthStore((state) => state.user?.id ?? null);

  const mutation = useMutation<
    Message,
    unknown,
    { content: string; clientMessageId: string },
    { clientMessageId: string }
  >({
    mutationFn: ({ content, clientMessageId }) =>
      chatApi.sendMessage(conversationId, {
        clientMessageId,
        type: 'TEXT',
        content,
      }),

    onMutate: ({ content, clientMessageId }) => {
      const optimistic: Message = {
        id: clientMessageId,
        conversationId,
        senderId: myId,
        type: 'TEXT',
        content,
        createdAt: new Date().toISOString(),
        readAt: null,
      };

      queryClient.setQueryData<MessagePages>(
        qk.chat.messages(conversationId),
        (data) => {
          if (!data || data.pages.length === 0) {
            return {
              pages: [{ items: [optimistic], nextCursor: null, hasMore: false }],
              pageParams: [null],
            };
          }
          const [first, ...rest] = data.pages;
          if (!first) return data;
          return {
            ...data,
            pages: [{ ...first, items: [optimistic, ...first.items] }, ...rest],
          };
        },
      );

      return { clientMessageId };
    },

    onSuccess: (message, _variables, context) => {
      // Replace the optimistic bubble with the server's canonical message.
      queryClient.setQueryData<MessagePages>(
        qk.chat.messages(conversationId),
        (data) => {
          if (!data) return data;
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items
                .filter(
                  (item) =>
                    item.id !== message.id ||
                    item.id === context?.clientMessageId,
                )
                .map((item) =>
                  item.id === context?.clientMessageId ? message : item,
                ),
            })),
          };
        },
      );
      analytics.track('MESSAGE_SENT', { conversationId });
      void queryClient.invalidateQueries({ queryKey: qk.chat.conversations() });
    },

    onError: (_error, _variables, context) => {
      // Drop the optimistic bubble; the composer keeps the text so the user
      // can retry without retyping.
      queryClient.setQueryData<MessagePages>(
        qk.chat.messages(conversationId),
        (data) => {
          if (!data) return data;
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.filter(
                (item) => item.id !== context?.clientMessageId,
              ),
            })),
          };
        },
      );
    },
  });

  /**
   * @param onFailed called with the original text when the send did not land,
   *     so the screen can put it back in the composer. Without this the
   *     message disappears completely on failure — the optimistic bubble is
   *     removed here and the composer was already cleared by the caller.
   */
  const send = useCallback(
    (content: string, onFailed?: (content: string) => void) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const clientMessageId = Crypto.randomUUID();
      const deliveredOverSocket = chatSocket.send({
        type: 'SEND',
        payload: { conversationId, clientMessageId, content: trimmed },
      });

      if (deliveredOverSocket) {
        // Render optimistically; the ACK frame will reconcile the real id.
        mutation.mutate(
          { content: trimmed, clientMessageId },
          { onSuccess: () => undefined, onError: () => onFailed?.(trimmed) },
        );
        return;
      }

      mutation.mutate(
        { content: trimmed, clientMessageId },
        { onError: () => onFailed?.(trimmed) },
      );
    },
    [conversationId, mutation],
  );

  return { send, isPending: mutation.isPending, error: mutation.error };
}

export function useMarkConversationRead(conversationId: string) {
  const queryClient = useQueryClient();

  return useCallback(
    (lastMessageId: string | undefined) => {
      if (!lastMessageId) return;
      chatSocket.send({
        type: 'READ',
        payload: { conversationId, lastMessageId },
      });
      void chatApi.markRead(conversationId, lastMessageId).then(() => {
        void queryClient.invalidateQueries({
          queryKey: qk.chat.conversations(),
        });
        void queryClient.invalidateQueries({
          queryKey: qk.notifications.badge(),
        });
      });
    },
    [conversationId, queryClient],
  );
}
