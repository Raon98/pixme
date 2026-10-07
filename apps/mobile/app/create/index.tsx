import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { copy } from '@/constants/copy';
import {
  captureFromCamera,
  pickFromLibrary,
  type PickerOutcome,
} from '@/lib/image';
import { spacing, useTheme } from '@/theme';
import { Button, ConfirmDialog, Icon, Sheet, Text } from '@/ui';
import { useGenerationStore } from '@/features/generation/generationStore';
import { useTodayStatus } from '@/features/feed/useTodayFeed';

/**
 * The create entry point — a sheet, not a screen.
 *
 * Keeping it a transparent modal means the tab the user came from stays
 * visible behind it, so starting (and abandoning) today's PIXME costs nothing.
 */
export default function CreateRoute() {
  const router = useRouter();
  const { colors } = useTheme();
  const startDraft = useGenerationStore((state) => state.startDraft);
  const todayStatus = useTodayStatus();

  const [permissionPrompt, setPermissionPrompt] = useState<
    'camera' | 'library' | null
  >(null);
  const [busy, setBusy] = useState<'camera' | 'library' | null>(null);

  const handleOutcome = useCallback(
    (outcome: PickerOutcome, source: 'camera' | 'library') => {
      if (outcome.status === 'permission-denied') {
        setPermissionPrompt(source);
        return;
      }
      if (outcome.status === 'cancelled') return;

      startDraft(outcome.image);
      router.replace('/create/preview');
    },
    [router, startDraft],
  );

  const onCamera = useCallback(async () => {
    setBusy('camera');
    try {
      handleOutcome(await captureFromCamera(), 'camera');
    } finally {
      setBusy(null);
    }
  }, [handleOutcome]);

  const onLibrary = useCallback(async () => {
    setBusy('library');
    try {
      handleOutcome(await pickFromLibrary(), 'library');
    } finally {
      setBusy(null);
    }
  }, [handleOutcome]);

  const alreadyPublished = !!todayStatus.data?.myTodayPost;
  const freeAvailable = todayStatus.data?.freeGenerationAvailable ?? true;
  const credits = todayStatus.data?.creditBalance ?? 0;

  return (
    <>
      <Sheet
        visible
        onClose={() => router.back()}
        title={copy.create.sheetTitle}
        subtitle={
          alreadyPublished
            ? '오늘 대표 PIXME가 이미 있어요. 새로 만들면 바꿀 수 있어요.'
            : undefined
        }
      >
        <View>
          <Button
            label={copy.create.camera}
            icon={<Icon name="camera" size={18} color={colors.textOnAccent} />}
            loading={busy === 'camera'}
            disabled={busy !== null}
            onPress={() => void onCamera()}
          />
          <Button
            label={copy.create.library}
            variant="secondary"
            icon={<Icon name="image" size={18} color={colors.text} />}
            loading={busy === 'library'}
            disabled={busy !== null}
            onPress={() => void onLibrary()}
            style={styles.second}
          />

          <Text variant="micro" tone="tertiary" align="center" style={styles.hint}>
            {copy.create.hint}
          </Text>

          {!freeAvailable ? (
            <Text
              variant="micro"
              tone={credits > 0 ? 'secondary' : 'danger'}
              align="center"
              style={styles.credit}
            >
              {credits > 0
                ? `오늘 무료 생성을 사용했어요. 생성권 ${credits}개가 있어요.`
                : copy.generation.retryNoCredit}
            </Text>
          ) : null}
        </View>
      </Sheet>

      <ConfirmDialog
        visible={permissionPrompt !== null}
        title={
          permissionPrompt === 'camera'
            ? copy.create.permissionCameraTitle
            : copy.create.permissionLibraryTitle
        }
        body={
          permissionPrompt === 'camera'
            ? copy.create.permissionCameraBody
            : copy.create.permissionLibraryBody
        }
        confirmLabel={copy.create.openSettings}
        cancelLabel={copy.common.cancel}
        onConfirm={() => {
          setPermissionPrompt(null);
          void Linking.openSettings();
        }}
        onCancel={() => setPermissionPrompt(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  second: { marginTop: spacing.md },
  hint: { marginTop: spacing.base, paddingHorizontal: spacing.base },
  credit: { marginTop: spacing.sm },
});
