import { useCallback, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { copy } from '@/constants/copy';
import {
  captureFromCamera,
  pickFromLibrary,
  type PickerOutcome,
} from '@/lib/image';
import { radius, spacing, useTheme } from '@/theme';
import { Button, Icon, Sheet, Text, useToast } from '@/ui';
import { useGenerationStore } from '@/features/generation/generationStore';
import { useTodayStatus } from '@/features/feed/useTodayFeed';

/* eslint-disable @typescript-eslint/no-require-imports */
const GUIDES = [
  {
    label: copy.create.guideSelfie,
    accessibilityLabel: copy.a11y.guideSelfie,
    source: require('../../assets/guides/selfie.png'),
  },
  {
    label: copy.create.guideOotd,
    accessibilityLabel: copy.a11y.guideOotd,
    source: require('../../assets/guides/ootd.png'),
  },
];
/* eslint-enable @typescript-eslint/no-require-imports */

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
  const toast = useToast();

  const [permissionPrompt, setPermissionPrompt] = useState<
    'camera' | 'library' | null
  >(null);
  const [busy, setBusy] = useState<'camera' | 'library' | null>(null);

  const [noCreditPrompt, setNoCreditPrompt] = useState(false);

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

  const alreadyPublished = !!todayStatus.data?.myTodayStatus;
  // Strict, not `?? true`: defaulting an unloaded/unknown entitlement to
  // "free" told someone who had already spent their free generation that
  // this one was free too, right up until (or unless) the real value ever
  // arrived. `canGenerate` below still has its own loading allowance, so the
  // button isn't blocked by this — only the claim shown to the user is.
  const isFree = todayStatus.data?.nextGenerationIsFree === true;
  const credits = todayStatus.data?.creditBalance ?? 0;
  // Still loading: don't flash the no-credit popup before the real balance
  // arrives — only gate once we actually know it's zero.
  const canGenerate = isFree || credits > 0 || todayStatus.isPending;

  const onCamera = useCallback(async () => {
    if (!canGenerate) {
      setNoCreditPrompt(true);
      return;
    }
    setBusy('camera');
    try {
      handleOutcome(await captureFromCamera(), 'camera');
    } catch {
      // A throw here (an image the manipulator can't decode, say) would
      // otherwise just clear the spinner and leave the button looking dead.
      toast.show({ message: copy.errors.generic, tone: 'error' });
    } finally {
      setBusy(null);
    }
  }, [canGenerate, handleOutcome, toast]);

  const onLibrary = useCallback(async () => {
    if (!canGenerate) {
      setNoCreditPrompt(true);
      return;
    }
    setBusy('library');
    try {
      handleOutcome(await pickFromLibrary(), 'library');
    } catch {
      toast.show({ message: copy.errors.generic, tone: 'error' });
    } finally {
      setBusy(null);
    }
  }, [canGenerate, handleOutcome, toast]);

  return (
    <>
      <Sheet
        visible
        onClose={() => router.back()}
        title={
          noCreditPrompt
            ? copy.generation.noCreditTitle
            : permissionPrompt !== null
              ? permissionPrompt === 'camera'
                ? copy.create.permissionCameraTitle
                : copy.create.permissionLibraryTitle
              : copy.create.sheetTitle
        }
        subtitle={
          noCreditPrompt || permissionPrompt !== null
            ? undefined
            : alreadyPublished
              ? copy.create.alreadyPublished
              : undefined
        }
      >
        {permissionPrompt !== null ? (
          // Same nested-Modal problem as the no-credit case below: rendered
          // inline inside this already-open Sheet instead of a second Modal.
          <View>
            <Text variant="body" tone="secondary" style={styles.noCreditBody}>
              {permissionPrompt === 'camera'
                ? copy.create.permissionCameraBody
                : copy.create.permissionLibraryBody}
            </Text>
            <Button
              label={copy.create.openSettings}
              onPress={() => {
                setPermissionPrompt(null);
                void Linking.openSettings();
              }}
            />
            <Button
              label={copy.common.cancel}
              variant="ghost"
              onPress={() => setPermissionPrompt(null)}
              style={styles.second}
            />
          </View>
        ) : noCreditPrompt ? (
          // Rendered inline, not as a second <Modal>: stacking a Modal-based
          // ConfirmDialog on top of this already-open Sheet silently fails to
          // present on iOS (nested native modal presentation isn't supported),
          // which looked like the button doing nothing at all.
          <View>
            <Text variant="body" tone="secondary" style={styles.noCreditBody}>
              {copy.generation.noCreditBody}
            </Text>
            <Button
              label={copy.generation.noCreditCta}
              onPress={() => router.replace('/store')}
            />
            <Button
              label={copy.common.cancel}
              variant="ghost"
              onPress={() => setNoCreditPrompt(false)}
              style={styles.second}
            />
          </View>
        ) : (
          <View>
            {/*
              Framing guide, shown before the camera opens rather than after a
              bad photo has already cost an attempt. Rendered from generated
              PIXME characters, not stock photos of real people — the guide has
              to show *how much of you* belongs in frame without implying whose
              face the result will resemble.
            */}
            <View style={styles.guides}>
              {GUIDES.map((guide) => (
                <View key={guide.label} style={styles.guide}>
                  <Image
                    source={guide.source}
                    style={[styles.guideImage, { borderColor: colors.border }]}
                    resizeMode="contain"
                    accessibilityLabel={guide.accessibilityLabel}
                  />
                  <Text variant="micro" tone="secondary" align="center" style={styles.guideLabel}>
                    {guide.label}
                  </Text>
                </View>
              ))}
            </View>

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

            {todayStatus.isPending ? null : (
              <Text variant="micro" tone="secondary" align="center" style={styles.credit}>
                {isFree
                  ? copy.generation.retryCostFree
                  : copy.generation.balance(credits)}
              </Text>
            )}
          </View>
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  noCreditBody: { marginBottom: spacing.base },
  guides: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.base,
  },
  guide: { flex: 1 },
  guideImage: {
    // A definite height rather than `aspectRatio` + `width: '100%'`: inside
    // the sheet the parent has no resolved width at layout time, so the
    // percentage width had nothing to resolve against and the images grew
    // to their intrinsic size, overflowing the screen.
    width: '100%',
    height: 168,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  guideLabel: { marginTop: spacing.xs },
  second: { marginTop: spacing.md },
  hint: { marginTop: spacing.base, paddingHorizontal: spacing.base },
  credit: { marginTop: spacing.sm },
});
