import { useCallback } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { copy } from '@/constants/copy';
import { config } from '@/lib/config';
import { radius, spacing, useTheme } from '@/theme';
import {
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

/**
 * Privacy controls.
 *
 * The original photo is the most sensitive thing PIXME ever holds, so the user
 * gets a direct switch for it. With `settings.keepOriginal` off, the server
 * deletes the original as soon as the character is generated — the character and the
 * record survive, the photo does not.
 */
export default function PrivacySettingsRoute() {
  const toast = useToast();
  const { colors } = useTheme();

  const me = useMe();
  const updateMe = useUpdateMe();

  const keepOriginal = me.data?.settings.keepOriginalPhoto ?? true;
  const squareVisible = me.data?.settings.squareVisible ?? false;

  const onToggle = useCallback(
    (next: boolean) => {
      updateMe.mutate(
        { settings: { keepOriginalPhoto: next } },
        {
          onSuccess: () =>
            toast.show({
              message: next
                ? copy.settings.keepOriginalOn
                : copy.settings.keepOriginalOff,
              tone: 'success',
            }),
          onError: () =>
            toast.show({ message: copy.errors.generic, tone: 'error' }),
        },
      );
    },
    [toast, updateMe],
  );

  const onToggleSquareVisible = useCallback(
    (next: boolean) => {
      updateMe.mutate(
        { settings: { squareVisible: next } },
        {
          onSuccess: () =>
            toast.show({
              message: next
                ? copy.settings.squareVisibleOn
                : copy.settings.squareVisibleOff,
              tone: 'success',
            }),
          onError: () =>
            toast.show({ message: copy.errors.generic, tone: 'error' }),
        },
      );
    },
    [toast, updateMe],
  );

  // A switch bound to server state must not render before that state
  // arrives: while loading it would show a default that can be the opposite
  // of the truth, and a tap would then write the wrong value. On error it
  // would read as "everything is off" rather than "we couldn't load this".
  if (me.isPending && !me.data) {
    return (
      <Screen edges={['top']}>
        <Header title={copy.settings.privacySection} />
        <ListSkeleton />
      </Screen>
    );
  }

  if (me.isError && !me.data) {
    return (
      <Screen edges={['top']}>
        <Header title={copy.settings.privacySection} />
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll>
      <Header title={copy.settings.privacySection} />

      <SectionHeader title={copy.square.tabTitle} />
      <ListRow
        title={copy.settings.squareVisible}
        subtitle={copy.settings.squareVisibleHint}
        showChevron={false}
        right={
          <Toggle
            label={copy.settings.squareVisible}
            value={squareVisible}
            disabled={!me.data || updateMe.isPending}
            onChange={onToggleSquareVisible}
          />
        }
      />

      <SectionHeader title={copy.settings.photosSection} />
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
          {copy.settings.photoPolicyTitle}
        </Text>
        <Text variant="caption" tone="secondary" style={styles.infoLine}>
          · {copy.settings.photoPolicyPrivate}
        </Text>
        <Text variant="caption" tone="secondary" style={styles.infoLine}>
          · {copy.settings.photoPolicyScope}
        </Text>
        <Text variant="caption" tone="secondary" style={styles.infoLine}>
          · {copy.settings.photoPolicyDelete}
        </Text>
      </View>

      <SectionHeader title={copy.settings.termsSection} />
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
