import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';

import { usersApi } from '@/api';
import { analytics } from '@/lib/analytics';

import { useAuthStore } from '../auth/authStore';

/**
 * Account deletion.
 *
 * The server performs the real work (immediate removal from every public
 * surface, then a hard purge of profile, posts, originals, connections and
 * messages on the retention timer). The client's job is to make the local
 * session disappear completely so no cached PIXME survives the tap.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);

  return useMutation({
    mutationFn: (reason?: string) => usersApi.deleteAccount(reason),
    onSuccess: async () => {
      analytics.track('ACCOUNT_DELETED');
      queryClient.clear();
      await clearSession();
    },
  });
}
