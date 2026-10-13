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
  const refreshSession = useAuthStore((state) => state.refreshSession);

  return useMutation({
    mutationFn: (body: UpdateMeRequest) => usersApi.updateMe(body),
    onSuccess: async (me) => {
      // The PATCH that finishes setup promotes the account server-side, but the
      // access token still carries the old PENDING_PROFILE claim — without a
      // re-issue every other endpoint keeps answering 403.
      // Ordered deliberately: setUser flips the session to signed-in, which
      // routes straight into the tabs, so the new token has to be in place
      // before that happens or the first screen loads against a 403.
      const wasPending =
        useAuthStore.getState().sessionState === 'needs-profile';
      if (wasPending && me.profileCompleted) {
        await refreshSession();
      }
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
  // A failed check must not block sign-up: mapping it to 'idle' left the
  // "다음" button permanently disabled with nothing on screen explaining why,
  // so a new user could get stuck on step 1 forever. Surfaced as its own
  // state so the screen can say so and still let them continue — the server
  // rejects a genuine duplicate on submit anyway.
  if (query.isError) return { state: 'unknown' as const };
  if (query.data?.available) return { state: 'available' as const };
  // FORBIDDEN (a blocked term, an impersonation handle) is not the same
  // situation as TAKEN — the two used to collapse into one 'taken' state,
  // so a blocked nickname showed "이미 사용 중" even though no one has it.
  // Only a real collision gets a next-best suggestion; there is no
  // "try a variant" for a word that is blocked outright.
  if (query.data?.reason === 'FORBIDDEN') return { state: 'forbidden' as const };
  return {
    state: 'taken' as const,
    suggestion: query.data?.suggestion ?? undefined,
  };
}
