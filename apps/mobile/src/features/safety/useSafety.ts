import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk, safetyApi, usersApi, type CreateReportRequest } from '@/api';
import { analytics } from '@/lib/analytics';

/**
 * Blocking is the strongest user-level control in PIXME and is symmetric:
 * the server removes both directions from feeds, the square, recommendations,
 * profiles and chat. The client just has to make sure every cached surface is
 * re-fetched afterwards.
 */
export function useBlockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => usersApi.block(userId),
    onSuccess: async (_data, userId) => {
      analytics.track('USER_BLOCKED', { targetUserId: userId });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.feed.today() }),
        queryClient.invalidateQueries({ queryKey: qk.square.today() }),
        queryClient.invalidateQueries({ queryKey: qk.users.profile(userId) }),
        queryClient.invalidateQueries({ queryKey: qk.chat.conversations() }),
        queryClient.invalidateQueries({ queryKey: qk.connections.list() }),
        queryClient.invalidateQueries({ queryKey: qk.safety.blocked() }),
      ]);
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => usersApi.unblock(userId),
    onSuccess: async (_data, userId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.safety.blocked() }),
        queryClient.invalidateQueries({ queryKey: qk.users.profile(userId) }),
        queryClient.invalidateQueries({ queryKey: qk.feed.today() }),
      ]);
    },
  });
}

export function useBlockedUsers() {
  return useQuery({
    queryKey: qk.safety.blocked(),
    queryFn: () => usersApi.blockedUsers(),
    staleTime: 30_000,
  });
}

export function useReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateReportRequest) => safetyApi.report(body),
    onSuccess: async (_data, body) => {
      analytics.track('USER_REPORTED', {
        targetType: body.targetType,
        reason: body.reason,
        alsoBlock: body.alsoBlock,
      });
      if (body.alsoBlock) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: qk.feed.today() }),
          queryClient.invalidateQueries({ queryKey: qk.square.today() }),
          queryClient.invalidateQueries({ queryKey: qk.safety.blocked() }),
          queryClient.invalidateQueries({ queryKey: qk.chat.conversations() }),
        ]);
      }
    },
  });
}
