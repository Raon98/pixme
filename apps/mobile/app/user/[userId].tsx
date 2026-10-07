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
  Icon,
  IconButton,
  PixelCharacter,
  ProfileSkeleton,
  Screen,
  Sheet,
  Text,
  useToast,
} from '@/ui';
import { usePublicProfile } from '@/features/profile/useProfile';
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

  const [menuOpen, setMenuOpen] = useState(false);
  const [blockPrompt, setBlockPrompt] = useState(false);

  const onWave = useCallback(() => {
    const relation = profile.data?.relation;
    if (!relation) return;

    if (relation.connectionStatus === 'CONNECTED') {
      if (relation.conversationId) router.push(`/chat/${relation.conversationId}`);
      return;
    }
    if (relation.connectionStatus === 'REQUESTED_BY_ME') {
      toast.show(copy.reactions.waveAlready);
      return;
    }

    connectionRequest.mutate(
      { userId },
      {
        onSuccess: (response) => {
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
  }, [connectionRequest, profile.data?.relation, router, toast, userId]);

  const header = (
    <Header
      title={profile.data?.nickname ?? ''}
      right={
        <IconButton label="더보기" onPress={() => setMenuOpen(true)}>
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
            <PixelCharacter
              uri={
                user.todayStatus?.characterImageUrl ??
                user.representativeCharacterUrl
              }
              size={132}
              idle
              accessibilityLabel={`${user.nickname}의 Current PIXME`}
            />
          </View>

          <Text variant="title2" style={styles.nickname}>
            @{user.nickname}
          </Text>
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
                ? '대화 하기'
                : requested
                  ? copy.reactions.waveAlready
                  : copy.reactions.wave
            }
            variant={connected ? 'primary' : requested ? 'outline' : 'wave'}
            size="md"
            loading={connectionRequest.isPending}
            icon={
              <Icon
                name={connected ? 'chat' : 'wave'}
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
            받은 하트 {formatCount(user.stats.receivedHeartCount)} · PIXME{' '}
            {formatCount(user.stats.pixelCount)}
          </Text>
        </View>

        <Divider style={styles.divider} />

        <Text variant="title3" style={styles.sectionTitle}>
          {copy.profile.recentOther}
        </Text>

        {user.recentStatuses.length === 0 ? (
          <EmptyState
            compact
            glyph="👾"
            title="아직 기록이 없어요."
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
      accessibilityLabel={`${status.statusDate}의 PIXME`}
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
  nickname: { marginTop: spacing.base },
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.base },
  gridItem: {
    width: '31%',
    aspectRatio: 0.86,
    marginRight: '3.5%',
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuSecondary: { marginTop: spacing.xs },
});
