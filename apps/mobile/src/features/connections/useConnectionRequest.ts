import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  connectionsApi,
  qk,
  type Connection,
  type ConnectRequestResponse,
} from '@/api';
import { errorMessage, toApiError } from '@/api/errors';
import { analytics } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/ui';
import { useAuthStore } from '@/features/auth/authStore';

/**
 * "👋 친해지고 싶어요".
 *
 * One-sided → REQUESTED (nothing is revealed to the sender beyond "sent").
 * Mutual    → CONNECTED, and the server creates the conversation atomically
 *             so neither side can race into a half-open chat.
 *
 * <p>The daily wave quota (free 2 / PIXME+ 5 — the server's real scarcity
 * control) surfaces as `quotaDialogVisible` — render
 * `<ConnectionQuotaDialog visible={quotaDialogVisible} .../>` at the call
 * site. Every other error still goes to a toast; only this one gets a real
 * dialog, since the user asked to see the reset timing and a way to act, not
 * just a message that flashes and disappears.
 */
export function useConnectionRequest() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const plusActive = useAuthStore((state) => state.user?.entitlements.plusActive ?? false);
  const [quotaDialogVisible, setQuotaDialogVisible] = useState(false);

  const mutation = useMutation<
    ConnectRequestResponse,
    unknown,
    { userId: string; message?: string | null }
  >({
    mutationFn: ({ userId, message }) => connectionsApi.request(userId, message),

    onError: (error) => {
      const apiError = toApiError(error);
      if (apiError.code === 'DAILY_WAVE_LIMIT') {
        setQuotaDialogVisible(true);
        return;
      }
      toast.show(errorMessage(error));
    },

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

  return {
    ...mutation,
    quotaDialogVisible,
    quotaDialogPlusActive: plusActive,
    dismissQuotaDialog: () => setQuotaDialogVisible(false),
  };
}

export function useAcknowledgeConnection() {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, Connection>({
    mutationFn: (connection) => connectionsApi.acknowledge(connection.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.connections.list() }),
  });
}
