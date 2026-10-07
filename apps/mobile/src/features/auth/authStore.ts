import { create } from 'zustand';

import {
  authApi,
  configureAuthBridge,
  usersApi,
  type AuthResponse,
  type AuthTokens,
  type MeResponse,
} from '@/api';
import { analytics } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { secureStorage, storage, StorageKey } from '@/lib/storage';

const log = logger('auth');

export type SessionState =
  | 'bootstrapping'
  | 'signed-out'
  /** Signed in but nickname/birthDate/interests not finished yet. */
  | 'needs-profile'
  | 'signed-in';

interface AuthState {
  sessionState: SessionState;
  accessToken: string | null;
  refreshToken: string | null;
  user: MeResponse | null;

  /** Restores a persisted session on cold start. */
  bootstrap: () => Promise<void>;
  /** Applies a successful sign-in response. */
  applyAuthResponse: (response: AuthResponse) => Promise<void>;
  /** Re-fetches `/users/me` (after profile edits, purchases, etc.). */
  refreshUser: () => Promise<MeResponse | null>;
  setUser: (user: MeResponse) => void;
  signOut: (options?: { revokeRemote?: boolean }) => Promise<void>;
  /** Local-only teardown used when the refresh token is rejected. */
  clearSession: () => Promise<void>;
}

function resolveSessionState(user: MeResponse | null): SessionState {
  if (!user) return 'signed-out';
  if (user.status === 'DELETED') return 'signed-out';
  return user.profileCompleted ? 'signed-in' : 'needs-profile';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  sessionState: 'bootstrapping',
  accessToken: null,
  refreshToken: null,
  user: null,

  async bootstrap() {
    const [accessToken, refreshToken] = await Promise.all([
      secureStorage.get(StorageKey.AccessToken),
      secureStorage.get(StorageKey.RefreshToken),
    ]);

    if (!accessToken || !refreshToken) {
      set({ sessionState: 'signed-out' });
      return;
    }

    set({ accessToken, refreshToken });

    try {
      const user = await usersApi.me();
      analytics.identify(user.id);
      set({ user, sessionState: resolveSessionState(user) });
    } catch (error) {
      // The interceptor already attempted a refresh; reaching here means the
      // session is genuinely gone.
      log.info('session restore failed', error);
      await get().clearSession();
    }
  },

  async applyAuthResponse(response) {
    await Promise.all([
      secureStorage.set(StorageKey.AccessToken, response.tokens.accessToken),
      secureStorage.set(StorageKey.RefreshToken, response.tokens.refreshToken),
    ]);

    analytics.identify(response.user.id);
    analytics.track(
      response.isNewUser ? 'SIGN_UP' : 'SIGN_IN',
      { provider: response.user.provider },
    );

    set({
      accessToken: response.tokens.accessToken,
      refreshToken: response.tokens.refreshToken,
      user: response.user,
      sessionState: resolveSessionState(response.user),
    });
  },

  async refreshUser() {
    if (!get().accessToken) return null;
    try {
      const user = await usersApi.me();
      set({ user, sessionState: resolveSessionState(user) });
      return user;
    } catch (error) {
      log.warn('refreshUser failed', error);
      return null;
    }
  },

  setUser(user) {
    set({ user, sessionState: resolveSessionState(user) });
  },

  async signOut({ revokeRemote = true } = {}) {
    const refreshToken = get().refreshToken;
    if (revokeRemote && refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Signing out locally must succeed even if the server call doesn't.
      }
    }
    await get().clearSession();
  },

  async clearSession() {
    await Promise.all([
      secureStorage.remove(StorageKey.AccessToken),
      secureStorage.remove(StorageKey.RefreshToken),
      storage.removeItem(StorageKey.PushTokenSynced),
      storage.removeItem(StorageKey.LastGenerationDraft),
    ]);
    analytics.identify(null);
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      sessionState: 'signed-out',
    });
  },
}));

/* --------------------------------------------------------------- selectors */

export const selectUser = (state: AuthState) => state.user;
export const selectEntitlements = (state: AuthState) =>
  state.user?.entitlements ?? null;
export const selectMyId = (state: AuthState) => state.user?.id ?? null;

/**
 * Wires the HTTP layer to this store exactly once, at module load. Keeping it
 * here (rather than in `client.ts`) avoids a circular import and keeps the
 * token lifecycle in one file.
 */
configureAuthBridge({
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  onTokensRefreshed: async (tokens: AuthTokens) => {
    await Promise.all([
      secureStorage.set(StorageKey.AccessToken, tokens.accessToken),
      secureStorage.set(StorageKey.RefreshToken, tokens.refreshToken),
    ]);
    useAuthStore.setState({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  },
  onSessionExpired: async () => {
    await useAuthStore.getState().clearSession();
  },
});
