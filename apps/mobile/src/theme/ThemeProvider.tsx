import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import { storage, StorageKey } from '@/lib/storage';

import { darkTheme, lightTheme, type Theme } from './themes';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  preference: 'system',
  setPreference: () => undefined,
});

/**
 * Light mode is the finished, shipped experience. Dark mode is fully wired
 * structurally (every component reads semantic colours) and selectable in
 * Settings, so enabling `system` later is a config change, not a refactor.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('light');

  useEffect(() => {
    void storage
      .getItem<ThemePreference>(StorageKey.ThemePreference)
      .then((stored) => {
        if (stored === 'system' || stored === 'light' || stored === 'dark') {
          setPreferenceState(stored);
        }
      });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void storage.setItem(StorageKey.ThemePreference, next);
  }, []);

  const theme = useMemo(() => {
    const resolved =
      preference === 'system' ? (systemScheme ?? 'light') : preference;
    return resolved === 'dark' ? darkTheme : lightTheme;
  }, [preference, systemScheme]);

  const value = useMemo(
    () => ({ theme, preference, setPreference }),
    [theme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemePreference() {
  const { preference, setPreference } = useContext(ThemeContext);
  return { preference, setPreference };
}

/**
 * Memoised themed stylesheet factory.
 *
 *   const styles = useThemedStyles(({ colors }) => ({
 *     root: { backgroundColor: colors.surface },
 *   }));
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
