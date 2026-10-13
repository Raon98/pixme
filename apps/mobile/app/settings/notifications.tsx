import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import type { UserSettings } from '@/api';
import { copy } from '@/constants/copy';
import { getPushPermissionStatus } from '@/lib/push';
import { spacing, useTheme } from '@/theme';
import {
  Button,
  ErrorState,
  Header,
  ListSkeleton,
  ListRow,
  Screen,
  SectionHeader,
  Text,
  Toggle,
  useToast,
} from '@/ui';
import { useMe, useUpdateMe } from '@/features/profile/useProfile';

type PushKey = Extract<
  keyof UserSettings,
  'pushHeart' | 'pushConnected' | 'pushMessage' | 'pushDailyReminder'
>;

// There is deliberately no row here for "someone waved at you" — PIXME never
// sends that notification, not even anonymously (see `ConnectionNotifier` on
// the server). A toggle for a push that can never fire would just be a
// confusing dead switch.
const ROWS: { key: PushKey; title: string; subtitle: string }[] = [
  {
    key: 'pushHeart',
    title: copy.settings.pushHeart,
    subtitle: copy.settings.pushHeartHint,
  },
  {
    key: 'pushConnected',
    title: copy.settings.pushConnected,
    subtitle: copy.settings.pushConnectedHint,
  },
  {
    key: 'pushMessage',
    title: copy.settings.pushMessage,
    subtitle: copy.settings.pushMessageHint,
  },
  {
    key: 'pushDailyReminder',
    title: copy.settings.pushDaily,
    subtitle: copy.settings.pushDailyHint,
  },
];

/**
 * Per-type push settings.
 *
 * Every type is individually switchable, and the daily reminder is explicitly
 * described as at most once a day and suppressed once the user has already
 * published — the app should never feel like it is nagging.
 */
export default function NotificationSettingsRoute() {
  const toast = useToast();
  const { colors } = useTheme();

  const me = useMe();
  const updateMe = useUpdateMe();

  const [permission, setPermission] = useState<
    'granted' | 'denied' | 'undetermined'
  >('undetermined');

  useEffect(() => {
    void getPushPermissionStatus().then(setPermission);
  }, []);

  const settings = me.data?.settings;

  const onToggle = useCallback(
    (key: PushKey, next: boolean) => {
      if (!settings) return;
      updateMe.mutate(
        { settings: { [key]: next } },
        {
          onError: () =>
            toast.show({ message: copy.errors.generic, tone: 'error' }),
        },
      );
    },
    [settings, toast, updateMe],
  );

  // A switch bound to server state must not render before that state
  // arrives: while loading it would show a default that can be the opposite
  // of the truth, and a tap would then write the wrong value. On error it
  // would read as "everything is off" rather than "we couldn't load this".
  if (me.isPending && !me.data) {
    return (
      <Screen edges={['top']}>
        <Header title={copy.settings.notifications} />
        <ListSkeleton />
      </Screen>
    );
  }

  if (me.isError && !me.data) {
    return (
      <Screen edges={['top']}>
        <Header title={copy.settings.notifications} />
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll>
      <Header title={copy.settings.notifications} />

      {permission === 'denied' ? (
        <View
          style={[
            styles.banner,
            { backgroundColor: colors.dangerSubtle, borderColor: colors.danger },
          ]}
        >
          <Text variant="caption">
            {copy.settings.pushDeniedBanner}
          </Text>
          <Button
            label={copy.create.openSettings}
            variant="outline"
            size="sm"
            fullWidth={false}
            onPress={() => void Linking.openSettings()}
            style={styles.bannerButton}
          />
        </View>
      ) : null}

      <SectionHeader title={copy.settings.pushTypesSection} />

      {ROWS.map((row) => (
        <ListRow
          key={row.key}
          title={row.title}
          subtitle={row.subtitle}
          showChevron={false}
          right={
            <Toggle
              label={row.title}
              value={settings ? settings[row.key] : false}
              disabled={!settings || updateMe.isPending}
              onChange={(next) => onToggle(row.key, next)}
            />
          }
        />
      ))}

      <Text variant="micro" tone="tertiary" style={styles.note}>
        {copy.settings.pushNote}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginTop: spacing.base,
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerButton: { marginTop: spacing.md },
  note: { marginTop: spacing.xl, marginBottom: spacing.xxl },
});
