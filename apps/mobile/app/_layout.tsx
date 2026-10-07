import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';

import { analytics } from '@/lib/analytics';
import { createQueryClient } from '@/lib/queryClient';
import { storage, StorageKey } from '@/lib/storage';
import { ThemeProvider, useTheme } from '@/theme';
import { ToastProvider } from '@/ui';
import { useAuthStore } from '@/features/auth/authStore';
import { useChatSocketBridge } from '@/features/chat/useChatSocket';
import {
  useAppIconBadge,
  usePushRegistration,
} from '@/features/notifications/useNotifications';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <AppShell />
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Owns session bootstrap, the auth routing guard and the app-wide side
 * effects (chat socket, push, badge). Keeping all of it in one component means
 * there is exactly one place that decides "which part of the app may the user
 * see right now".
 */
function AppShell() {
  const theme = useTheme();
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const sessionState = useAuthStore((state) => state.sessionState);

  useChatSocketBridge();
  usePushRegistration();
  useAppIconBadge();

  useEffect(() => {
    void (async () => {
      await analytics.bootstrap();
      await bootstrap();
      await SplashScreen.hideAsync();
    })();
  }, [bootstrap]);

  useAuthRedirect(sessionState);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="profile-setup" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />

        {/* Create flow — presented as a modal stack so the tabs stay behind it. */}
        <Stack.Screen
          name="create/index"
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
        <Stack.Screen name="create/preview" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="create/generating"
          options={{ presentation: 'modal', gestureEnabled: false }}
        />
        <Stack.Screen name="create/result" options={{ presentation: 'modal' }} />
        <Stack.Screen name="create/publish" options={{ presentation: 'modal' }} />

        <Stack.Screen
          name="connection-success"
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
        <Stack.Screen name="report" options={{ presentation: 'modal' }} />
        <Stack.Screen name="store/index" options={{ presentation: 'modal' }} />
        <Stack.Screen name="store/plus" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="store/success"
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
      </Stack>
    </View>
  );
}

/**
 * Single source of truth for auth-based navigation.
 *
 * Three gates, in order:
 *   not onboarded → /onboarding
 *   signed out    → /login
 *   profile       → /profile-setup   (nickname/birth/interests incomplete)
 *   otherwise     → the tabs
 */
function useAuthRedirect(sessionState: ReturnType<typeof useAuthStore.getState>['sessionState']) {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (sessionState === 'bootstrapping') return;

    const first = segments[0] as string | undefined;
    const inTabs = first === '(tabs)';
    const onAuthScreen =
      first === 'login' || first === 'onboarding' || first === undefined;
    const onProfileSetup = first === 'profile-setup';

    void (async () => {
      if (sessionState === 'signed-out') {
        const seenOnboarding = await storage.getItem<boolean>(
          StorageKey.OnboardingSeen,
        );
        if (!seenOnboarding) {
          if (first !== 'onboarding') router.replace('/onboarding');
          return;
        }
        if (first !== 'login') router.replace('/login');
        return;
      }

      if (sessionState === 'needs-profile') {
        if (!onProfileSetup) router.replace('/profile-setup');
        return;
      }

      // signed-in
      if (onAuthScreen || onProfileSetup) router.replace('/(tabs)');
      else if (!inTabs && first === undefined) router.replace('/(tabs)');
    })();
  }, [router, segments, sessionState]);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
