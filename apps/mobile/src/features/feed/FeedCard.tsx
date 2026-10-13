import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { DailyStatusEntry } from '@/api';
import { copy } from '@/constants/copy';
import { moodEmoji, moodLabel } from '@/constants/moods';
import { formatTag } from '@/constants/tags';
import { analytics } from '@/lib/analytics';
import { formatCount, formatRelative } from '@/lib/format';
import { layout, opacity, radius, spacing, useTheme } from '@/theme';
import {
  Avatar,
  HeartBurst,
  Icon,
  PixelCharacter,
  Text,
  useToast,
} from '@/ui';

import { ConnectionQuotaDialog } from '../connections/ConnectionQuotaDialog';
import { useConnectionRequest } from '../connections/useConnectionRequest';
import { WaveComposeDialog } from '../connections/WaveComposeDialog';
import { DecoFrame } from '../decorations/DecoFrame';
import { DecoratedBackground } from '../decorations/DecoratedBackground';
import { burstFor, DARK_BACKGROUNDS, NICKNAMES } from '../decorations/catalog';
import { useDecorations } from '../decorations/useDecorations';
import { useHeart } from '../reactions/useHeart';

export interface FeedCardProps {
  status: DailyStatusEntry;
  /** Card height, set by the pager so each card fills exactly one page. */
  height: number;
  /** True while this card is the visible page — gates the idle animation. */
  active: boolean;
}

/**
 * One person's today.
 *
 * Interaction model (intentionally *not* Tinder): swiping to the next card is
 * neutral and has no "reject" semantics, so there is no dislike affordance
 * anywhere on this card. The only outgoing signals are ♡ and 👋.
 */
