import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { dailyStatusApi, qk, type SquareOccupant } from '@/api';
import { copy } from '@/constants/copy';
import { moodEmoji, moodLabel } from '@/constants/moods';
import { formatTag } from '@/constants/tags';
import { analytics } from '@/lib/analytics';
import { formatCount } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';
import {
  Button,
  HeartBurst,
  Icon,
  PixelCharacter,
  Sheet,
  Skeleton,
  Text,
  TextField,
  useToast,
} from '@/ui';

import { ConnectionQuotaDialog } from '../connections/ConnectionQuotaDialog';
import { useConnectionRequest } from '../connections/useConnectionRequest';
import { burstFor } from '../decorations/catalog';
import { useDecorations } from '../decorations/useDecorations';
import { useHeart } from '../reactions/useHeart';

export interface OccupantSheetProps {
  occupant: Pick<SquareOccupant, 'dailyStatusId' | 'userId' | 'nickname' | 'characterImageUrl' | 'mood'> | null;
  onClose: () => void;
}

/**
 * Tapping someone in the square opens this. It is intentionally a peek, not a
 * profile: character, one line, mood, tags and the two reactions. Going deeper
 * is an explicit `profile.view`.
 */
export function OccupantSheet({ occupant, onClose }: OccupantSheetProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const { toggleHeart } = useHeart();
  const connectionRequest = useConnectionRequest();
  const [localHearted, setLocalHearted] = useState<boolean | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const myDecorations = useDecorations();
  const burst = burstFor(myDecorations.data?.active.PARTICLE);

  const query = useQuery({
    queryKey: qk.dailyStatus.detail(occupant?.dailyStatusId ?? 'none'),
    queryFn: () => dailyStatusApi.detail(occupant!.dailyStatusId!),
    enabled: !!occupant?.dailyStatusId,
    staleTime: 60_000,
  });

  const status = query.data;
  const hearted = localHearted ?? status?.heartedByMe ?? false;
  const waveSent =
    status?.author.connectionStatus === 'REQUESTED_BY_ME' ||
    status?.author.connectionStatus === 'CONNECTED';

  const onHeart = useCallback(() => {
    if (!status) return;
    const next = toggleHeart(status);
    setLocalHearted(next);
    if (next) {
      setBurstKey((value) => value + 1);
      toast.show({
        message: copy.reactions.heartSent,
        tone: 'heart',
        icon: 'heart-filled',
      });
    }
  }, [status, toggleHeart, toast]);

  const [composingWave, setComposingWave] = useState(false);
  const [waveText, setWaveText] = useState('');

  const onWave = useCallback(() => {
    if (!occupant) return;
    if (waveSent) {
      toast.show(copy.reactions.waveAlready);
      return;
    }
    setComposingWave(true);
  }, [occupant, toast, waveSent]);

  const sendWave = useCallback(
    (message: string | null) => {
      if (!occupant) return;
      connectionRequest.mutate(
        { userId: occupant.userId, message },
        {
          onSuccess: (response) => {
            setComposingWave(false);
            setWaveText('');
            onClose();
            if (response.connection) {
              router.push({
                pathname: '/connection-success',
                params: { connectionId: response.connection.id },
              });
            } else {
              toast.show({
                message: copy.reactions.waveSent,
                tone: 'wave',
                icon: 'wave',
              });
            }
          },
        },
      );
    },
    [connectionRequest, occupant, onClose, router, toast],
  );

  const openProfile = useCallback(() => {
    if (!occupant) return;
    analytics.track('SQUARE_PROFILE_OPENED', { targetUserId: occupant.userId });
    onClose();
    router.push(`/user/${occupant.userId}`);
  }, [occupant, onClose, router]);

  return (
    <>
    <Sheet
      visible={!!occupant}
      onClose={() => {
        setComposingWave(false);
        setWaveText('');
        onClose();
      }}
    >
      {occupant && composingWave ? (
        // Inline, not a second Modal: this Sheet is already a Modal, and a
        // stacked one silently fails to present on iOS — see WaveComposeDialog.
        <View>
          <Text variant="title3" align="center">
            {copy.reactions.waveComposeTitle}
          </Text>
          <Text variant="caption" tone="secondary" align="center" style={styles.composeBody}>
            {copy.reactions.waveComposeBody}
          </Text>
          <TextField
            value={waveText}
            onChangeText={setWaveText}
            placeholder={copy.reactions.waveComposePlaceholder}
            maxLength={140}
            showCounter
            multiline
            autoFocus
            containerStyle={styles.composeField}
          />
          <Button
            label={copy.reactions.waveComposeSend}
            loading={connectionRequest.isPending}
            onPress={() => sendWave(waveText.trim() || null)}
          />
          <Button
            label={copy.reactions.waveComposeSkip}
            variant="ghost"
            disabled={connectionRequest.isPending}
            onPress={() => sendWave(null)}
            style={styles.composeSkip}
          />
        </View>
      ) : occupant ? (
        <View>
          <View style={styles.hero}>
            <PixelCharacter
              uri={occupant.characterImageUrl}
              size={140}
              idle
              accessibilityLabel={copy.a11y.userPixel(occupant.nickname)}
            />
            <HeartBurst
              trigger={burstKey}
              particles={burst.particles}
              glyph={burst.glyph}
              color={burst.color}
            />
          </View>

          <Text variant="title3" align="center">
            @{occupant.nickname}
          </Text>

          {occupant.dailyStatusId && query.isPending ? (
            <View style={styles.loading}>
              <Skeleton width="70%" height={18} style={styles.center} />
              <Skeleton
                width="40%"
                height={14}
                style={[styles.center, { marginTop: spacing.sm }]}
              />
            </View>
          ) : (
            <>
              {status?.message ? (
                <Text
                  variant="callout"
                  align="center"
                  tone="secondary"
                  style={styles.caption}
                >
                  “{status.message}”
                </Text>
              ) : null}

              {(status?.mood ?? occupant.mood) ? (
                <Text
                  variant="title2"
                  align="center"
                  style={styles.mood}
                  accessibilityLabel={copy.a11y.mood(
                    moodLabel((status?.mood ?? occupant.mood)!),
                  )}
                >
                  {moodEmoji((status?.mood ?? occupant.mood)!)}
                </Text>
              ) : null}

              {status && status.tags.length > 0 ? (
                <View style={styles.tags}>
                  {status.tags.map((tag: string) => (
                    <Text key={tag} variant="caption" tone="accent" style={styles.tag}>
                      {formatTag(tag)}
                    </Text>
                  ))}
                </View>
              ) : null}

              {status && status.heartCount > 0 ? (
                <View style={styles.heartRow}>
                  <Icon name="heart-filled" size={14} color={colors.heart} />
                  <Text variant="micro" tone="secondary" style={styles.heartText}>
                    {formatCount(status.heartCount)}
                  </Text>
                </View>
              ) : null}
            </>
          )}

          <View style={styles.actions}>
            <Button
              label={copy.reactions.heart}
              variant={hearted ? 'heart' : 'secondary'}
              size="md"
              icon={
                <Icon
                  name={hearted ? 'heart-filled' : 'heart'}
                  size={18}
                  color={hearted ? colors.textOnAccent : colors.textSecondary}
                />
              }
              onPress={onHeart}
              disabled={!status}
              style={styles.actionButton}
            />
            <Button
              label={waveSent ? copy.reactions.waveSentLabel : copy.reactions.wave}
              variant={waveSent ? 'secondary' : 'wave'}
              size="md"
              icon={
                <Icon
                  name={waveSent ? 'check' : 'wave'}
                  size={18}
                  color={waveSent ? colors.textSecondary : colors.textOnAccent}
                />
              }
              loading={connectionRequest.isPending}
              onPress={onWave}
              style={styles.actionButton}
            />
          </View>

          <Button
            label={copy.profile.view}
            variant="ghost"
            size="sm"
            onPress={openProfile}
          />
        </View>
      ) : null}
    </Sheet>

      <ConnectionQuotaDialog
        visible={connectionRequest.quotaDialogVisible}
        plusActive={connectionRequest.quotaDialogPlusActive}
        onDismiss={connectionRequest.dismissQuotaDialog}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.base,
  },
  composeBody: { marginTop: spacing.md },
  composeField: { marginTop: spacing.lg, marginBottom: spacing.lg },
  composeSkip: { marginTop: spacing.xs },
  loading: { marginTop: spacing.base },
  center: { alignSelf: 'center' },
  caption: { marginTop: spacing.md },
  mood: { marginTop: spacing.sm },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  tag: { marginHorizontal: spacing.xs },
  heartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  heartText: { marginLeft: spacing.xs },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    borderRadius: radius.md,
  },
  actionButton: { flex: 1, marginHorizontal: spacing.xs },
});
