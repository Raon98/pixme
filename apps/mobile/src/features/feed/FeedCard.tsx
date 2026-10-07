import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import type { PixelPost } from '@/api';
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

import { useConnectionRequest } from '../connections/useConnectionRequest';
import { useHeart } from '../reactions/useHeart';

export interface FeedCardProps {
  post: PixelPost;
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
export function FeedCard({ post, height, active }: FeedCardProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const { toggleHeart } = useHeart();
  const connectionRequest = useConnectionRequest();

  const [burst, setBurst] = useState(0);

  const characterSize = useMemo(
    () => Math.min(height * 0.42, 320),
    [height],
  );

  const waveState = post.author.connectionStatus;
  const waveSent =
    waveState === 'REQUESTED_BY_ME' || waveState === 'CONNECTED';

  const onHeart = useCallback(() => {
    const next = toggleHeart(post);
    if (next) {
      setBurst((value) => value + 1);
      toast.show({
        message: copy.reactions.heartSent,
        tone: 'heart',
        icon: 'heart-filled',
      });
    }
  }, [post, toggleHeart, toast]);

  const onWave = useCallback(() => {
    if (waveSent) {
      toast.show(copy.reactions.waveAlready);
      return;
    }

    connectionRequest.mutate(
      { userId: post.author.id },
      {
        onSuccess: (response) => {
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
      },
    );
  }, [connectionRequest, post.author.id, router, toast, waveSent]);

  const openProfile = useCallback(() => {
    analytics.track('SQUARE_PROFILE_OPENED', { targetUserId: post.author.id });
    router.push(`/user/${post.author.id}`);
  }, [post.author.id, router]);

  return (
    <View style={[styles.page, { height }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.stage, borderColor: colors.border },
        ]}
      >
        <LinearGradient
          colors={[colors.stageTop, colors.stageBottom]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.stage}
        />

        {/* header */}
        <Pressable
          onPress={openProfile}
          accessibilityRole="button"
          accessibilityLabel={`${post.author.nickname}의 프로필 열기`}
          style={({ pressed }) => [
            styles.header,
            pressed ? { opacity: opacity.pressed } : null,
          ]}
        >
          <Avatar
            uri={post.author.representativeCharacterUrl}
            nickname={post.author.nickname}
            size={34}
            ring={
              post.author.connectionStatus === 'CONNECTED'
                ? 'connection'
                : 'none'
            }
          />
          <View style={styles.headerText}>
            <Text variant="bodyStrong" numberOfLines={1}>
              @{post.author.nickname}
            </Text>
            <Text variant="micro" tone="tertiary">
              {formatRelative(post.createdAt)}
            </Text>
          </View>
          {post.heartCount > 0 ? (
            <View style={styles.heartCount}>
              <Icon name="heart-filled" size={13} color={colors.heart} />
              <Text variant="micro" tone="secondary" style={styles.heartCountText}>
                {formatCount(post.heartCount)}
              </Text>
            </View>
          ) : null}
        </Pressable>

        {/* character stage */}
        <View style={styles.characterArea}>
          <PixelCharacter
            uri={post.characterImageUrl}
            size={characterSize}
            idle={active}
            idleVariant={post.id.charCodeAt(0) % 3}
            priority={active ? 'high' : 'normal'}
            accessibilityLabel={`${post.author.nickname}의 오늘의 PIXME`}
          />
          <HeartBurst trigger={burst} />
        </View>

        {/* caption / mood / tags */}
        <View style={styles.meta}>
          {post.caption ? (
            <Text variant="callout" align="center" numberOfLines={2}>
              “{post.caption}”
            </Text>
          ) : null}

          {post.mood ? (
            <Text
              variant="title2"
              align="center"
              style={styles.mood}
              accessibilityLabel={`기분 ${moodLabel(post.mood)}`}
            >
              {moodEmoji(post.mood)}
            </Text>
          ) : null}

          {post.tags.length > 0 ? (
            <View style={styles.tags}>
              {post.tags.map((tag) => (
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
            icon={post.heartedByMe ? 'heart-filled' : 'heart'}
            color={post.heartedByMe ? colors.heart : colors.textSecondary}
            backgroundColor={
              post.heartedByMe ? colors.heartSubtle : colors.surface
            }
            onPress={onHeart}
          />
          <ActionButton
            label={copy.reactions.wave}
            icon="wave"
            color={waveSent ? colors.wave : colors.textSecondary}
            backgroundColor={waveSent ? colors.waveSubtle : colors.surface}
            onPress={onWave}
            disabled={connectionRequest.isPending}
            emphasis
          />
          <ActionButton
            label="프로필"
            icon="user"
            color={colors.textSecondary}
            backgroundColor={colors.surface}
            onPress={openProfile}
          />
        </View>
      </View>
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
  icon: 'heart' | 'heart-filled' | 'wave' | 'user';
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
