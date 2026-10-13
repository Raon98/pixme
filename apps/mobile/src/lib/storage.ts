import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Two-tier persistence.
 *
 *  - `secureStorage` → Keychain / Keystore. Auth tokens only.
 *  - `storage`       → AsyncStorage. Preferences and non-sensitive caches.
 *
 * Both are JSON-typed and never throw: a storage failure should degrade the
 * session, not crash the app.
 */

export const StorageKey = {
  AccessToken: 'pixme.auth.accessToken',
  RefreshToken: 'pixme.auth.refreshToken',
  OnboardingSeen: 'pixme.onboarding.seen',
  ThemePreference: 'pixme.theme.preference',
  PushTokenSynced: 'pixme.push.tokenSynced',
  LastFeedCursor: 'pixme.feed.lastCursor',
  SeenConnectionIds: 'pixme.connection.seenIds',
  KeepOriginalPhoto: 'pixme.privacy.keepOriginalPhoto',
  LastGenerationDraft: 'pixme.generation.draft',
  AnalyticsAnonymousId: 'pixme.analytics.anonymousId',
  /** iOS gives exactly one shot at the OS prompt, so only ever ask once. */
  PushPromptSeen: 'pixme.push.promptSeen',
} as const;

export type StorageKeyValue = (typeof StorageKey)[keyof typeof StorageKey];

function safeParse<T>(raw: string | null): T | null {
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const storage = {
  async getItem<T>(key: StorageKeyValue): Promise<T | null> {
    try {
      return safeParse<T>(await AsyncStorage.getItem(key));
    } catch {
      return null;
    }
  },
  async setItem<T>(key: StorageKeyValue, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* non-fatal */
    }
  },
  async removeItem(key: StorageKeyValue): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      /* non-fatal */
    }
  },
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(StorageKey));
    } catch {
      /* non-fatal */
    }
  },
};

export const secureStorage = {
  async get(key: StorageKeyValue): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: StorageKeyValue, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch {
      /* non-fatal */
    }
  },
  async remove(key: StorageKeyValue): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* non-fatal */
    }
  },
};
