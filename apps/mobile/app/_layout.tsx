import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import { analytics } from '@/lib/analytics';
import { config } from '@/lib/config';
import { createQueryClient, setMutationErrorReporter } from '@/lib/queryClient';
import { storage, StorageKey } from '@/lib/storage';
import { ThemeProvider, useTheme } from '@/theme';
import { ToastProvider, useToast } from '@/ui';
import { AppGate } from '@/features/system/AppGate';
import { useAuthStore } from '@/features/auth/authStore';
import { useChatSocketBridge } from '@/features/chat/useChatSocket';
import {
  useAppIconBadge,
  usePushRegistration,
} from '@/features/notifications/useNotifications';

void SplashScreen.preventAutoHideAsync();

/**
 * Crash reporting.
 *
 * <p>Guarded on the DSN rather than on a build flag: without one configured
 * this is inert, so a development build never ships noise to the project and
 * a misconfigured production build fails loudly at review time instead of
 * silently reporting nothing.
 *
 * <p>`sendDefaultPii` stays off. A crash report from this app would otherwise
 * be able to carry the user's email and IP, and the privacy declaration does
 * not cover shipping those to a third party for diagnostics.
 */
if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    sendDefaultPii: false,
    // Traces are a cost multiplier and nothing here is latency-sensitive
    // enough to justify them at launch; crashes are the point.
    tracesSampleRate: 0,
  });
}

function RootLayout() {
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <AppGate>
                <AppShell />
              </AppGate>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Wrapped so a render error anywhere in the tree is captured rather than
 * surfacing only as a blank screen the user reports by hand.
 */
export default Sentry.wrap(RootLayout);

/**
 * Owns session bootstrap, the auth routing guard and the app-wide side
 * effects (chat socket, push, badge). Keeping all of it in one component means
 * there is exactly one place that decides "which part of the app may the user
 * see right now".
 */
function AppShell() {
  const theme = useTheme();
  const toast = useToast();
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const sessionState = useAuthStore((state) => state.sessionState);

  // Gives every mutation without its own error handling a visible failure.
  useEffect(() => {
    setMutationErrorReporter((message) => toast.show({ message, tone: 'error' }));
  }, [toast]);

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

        {/*
          Create flow — presented as a modal stack so the tabs stay behind it.
          `transparentModal` only actually shows the previous screen behind it
          when the route's own background is explicitly transparent — React
          Navigation's native-stack otherwise paints the default (opaque)
          screen background over whatever was there, which on web reads as
          "the background disappears" rather than "a sheet opened over it".
        */}
        <Stack.Screen
          name="create/index"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
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
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="report" options={{ presentation: 'modal' }} />
        <Stack.Screen name="store/index" options={{ presentation: 'modal' }} />
        <Stack.Screen name="store/plus" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="store/success"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
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
 *   just set up   → /create          (first run, straight into making one)
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
      if (onProfileSetup) {
        // Reaching signed-in from profile-setup means first-run setup just
        // finished, so go make the first PIXME instead of landing on an empty
        // MY tab. The tabs go underneath first, since /create closes with back.
        router.replace('/(tabs)');
        router.push('/create');
        return;
      }
      if (onAuthScreen) router.replace('/(tabs)');
      else if (!inTabs && first === undefined) router.replace('/(tabs)');
    })();
  }, [router, segments, sessionState]);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
