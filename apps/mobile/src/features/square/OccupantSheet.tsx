import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { pixelsApi, qk, type SquareOccupant } from '@/api';
import { copy } from '@/constants/copy';
import { moodEmoji, moodLabel } from '@/constants/moods';
import { formatTag } from '@/constants/tags';
import { analytics } from '@/lib/analytics';
import { formatCount } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';
import {
  Button,
  Icon,
  PixelCharacter,
  Sheet,
  Skeleton,
  Text,
  useToast,
} from '@/ui';

import { useConnectionRequest } from '../connections/useConnectionRequest';
import { useHeart } from '../reactions/useHeart';

export interface OccupantSheetProps {
  occupant: Pick<SquareOccupant, 'postId' | 'userId' | 'nickname' | 'characterImageUrl' | 'mood'> | null;
  onClose: () => void;
}

/**
 * Tapping someone in the square opens this. It is intentionally a peek, not a
 * profile: character, one line, mood, tags and the two reactions. Going deeper
 * is an explicit "프로필 보기".
 */
export function OccupantSheet({ occupant, onClose }: OccupantSheetProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const { toggleHeart } = useHeart();
  const connectionRequest = useConnectionRequest();
  const [localHearted, setLocalHearted] = useState<boolean | null>(null);

  const query = useQuery({
    queryKey: qk.pixels.detail(occupant?.postId ?? 'none'),
    queryFn: () => pixelsApi.detail(occupant!.postId),
    enabled: !!occupant,
    staleTime: 60_000,
  });

  const post = query.data;
  const hearted = localHearted ?? post?.heartedByMe ?? false;
  const waveSent =
    post?.author.connectionStatus === 'REQUESTED_BY_ME' ||
    post?.author.connectionStatus === 'CONNECTED';

  const onHeart = useCallback(() => {
    if (!post) return;
    const next = toggleHeart(post);
    setLocalHearted(next);
    if (next) {
      toast.show({
        message: copy.reactions.heartSent,
        tone: 'heart',
        icon: 'heart-filled',
      });
    }
  }, [post, toggleHeart, toast]);

  const onWave = useCallback(() => {
    if (!occupant) return;
    if (waveSent) {
      toast.show(copy.reactions.waveAlready);
      return;
    }
    connectionRequest.mutate(
      { userId: occupant.userId },
      {
        onSuccess: (response) => {
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
  }, [connectionRequest, occupant, onClose, router, toast, waveSent]);

  const openProfile = useCallback(() => {
    if (!occupant) return;
    analytics.track('SQUARE_PROFILE_OPENED', { targetUserId: occupant.userId });
    onClose();
    router.push(`/user/${occupant.userId}`);
  }, [occupant, onClose, router]);

  return (
    <Sheet visible={!!occupant} onClose={onClose}>
      {occupant ? (
        <View>
          <View style={styles.hero}>
            <PixelCharacter
              uri={occupant.characterImageUrl}
              size={140}
              idle
              accessibilityLabel={`${occupant.nickname}의 PIXME`}
            />
          </View>

          <Text variant="title3" align="center">
            @{occupant.nickname}
          </Text>

          {query.isPending ? (
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
              {post?.caption ? (
                <Text
                  variant="callout"
                  align="center"
                  tone="secondary"
                  style={styles.caption}
                >
                  “{post.caption}”
                </Text>
              ) : null}

              {post?.mood ? (
                <Text
                  variant="title2"
                  align="center"
                  style={styles.mood}
                  accessibilityLabel={`기분 ${moodLabel(post.mood)}`}
                >
                  {moodEmoji(post.mood)}
                </Text>
              ) : null}

              {post && post.tags.length > 0 ? (
                <View style={styles.tags}>
                  {post.tags.map((tag) => (
                    <Text key={tag} variant="caption" tone="accent" style={styles.tag}>
                      {formatTag(tag)}
                    </Text>
                  ))}
                </View>
              ) : null}

              {post && post.heartCount > 0 ? (
                <View style={styles.heartRow}>
                  <Icon name="heart-filled" size={14} color={colors.heart} />
                  <Text variant="micro" tone="secondary" style={styles.heartText}>
                    {formatCount(post.heartCount)}
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
              disabled={!post}
              style={styles.actionButton}
            />
            <Button
              label={copy.reactions.wave}
              variant={waveSent ? 'secondary' : 'wave'}
              size="md"
              icon={
                <Icon
                  name="wave"
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
            label="프로필 보기"
            variant="ghost"
            size="sm"
            onPress={openProfile}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.base,
  },
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
