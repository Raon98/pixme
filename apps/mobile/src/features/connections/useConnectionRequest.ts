import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  connectionsApi,
  qk,
  type Connection,
  type ConnectRequestResponse,
} from '@/api';
import { analytics } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';

/**
 * "👋 친해지고 싶어요".
 *
 * One-sided → REQUESTED (nothing is revealed to the sender beyond "sent").
 * Mutual    → CONNECTED, and the server creates the conversation atomically
 *             so neither side can race into a half-open chat.
 */
export function useConnectionRequest() {
  const queryClient = useQueryClient();

  return useMutation<ConnectRequestResponse, unknown, { userId: string }>({
    mutationFn: ({ userId }) => connectionsApi.request(userId),

    onSuccess: async (response, { userId }) => {
      analytics.track('CONNECTION_REQUEST_SENT', {
        targetUserId: userId,
        becameConnected: !!response.connection,
      });

      if (response.connection) {
        haptics.celebrate();
        analytics.track('CONNECTION_CREATED', {
          connectionId: response.connection.id,
        });
      } else {
        haptics.wave();
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.users.profile(userId) }),
        queryClient.invalidateQueries({ queryKey: qk.connections.list() }),
        queryClient.invalidateQueries({ queryKey: qk.feed.today() }),
        response.connection
          ? queryClient.invalidateQueries({ queryKey: qk.chat.conversations() })
          : Promise.resolve(),
      ]);
    },
  });
}

export function useAcknowledgeConnection() {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, Connection>({
    mutationFn: (connection) => connectionsApi.acknowledge(connection.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.connections.list() }),
  });
}
