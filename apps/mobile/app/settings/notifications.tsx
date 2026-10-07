import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import type { UserSettings } from '@/api';
import { copy } from '@/constants/copy';
import { getPushPermissionStatus } from '@/lib/push';
import { spacing, useTheme } from '@/theme';
import {
  Button,
  Header,
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
  | 'pushHeart'
  | 'pushConnectionRequest'
  | 'pushConnected'
  | 'pushMessage'
  | 'pushDailyReminder'
>;

const ROWS: { key: PushKey; title: string; subtitle: string }[] = [
  {
    key: 'pushHeart',
    title: '♡ 하트',
    subtitle: '누군가 내 PIXME에 하트를 보냈을 때',
  },
  {
    key: 'pushConnectionRequest',
    title: '👋 친해지고 싶어요',
    subtitle: '누군가 나와 친해지고 싶다고 했을 때',
  },
  {
    key: 'pushConnected',
    title: '✨ 서로 연결됨',
    subtitle: '서로 마음이 통해 연결됐을 때',
  },
  {
    key: 'pushMessage',
    title: '💬 새로운 메시지',
    subtitle: '연결된 사람이 메시지를 보냈을 때',
  },
  {
    key: 'pushDailyReminder',
    title: '오늘의 PIXME 알림',
    subtitle: '하루에 한 번, 아직 오늘을 남기지 않았을 때만',
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
            기기 설정에서 PIXME 알림이 꺼져 있어요. 아래 설정은 알림을 켠 뒤에
            적용돼요.
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

      <SectionHeader title="알림 종류" />

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
        PIXME는 알림을 아껴서 보내요. 하트는 묶어서, 오늘의 알림은 하루에 한 번만
        보내고, 이미 오늘의 PIXME를 남겼다면 보내지 않아요.
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
