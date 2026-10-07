import { useCallback } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { copy } from '@/constants/copy';
import { config } from '@/lib/config';
import { radius, spacing, useTheme } from '@/theme';
import {
  Header,
  ListRow,
  Screen,
  SectionHeader,
  Text,
  Toggle,
  useToast,
} from '@/ui';
import { useMe, useUpdateMe } from '@/features/profile/useProfile';

/**
 * Privacy controls.
 *
 * The original photo is the most sensitive thing PIXME ever holds, so the user
 * gets a direct switch for it. With "원본 사진 보관" off, the server deletes
 * the original as soon as the character is generated — the character and the
 * record survive, the photo does not.
 */
export default function PrivacySettingsRoute() {
  const toast = useToast();
  const { colors } = useTheme();

  const me = useMe();
  const updateMe = useUpdateMe();

  const keepOriginal = me.data?.settings.keepOriginalPhoto ?? true;

  const onToggle = useCallback(
    (next: boolean) => {
      updateMe.mutate(
        { settings: { keepOriginalPhoto: next } },
        {
          onSuccess: () =>
            toast.show({
              message: next
                ? '원본 사진을 보관해요.'
                : '앞으로 원본 사진은 생성 직후 삭제돼요.',
              tone: 'success',
            }),
          onError: () =>
            toast.show({ message: copy.errors.generic, tone: 'error' }),
        },
      );
    },
    [toast, updateMe],
  );

  return (
    <Screen edges={['top']} scroll>
      <Header title="개인정보" />

      <SectionHeader title="사진" />
      <ListRow
        title={copy.settings.keepOriginal}
        subtitle={copy.settings.keepOriginalHint}
        showChevron={false}
        right={
          <Toggle
            label={copy.settings.keepOriginal}
            value={keepOriginal}
            disabled={!me.data || updateMe.isPending}
            onChange={onToggle}
          />
        }
      />

      <View
        style={[
          styles.info,
          { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
        ]}
      >
        <Text variant="label" tone="secondary">
          PIXME가 사진을 다루는 방식
        </Text>
        <Text variant="caption" tone="secondary" style={styles.infoLine}>
          · 원본 사진은 비공개 저장소에 올라가고, 다른 사용자에게는 어떤 경우에도
          보이지 않아요.
        </Text>
        <Text variant="caption" tone="secondary" style={styles.infoLine}>
          · 캐릭터를 만드는 데 필요한 범위에서만 사용하고, 위치 정보 같은 사진
          메타데이터는 올리기 전에 지워요.
        </Text>
        <Text variant="caption" tone="secondary" style={styles.infoLine}>
          · 내 기록에서 원본을 개별 삭제할 수 있고, 계정을 삭제하면 모두 지워져요.
        </Text>
      </View>

      <SectionHeader title="약관" />
      <ListRow
        title={copy.settings.privacy}
        icon="shield"
        onPress={() => void Linking.openURL(config.links.privacy)}
      />
      <ListRow
        title={copy.settings.terms}
        icon="info"
        onPress={() => void Linking.openURL(config.links.terms)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  info: {
    marginTop: spacing.base,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  infoLine: { marginTop: spacing.sm },
});
