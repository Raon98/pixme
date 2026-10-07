import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { qk, type Conversation, type Message, type Page } from '@/api';

import { useAuthStore } from '../auth/authStore';
import { chatSocket, type ServerFrame, type SocketStatus } from './socket';

/**
 * Keeps the shared socket alive for the signed-in session and funnels incoming
 * frames into the React Query cache. Mounted once, at the app root, so
 * messages land in the cache (and the tab badge) regardless of which screen
 * the user is on.
 */
export function useChatSocketBridge() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const sessionState = useAuthStore((state) => state.sessionState);

  useEffect(() => {
    if (sessionState !== 'signed-in' || !accessToken) {
      chatSocket.disconnect();
      return;
    }

    chatSocket.connect(accessToken);

    const unsubscribe = chatSocket.subscribe((frame: ServerFrame) => {
      switch (frame.type) {
        case 'MESSAGE':
        case 'ACK': {
          const message =
            frame.type === 'ACK' ? frame.payload.message : frame.payload;
          appendMessage(queryClient, message);
          void queryClient.invalidateQueries({
            queryKey: qk.chat.conversations(),
          });
          void queryClient.invalidateQueries({
            queryKey: qk.notifications.badge(),
          });
          break;
        }
        case 'READ': {
          markRead(queryClient, frame.payload.conversationId, frame.payload.readAt);
          break;
        }
        case 'CONVERSATION_UPDATED': {
          queryClient.setQueryData<Conversation[]>(
            qk.chat.conversations(),
            (conversations) =>
              conversations?.map((conversation) =>
                conversation.id === frame.payload.conversationId
                  ? { ...conversation, inactive: frame.payload.inactive }
                  : conversation,
              ),
          );
          break;
        }
        case 'ERROR':
        case 'PONG':
          break;
      }
    });

    // Reconnect promptly when the user comes back rather than waiting for the
    // next backoff tick.
    const appStateSubscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active' && accessToken) chatSocket.connect(accessToken);
      },
    );

    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [accessToken, queryClient, sessionState]);

  useEffect(() => () => chatSocket.disconnect(), []);
}

export function useSocketStatus(): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>(chatSocket.getStatus());
  useEffect(() => chatSocket.onStatus(setStatus), []);
  return status;
}

type MessagePages = { pages: Page<Message>[]; pageParams: unknown[] };

/** Inserts (or replaces, by id) a message in the newest page. */
function appendMessage(
  queryClient: ReturnType<typeof useQueryClient>,
  message: Message,
) {
  queryClient.setQueryData<MessagePages>(
    qk.chat.messages(message.conversationId),
    (data) => {
      if (!data || data.pages.length === 0) return data;
      const [first, ...rest] = data.pages;
      if (!first) return data;
      if (first.items.some((item) => item.id === message.id)) return data;

      return {
        ...data,
        pages: [{ ...first, items: [message, ...first.items] }, ...rest],
      };
    },
  );
}

function markRead(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  readAt: string,
) {
  queryClient.setQueryData<MessagePages>(
    qk.chat.messages(conversationId),
    (data) => {
      if (!data) return data;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.readAt ? item : { ...item, readAt },
          ),
        })),
      };
    },
  );
}
