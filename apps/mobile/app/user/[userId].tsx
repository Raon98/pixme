import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import type { DailyStatusSummary } from '@/api';
import { copy } from '@/constants/copy';
import { interestLabel } from '@/constants/interests';
import { moodEmoji } from '@/constants/moods';
import { formatCount } from '@/lib/format';
import { opacity, radius, spacing, useTheme } from '@/theme';
import {
  Button,
  Chip,
  ConfirmDialog,
  Divider,
  EmptyState,
  ErrorState,
  GridSkeleton,
  Header,
  HeartBurst,
  Icon,
  IconButton,
  PixelCharacter,
  ProfileSkeleton,
  Screen,
  Sheet,
  Text,
  useToast,
} from '@/ui';
import { DecoFrame } from '@/features/decorations/DecoFrame';
import { DecoratedBackground } from '@/features/decorations/DecoratedBackground';
import { burstFor, NICKNAMES } from '@/features/decorations/catalog';
import { useDecorations } from '@/features/decorations/useDecorations';
import { usePublicProfile } from '@/features/profile/useProfile';
import { ConnectionQuotaDialog } from '@/features/connections/ConnectionQuotaDialog';
import { WaveComposeDialog } from '@/features/connections/WaveComposeDialog';
import { useConnectionRequest } from '@/features/connections/useConnectionRequest';
import { useHeart } from '@/features/reactions/useHeart';
import { useBlockUser } from '@/features/safety/useSafety';

/**
 * Another person's profile.
 *
 * Shows the representative character, one line, interests and the pixel
 * record. The original photos behind those characters are never exposed here —
 * only the owner can see an original, and only from their own history.
 */
