import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { copy } from '@/constants/copy';
import { config } from '@/lib/config';
import { spacing } from '@/theme';
import {
  ConfirmDialog,
  Divider,
  Header,
  ListRow,
  Screen,
  SectionHeader,
  Text,
  useToast,
} from '@/ui';
import { useAuthStore } from '@/features/auth/authStore';
import { useMe } from '@/features/profile/useProfile';
import { usePurchase } from '@/features/store/usePurchase';
import { useThemePreference, type ThemePreference } from '@/theme';

const THEME_LABEL: Record<ThemePreference, string> = {
  light: '라이트',
  dark: '다크',
  system: '시스템 설정',
};

export default function SettingsRoute() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const me = useMe();
  const signOut = useAuthStore((state) => state.signOut);
  const { restore } = usePurchase();
  const { preference, setPreference } = useThemePreference();

  const [logoutPrompt, setLogoutPrompt] = useState(false);

  const onRestore = useCallback(async () => {
    const result = await restore();
    toast.show(
      result.status === 'restored'
        ? { message: copy.store.restored, tone: 'success' }
        : result.status === 'empty'
          ? copy.store.nothingToRestore
          : { message: copy.errors.generic, tone: 'error' },
    );
  }, [restore, toast]);

  const cycleTheme = useCallback(() => {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(preference) + 1) % order.length];
    if (next) setPreference(next);
  }, [preference, setPreference]);

  return (
    <>
      <Screen edges={['top']} scroll contentStyle={styles.content}>
        <Header title={copy.settings.title} />

        <SectionHeader title={copy.settings.account} />
        <ListRow
          title={copy.my.editProfile}
          icon="user"
          onPress={() => router.push('/profile-edit')}
        />
        <ListRow
          title={copy.settings.notifications}
          icon="bell"
          onPress={() => router.push('/settings/notifications')}
        />
        <ListRow
          title={copy.settings.blocked}
          icon="block"
          onPress={() => router.push('/settings/blocked')}
        />

        <SectionHeader title="개인정보" />
        <ListRow
          title={copy.settings.keepOriginal}
          subtitle={copy.settings.keepOriginalHint}
          icon="lock"
          onPress={() => router.push('/settings/privacy')}
        />

        <SectionHeader title="PIXME+" />
        <ListRow
          title={copy.settings.plus}
          icon="crown"
          value={
            me.data?.entitlements.plusActive ? '이용 중' : undefined
          }
          onPress={() => router.push('/store/plus')}
        />
        <ListRow
          title={copy.settings.restore}
          icon="store"
          onPress={() => void onRestore()}
          showChevron={false}
        />

        <SectionHeader title="약관" />
        <ListRow
          title={copy.settings.terms}
          icon="info"
          onPress={() => void Linking.openURL(config.links.terms)}
        />
        <ListRow
          title={copy.settings.privacy}
          icon="shield"
          onPress={() => void Linking.openURL(config.links.privacy)}
        />
        <ListRow
          title="문의하기"
          icon="chat"
          onPress={() => void Linking.openURL(config.links.support)}
        />

        <SectionHeader title="화면" />
        <ListRow
          title={copy.settings.theme}
          value={THEME_LABEL[preference]}
          onPress={cycleTheme}
          showChevron={false}
        />

        <Divider style={styles.divider} />

        <ListRow
          title={copy.settings.logout}
          icon="logout"
          onPress={() => setLogoutPrompt(true)}
          showChevron={false}
        />
        <ListRow
          title={copy.settings.deleteAccount}
          icon="trash"
          destructive
          onPress={() => router.push('/settings/delete-account')}
          showChevron={false}
        />

        <View style={styles.footer}>
          <Text variant="micro" tone="tertiary" align="center">
            {copy.settings.version} {config.appVersion} ({config.buildNumber})
          </Text>
          {!config.isProduction ? (
            <Text variant="micro" tone="tertiary" align="center">
              {config.variant}
            </Text>
          ) : null}
        </View>
      </Screen>

      <ConfirmDialog
        visible={logoutPrompt}
        title={copy.settings.logoutConfirm}
        confirmLabel={copy.settings.logout}
        onConfirm={() => {
          setLogoutPrompt(false);
          queryClient.clear();
          void signOut();
        }}
        onCancel={() => setLogoutPrompt(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  divider: { marginTop: spacing.xl },
  footer: { marginTop: spacing.xxl },
});