export function FeedCard({ status, height, active }: FeedCardProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const { toggleHeart } = useHeart();
  const connectionRequest = useConnectionRequest();

  const [burstKey, setBurstKey] = useState(0);

  const characterSize = useMemo(
    () => Math.min(height * 0.42, 320),
    [height],
  );

  // The author's decorations arrive inline on the card; the server has
  // already removed anything they may no longer use, so these render as-is.
  const decorations = status.author.decorations ?? {};
  const onDarkBackground =
    !!decorations.BACKGROUND && DARK_BACKGROUNDS.has(decorations.BACKGROUND);
  const nickname = decorations.NICKNAME ? NICKNAMES[decorations.NICKNAME] : undefined;
  /**
   * The *viewer's* own unlock, not the card author's. Background/frame/
   * nickname sit statically on the card, so an author's choice is genuinely
   * visible to anyone who looks — but the burst is a local animation that
   * plays only on whichever device tapped heart, with no realtime channel to
   * the author's screen. Keying it to the author would mean nobody, ever,
   * sees the effect they paid for; keying it to the viewer means whoever
   * bought it gets to enjoy it on every heart they send, which is the only
   * version of "it works" this slot can actually deliver.
   */
  const myDecorations = useDecorations();
  const burst = burstFor(myDecorations.data?.active.PARTICLE);

  const waveState = status.author.connectionStatus;
  const waveSent =
    waveState === 'REQUESTED_BY_ME' || waveState === 'CONNECTED';

  const onHeart = useCallback(() => {
    const next = toggleHeart(status);
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

  const onWave = useCallback(() => {
    if (waveSent) {
      toast.show(copy.reactions.waveAlready);
      return;
    }
    setComposingWave(true);
  }, [toast, waveSent]);

  const sendWave = useCallback(
    (message: string | null) => {
      connectionRequest.mutate(
        { userId: status.author.id, message },
        {
          onSuccess: (response) => {
            setComposingWave(false);
            if (response.connection) {
              router.push({
                pathname: '/connection-success',
                params: { connectionId: response.connection.id },
              });
              return;
            }
            toast.show({
              message: copy.reactions.waveSent,
              tone: 'wave',
              icon: 'wave',
            });
          },
          onError: () => setComposingWave(false),
        },
      );
    },
    [connectionRequest, status.author.id, router, toast],
  );

  const openProfile = useCallback(() => {
    analytics.track('SQUARE_PROFILE_OPENED', { targetUserId: status.author.id });
    router.push(`/user/${status.author.id}`);
  }, [status.author.id, router]);

  return (
    <View style={[styles.page, { height }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.stage, borderColor: colors.border },
        ]}
      >
        <DecoratedBackground
          code={decorations.BACKGROUND}
          fallback={[colors.stageTop, colors.stageBottom]}
          active={active}
        />
        <DecoFrame code={decorations.FRAME} radius={radius.xl} />

        {/* header */}
        <Pressable
          onPress={openProfile}
          accessibilityRole="button"
          accessibilityLabel={copy.a11y.openProfile(status.author.nickname)}
          style={({ pressed }) => [
            styles.header,
            pressed ? { opacity: opacity.pressed } : null,
          ]}
        >
          <Avatar
            uri={status.author.representativeCharacterUrl}
            nickname={status.author.nickname}
            size={34}
            ring={
              status.author.connectionStatus === 'CONNECTED'
                ? 'connection'
                : 'none'
            }
          />
          <View style={styles.headerText}>
            <Text
              variant="bodyStrong"
              numberOfLines={1}
              style={[
                onDarkBackground ? { color: '#FFFDF8' } : null,
                nickname
                  ? {
                      textShadowColor: nickname.glow,
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: nickname.radius,
                      ...(nickname.color ? { color: nickname.color } : null),
                    }
                  : null,
              ]}
            >
              @{status.author.nickname}
            </Text>
            <Text variant="micro" tone="tertiary">
              {formatRelative(status.createdAt)}
            </Text>
          </View>
          {status.heartCount > 0 ? (
            <View style={styles.heartCount}>
              <Icon name="heart-filled" size={13} color={colors.heart} />
              <Text variant="micro" tone="secondary" style={styles.heartCountText}>
                {formatCount(status.heartCount)}
              </Text>
            </View>
          ) : null}
        </Pressable>

        {/* character stage */}
        <View style={styles.characterArea}>
          <PixelCharacter
            uri={status.characterImageUrl}
            size={characterSize}
            idle={active}
            idleVariant={status.id.charCodeAt(0) % 3}
            priority={active ? 'high' : 'normal'}
            accessibilityLabel={copy.a11y.userTodayPixel(status.author.nickname)}
          />
          <HeartBurst
            trigger={burstKey}
            particles={burst.particles}
            glyph={burst.glyph}
            color={burst.color}
          />
        </View>

        {/* caption / mood / tags */}
        <View style={styles.meta}>
          {status.message ? (
            <Text variant="callout" align="center" numberOfLines={2}>
              “{status.message}”
            </Text>
          ) : null}

          {status.mood ? (
            <Text
              variant="title2"
              align="center"
              style={styles.mood}
              accessibilityLabel={copy.a11y.mood(moodLabel(status.mood))}
            >
              {moodEmoji(status.mood)}
            </Text>
          ) : null}

          {status.tags.length > 0 ? (
            <View style={styles.tags}>
              {status.tags.map((tag) => (
                <Text key={tag} variant="caption" tone="accent" style={styles.tag}>
                  {formatTag(tag)}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* actions */}
        <View style={styles.actions}>
          <ActionButton
            label={copy.reactions.heart}
            icon={status.heartedByMe ? 'heart-filled' : 'heart'}
            color={status.heartedByMe ? colors.heart : colors.textSecondary}
            backgroundColor={
              status.heartedByMe ? colors.heartSubtle : colors.surface
            }
            onPress={onHeart}
          />
          <ActionButton
            label={waveSent ? copy.reactions.waveSentLabel : copy.reactions.wave}
            icon={waveSent ? 'check' : 'wave'}
            color={waveSent ? colors.wave : colors.textSecondary}
            backgroundColor={waveSent ? colors.waveSubtle : colors.surface}
            onPress={onWave}
            // Stays tappable rather than `disabled` even once sent: a greyed
            // button reads as broken/blocked, and the sent state needs to
            // stay visually "done", not "unavailable" — see onWave, which
            // turns a repeat tap into the waveAlready toast instead of a
            // resend. Only the in-flight request itself is disabled.
            disabled={connectionRequest.isPending}
            emphasis
          />
          <ActionButton
            label={copy.profile.short}
            icon="user"
            color={colors.textSecondary}
            backgroundColor={colors.surface}
            onPress={openProfile}
          />
        </View>
      </View>

      <ConnectionQuotaDialog
        visible={connectionRequest.quotaDialogVisible}
        plusActive={connectionRequest.quotaDialogPlusActive}
        onDismiss={connectionRequest.dismissQuotaDialog}
      />

      <WaveComposeDialog
        visible={composingWave}
        loading={connectionRequest.isPending}
        onSend={sendWave}
        onCancel={() => setComposingWave(false)}
      />
    </View>
  );
}

function ActionButton({
  label,
  icon,
  color,
  backgroundColor,
  onPress,
  disabled,
  emphasis = false,
}: {
  label: string;
  icon: 'heart' | 'heart-filled' | 'wave' | 'user' | 'check';
  color: string;
  backgroundColor: string;
  onPress: () => void;
  disabled?: boolean;
  emphasis?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor,
          borderColor: emphasis ? color : colors.border,
          opacity: disabled ? opacity.disabled : pressed ? opacity.pressed : 1,
        },
      ]}
    >
      <Icon name={icon} size={20} color={color} />
      <Text variant="micro" tone="secondary" style={styles.actionLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: layout.gutter, paddingBottom: spacing.md },
  card: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  stage: { ...StyleSheet.absoluteFill },
  nicknameGlow: {
    textShadowColor: '#F9AE2B',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1, marginLeft: spacing.md },
  heartCount: { flexDirection: 'row', alignItems: 'center' },
  heartCountText: { marginLeft: spacing.xs },
  characterArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.base,
  },
  meta: { minHeight: 92, justifyContent: 'flex-end' },
  mood: { marginTop: spacing.sm },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  tag: { marginHorizontal: spacing.xs },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 86,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.xs,
    borderRadius: radius.base,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: { marginTop: spacing.xs },
});
