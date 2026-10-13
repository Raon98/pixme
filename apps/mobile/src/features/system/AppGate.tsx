import { useEffect } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { copy } from '@/constants/copy';
import { spacing } from '@/theme';
import { EmptyState, Screen } from '@/ui';

import { resolveGate, useAppConfig } from './useAppConfig';

const STORE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/id6821331238',
  android: 'https://play.google.com/store/apps/details?id=com.pixme.app',
  default: 'https://pixme.mohae.xyz',
});

/**
 * The operational kill switch: maintenance mode and the minimum-version wall.
 *
 * <p>`useAppConfig` and `resolveGate` existed for a while but were never
 * called from anywhere, which meant shipping with no in-app mitigation for a
 * server incident — the levers were built and left unwired. This is the one
 * place that reads them.
 *
 * <p>Fails open on purpose. If the config request itself fails we render the
 * app: a flaky network must never look like a maintenance outage, and the
 * gate's whole job is to be deliberately switched on, not inferred.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const { data } = useAppConfig();
  const { gate, message } = resolveGate(data) as {
    gate: 'none' | 'maintenance' | 'update';
    message?: string;
  };

  // A takeover screen replaces AppShell, which is the only other place that
  // hides the splash — without this the notice renders underneath a native
  // splash that never goes away.
  const takingOver = gate !== 'none';
  useEffect(() => {
    if (takingOver) void SplashScreen.hideAsync();
  }, [takingOver]);

  if (gate === 'maintenance') {
    return (
      <Screen>
        <View style={styles.center}>
          <EmptyState
            glyph="🛠"
            title={copy.errors.serverMaintenance}
            body={message || undefined}
          />
        </View>
      </Screen>
    );
  }

  if (gate === 'update') {
    return (
      <Screen>
        <View style={styles.center}>
          <EmptyState
            glyph="✨"
            title={copy.errors.updateRequired}
            actionLabel={copy.common.confirm}
            onAction={() => void Linking.openURL(STORE_URL)}
          />
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
});
