import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk, usersApi, type UpdateMeRequest } from '@/api';

import { useAuthStore } from '../auth/authStore';

export function usePublicProfile(userId: string) {
  return useQuery({
    queryKey: qk.users.profile(userId),
    queryFn: () => usersApi.profile(userId),
    staleTime: 60_000,
  });
}

export function useMe() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const query = useQuery({
    queryKey: qk.me.profile(),
    queryFn: async () => {
      const me = await usersApi.me();
      setUser(me);
      return me;
    },
    initialData: user ?? undefined,
    staleTime: 60_000,
  });

  return query;
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: (body: UpdateMeRequest) => usersApi.updateMe(body),
    onSuccess: async (me) => {
      setUser(me);
      queryClient.setQueryData(qk.me.profile(), me);
      await queryClient.invalidateQueries({ queryKey: qk.users.profile(me.id) });
    },
  });
}

/**
 * Debounced nickname availability check for the profile setup / edit screens.
 * Returning `idle` while the field is too short keeps the UI from flashing an
 * error at every keystroke.
 */
export function useNicknameAvailability(nickname: string, minLength: number) {
  const trimmed = nickname.trim();
  const enabled = trimmed.length >= minLength;

  const query = useQuery({
    queryKey: qk.users.nickname(trimmed),
    queryFn: () => usersApi.checkNickname(trimmed),
    enabled,
    staleTime: 30_000,
    retry: false,
  });

  if (!enabled) return { state: 'idle' as const };
  if (query.isPending) return { state: 'checking' as const };
  if (query.isError) return { state: 'idle' as const };
  return query.data?.available
    ? { state: 'available' as const }
    : { state: 'taken' as const, reason: query.data?.reason };
}