export default function UserProfileRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();

  const profile = usePublicProfile(userId);
  const connectionRequest = useConnectionRequest();
  const blockUser = useBlockUser();
  const { toggleHeart } = useHeart();
  const myDecorations = useDecorations();
  const burst = burstFor(myDecorations.data?.active.PARTICLE);

  const [menuOpen, setMenuOpen] = useState(false);
  const [blockPrompt, setBlockPrompt] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [composingWave, setComposingWave] = useState(false);

  const onWave = useCallback(() => {
    const relation = profile.data?.relation;
    if (!relation) return;

    if (relation.connectionStatus === 'CONNECTED') {
      if (relation.conversationId) {
        router.push(`/chat/${relation.conversationId}`);
      } else {
        // Connected but the thread id didn't come back — rare, but a
        // labelled primary button must never be a no-op.
        toast.show({ message: copy.errors.generic, tone: 'error' });
      }
      return;
    }
    if (relation.connectionStatus === 'REQUESTED_BY_ME') {
      toast.show(copy.reactions.waveAlready);
      return;
    }

    setComposingWave(true);
  }, [profile.data?.relation, router, toast]);

  const sendWave = useCallback(
    (message: string | null) => {
      connectionRequest.mutate(
        { userId, message },
        {
          onSuccess: (response) => {
            setComposingWave(false);
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
          onError: () => setComposingWave(false),
        },
      );
    },
    [connectionRequest, router, toast, userId],
  );

  const header = (
    <Header
      title={profile.data?.nickname ?? ''}
      right={
        <IconButton label={copy.a11y.more} onPress={() => setMenuOpen(true)}>
          <Icon name="more" size={20} color={colors.text} />
        </IconButton>
      }
    />
  );

  if (profile.isPending) {
    return (
      <Screen edges={['top']} scroll>
        {header}
        <ProfileSkeleton />
        <GridSkeleton />
      </Screen>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <Screen edges={['top']}>
        {header}
        <ErrorState
          error={profile.error}
          onRetry={() => void profile.refetch()}
        />
      </Screen>
    );
  }

  const user = profile.data;

  if (user.relation.blockedByMe) {
    return (
      <Screen edges={['top']}>
        {header}
        <EmptyState
          icon="block"
          title={copy.profile.blocked}
          actionLabel={copy.safety.unblock}
          onAction={() => router.push('/settings/blocked')}
        />
      </Screen>
    );
  }

  const connected = user.relation.connectionStatus === 'CONNECTED';
  const requested = user.relation.connectionStatus === 'REQUESTED_BY_ME';

  return (
    <>
      <Screen edges={['top']} scroll contentStyle={styles.content}>
        {header}

        <View style={styles.hero}>
          <View
            style={[
              styles.heroStage,
              { backgroundColor: colors.stage, borderColor: colors.border },
            ]}
          >
            {/*
              The owner's own decorations, exactly as they chose them. Half
              the point of paying for a look is that visitors see it — until
              now this screen quietly ignored it.
            */}
            <View style={[StyleSheet.absoluteFill, styles.heroStageClip]}>
              <DecoratedBackground
                code={user.decorations.BACKGROUND}
                fallback={[colors.stageTop, colors.stageBottom]}
              />
            </View>
            <DecoFrame code={user.decorations.FRAME} radius={radius.xl} />
            <PixelCharacter
              uri={
                user.todayStatus?.characterImageUrl ??
                user.representativeCharacterUrl
              }
              size={132}
              idle
              accessibilityLabel={copy.a11y.userCurrentPixel(user.nickname)}
            />
            {/*
              Outside the clipped background layer above: the burst's particles
              travel well past the 160×160 stage, and clipping them to it
              defeated the whole effect.
            */}
            <HeartBurst
              trigger={burstKey}
              particles={burst.particles}
              glyph={burst.glyph}
              color={burst.color}
            />
          </View>

          <View style={styles.nicknameRow}>
            <Text
              variant="title2"
              style={nicknameStyle(user.decorations.NICKNAME)}
            >
              @{user.nickname}
            </Text>
            {/*
              Profile only. The same marker on a feed card or a square occupant
              would turn a crowd into a list of who pays, which is the opposite
              of what PIXME+ is sold as.
            */}
            {user.plus ? (
              <Chip label={copy.plus.title} size="sm" tone="accent" selected />
            ) : null}
          </View>
          {user.bio ? (
            <Text
              variant="caption"
              tone="secondary"
              align="center"
              style={styles.bio}
            >
              {user.bio}
            </Text>
          ) : null}

          {user.interests.length > 0 ? (
            <View style={styles.chips}>
              {user.interests.map((code) => (
                <Chip
                  key={code}
                  label={interestLabel(code)}
                  size="sm"
                  selected
                  tone="default"
                  style={styles.chip}
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* actions */}
        <View style={styles.actions}>
          {user.todayStatus ? (
            <Button
              label={
                user.relation.heartedTodayStatus
                  ? copy.reactions.heartSent
                  : copy.reactions.heart
              }
              variant={user.relation.heartedTodayStatus ? 'heart' : 'secondary'}
              size="md"
              icon={
                <Icon
                  name={
                    user.relation.heartedTodayStatus ? 'heart-filled' : 'heart'
                  }
                  size={16}
                  color={
                    user.relation.heartedTodayStatus
                      ? colors.textOnAccent
                      : colors.textSecondary
                  }
                />
              }
              onPress={() => {
                if (!user.todayStatus) return;
                const next = toggleHeart(user.todayStatus);
                if (next) {
                  setBurstKey((value) => value + 1);
                  toast.show({
                    message: copy.reactions.heartSent,
                    tone: 'heart',
                    icon: 'heart-filled',
                  });
                }
              }}
              style={styles.actionButton}
            />
          ) : null}

          <Button
            label={
              connected
                ? copy.reactions.connectedCta
                : requested
                  ? copy.reactions.waveSentLabel
                  : copy.reactions.wave
            }
            variant={connected ? 'primary' : requested ? 'outline' : 'wave'}
            size="md"
            loading={connectionRequest.isPending}
            icon={
              <Icon
                name={connected ? 'chat' : requested ? 'check' : 'wave'}
                size={16}
                color={
                  connected
                    ? colors.textOnAccent
                    : requested
                      ? colors.textSecondary
                      : colors.textOnAccent
                }
              />
            }
            onPress={onWave}
            style={styles.actionButton}
          />
        </View>

        <View style={[styles.stats, { borderColor: colors.border }]}>
          <Text variant="micro" tone="tertiary">
            {copy.profile.stats(
              formatCount(user.stats.receivedHeartCount),
              formatCount(user.stats.pixelCount),
            )}
          </Text>
        </View>

        <Divider style={styles.divider} />

        <Text variant="title3" style={styles.sectionTitle}>
          {copy.profile.recentOther}
        </Text>

        {user.recentStatuses.length === 0 ? (
          <EmptyState
            compact
            icon="calendar"
            title={copy.profile.emptyHistoryTitle}
          />
        ) : (
          <View style={styles.grid}>
            {user.recentStatuses.map((status) => (
              <HistoryTile
                key={status.id}
                status={status}
                onPress={() => router.push(`/daily-status/${status.id}`)}
              />
            ))}
          </View>
        )}
      </Screen>

      {/* overflow menu */}
      <Sheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={`@${user.nickname}`}
      >
        <Button
          label={copy.safety.report}
          variant="secondary"
          icon={<Icon name="flag" size={18} color={colors.text} />}
          onPress={() => {
            setMenuOpen(false);
            router.push({
              pathname: '/report',
              params: { targetType: 'USER', targetId: user.id, nickname: user.nickname },
            });
          }}
        />
        <Button
          label={copy.safety.block}
          variant="ghost"
          onPress={() => {
            setMenuOpen(false);
            setBlockPrompt(true);
          }}
          style={styles.menuSecondary}
        />
      </Sheet>

      <ConfirmDialog
        visible={blockPrompt}
        title={copy.safety.blockTitle}
        body={copy.safety.blockBody}
        confirmLabel={copy.safety.block}
        destructive
        loading={blockUser.isPending}
        onConfirm={() => {
          blockUser.mutate(user.id, {
            onSuccess: () => {
              setBlockPrompt(false);
              toast.show({ message: copy.safety.blockedTitle, tone: 'success' });
              router.back();
            },
          });
        }}
        onCancel={() => setBlockPrompt(false)}
      />

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
    </>
  );
}

function HistoryTile({
  status,
  onPress,
}: {
  status: DailyStatusSummary;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.a11y.dayPixel(status.statusDate)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.gridItem,
        {
          backgroundColor: colors.surfaceSubtle,
          borderColor: colors.border,
          opacity: pressed ? opacity.pressed : 1,
        },
      ]}
    >
      <PixelCharacter uri={status.characterImageUrl} size={68} />
      <Text variant="micro" tone="tertiary">
        {status.statusDate.slice(5).replace('-', '.')}
        {status.mood ? ` ${moodEmoji(status.mood)}` : ''}
      </Text>
    </Pressable>
  );
}

/** The owner's chosen nickname treatment, or nothing. */
function nicknameStyle(code: string | undefined) {
  const style = code ? NICKNAMES[code] : undefined;
  if (!style) return null;
  return {
    textShadowColor: style.glow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: style.radius,
    ...(style.color ? { color: style.color } : null),
  };
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.giant },
  hero: { alignItems: 'center', paddingTop: spacing.base },
  heroStage: {
    width: 160,
    height: 160,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStageClip: {
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  nicknameGlow: {
    textShadowColor: '#F9AE2B',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.base,
  },
  bio: { marginTop: spacing.xs, maxWidth: 280 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  chip: { marginHorizontal: spacing.xxs, marginBottom: spacing.xs },
  actions: { flexDirection: 'row', marginTop: spacing.xl },
  actionButton: { flex: 1, marginHorizontal: spacing.xs },
  stats: { alignItems: 'center', marginTop: spacing.base },
  divider: { marginTop: spacing.xl },
  sectionTitle: { marginTop: spacing.xl },
  // See history.tsx — percentage margins are part of the margin box, so
  // 31% + 3.5% never fit three across. `gap` does.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.base },
  gridItem: {
    width: '31%',
    aspectRatio: 0.86,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuSecondary: { marginTop: spacing.xs },
});
