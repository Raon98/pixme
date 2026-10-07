import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { pixelsApi, qk } from '@/api';
import { copy } from '@/constants/copy';
import { moodEmoji, moodLabel } from '@/constants/moods';
import { formatTag } from '@/constants/tags';
import { formatCount, formatPostDate } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Header,
  Icon,
  PixelCharacter,
  Screen,
  Skeleton,
  Text,
  useToast,
} from '@/ui';
import { useAuthStore } from '@/features/auth/authStore';

/**
 * A single day's PIXME.
 *
 * Doubles as the owner's history detail and as a read-only view of someone
 * else's post. The private original is only ever fetched on the owner's
 * explicit "원본 보기" tap, via a short-lived signed URL that we deliberately
 * do not cache to disk.
 */
export default function PixelDetailRoute() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();

  const myId = useAuthStore((state) => state.user?.id ?? null);

  const post = useQuery({
    queryKey: qk.pixels.detail(postId),
    queryFn: () => pixelsApi.detail(postId),
    staleTime: 60_000,
  });

  const isOwner = !!post.data && post.data.author.id === myId;

  const mine = useQuery({
    queryKey: ['pixels', 'mine-detail', postId],
    queryFn: () => pixelsApi.myDetail(postId),
    enabled: isOwner,
    staleTime: 60_000,
  });

  const [showOriginal, setShowOriginal] = useState(false);
  const [deletePrompt, setDeletePrompt] = useState(false);

  const original = useQuery({
    queryKey: qk.pixels.original(postId),
    queryFn: () => pixelsApi.originalUrl(postId),
    enabled: isOwner && showOriginal,
    staleTime: 60_000,
    gcTime: 60_000,
  });

  const onDeleteOriginal = useCallback(async () => {
    try {
      await pixelsApi.deleteOriginal(postId);
      setShowOriginal(false);
      setDeletePrompt(false);
      await mine.refetch();
      toast.show({ message: '원본 사진을 삭제했어요.', tone: 'success' });
    } catch {
      toast.show({ message: copy.errors.generic, tone: 'error' });
    }
  }, [mine, postId, toast]);

  if (post.isPending) {
    return (
      <Screen edges={['top']}>
        <Header />
        <View style={styles.center}>
          <Skeleton width={200} height={200} borderRadius={radius.lg} />
          <Skeleton width={160} height={20} style={styles.skeletonLine} />
        </View>
      </Screen>
    );
  }

  if (post.isError || !post.data) {
    return (
      <Screen edges={['top']}>
        <Header />
        <ErrorState error={post.error} onRetry={() => void post.refetch()} />
      </Screen>
    );
  }

  const data = post.data;
  const myData = mine.data;
  const originalRetained = myData?.originalRetained ?? false;

  return (
    <>
      <Screen edges={['top']} scroll contentStyle={styles.content}>
        <Header
          title={formatPostDate(data.postDate)}
          subtitle={isOwner ? undefined : `@${data.author.nickname}`}
        />

        <View
          style={[
            styles.stage,
            { backgroundColor: colors.stage, borderColor: colors.border },
          ]}
        >
          {showOriginal && original.data ? (
            <Image
              source={{ uri: original.data.url }}
              style={styles.original}
              contentFit="cover"
              cachePolicy="none"
              accessibilityLabel="원본 사진"
            />
          ) : (
            <PixelCharacter
              uri={data.characterImageUrl}
              size={200}
              idle
              accessibilityLabel="이 날의 PIXME"
            />
          )}
        </View>

        {data.caption ? (
          <Text variant="callout" align="center" style={styles.caption}>
            “{data.caption}”
          </Text>
        ) : null}

        {data.mood ? (
          <Text
            variant="title2"
            align="center"
            style={styles.mood}
            accessibilityLabel={`기분 ${moodLabel(data.mood)}`}
          >
            {moodEmoji(data.mood)}
          </Text>
        ) : null}

        {data.tags.length > 0 ? (
          <View style={styles.tags}>
            {data.tags.map((tag) => (
              <Text key={tag} variant="caption" tone="accent" style={styles.tag}>
                {formatTag(tag)}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.hearts}>
          <Icon name="heart-filled" size={15} color={colors.heart} />
          <Text variant="caption" tone="secondary" style={styles.heartText}>
            {formatCount(data.heartCount)}
          </Text>
        </View>

        {isOwner ? (
          <View style={styles.ownerActions}>
            {originalRetained ? (
              <>
                <Button
                  label={
                    showOriginal ? copy.my.hideOriginal : copy.my.showOriginal
                  }
                  variant="secondary"
                  size="md"
                  loading={showOriginal && original.isPending}
                  icon={
                    <Icon
                      name={showOriginal ? 'eye-off' : 'eye'}
                      size={16}
                      color={colors.text}
                    />
                  }
                  onPress={() => setShowOriginal((value) => !value)}
                />
                <Button
                  label="원본 사진 삭제"
                  variant="ghost"
                  size="sm"
                  onPress={() => setDeletePrompt(true)}
                  style={styles.ownerSecondary}
                />
              </>
            ) : (
              <Text variant="micro" tone="tertiary" align="center">
                {copy.my.originalDeleted}
              </Text>
            )}
          </View>
        ) : (
          <Button
            label="프로필 보기"
            variant="ghost"
            onPress={() => router.push(`/user/${data.author.id}`)}
            style={styles.profileButton}
          />
        )}
      </Screen>

      <ConfirmDialog
        visible={deletePrompt}
        title="원본 사진을 삭제할까요?"
        body="PIXME 캐릭터와 기록은 그대로 남아요. 원본 사진만 영구 삭제돼요."
        confirmLabel={copy.common.delete}
        destructive
        onConfirm={() => void onDeleteOriginal()}
        onCancel={() => setDeletePrompt(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  skeletonLine: { marginTop: spacing.lg },
  stage: {
    alignSelf: 'center',
    marginTop: spacing.base,
    padding: spacing.xl,
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  original: { width: 200, height: 260, borderRadius: radius.md },
  caption: { marginTop: spacing.xl },
  mood: { marginTop: spacing.sm },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  tag: { marginHorizontal: spacing.xs },
  hearts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  heartText: { marginLeft: spacing.xs },
  ownerActions: { marginTop: spacing.xxl },
  ownerSecondary: { marginTop: spacing.xs },
  profileButton: { marginTop: spacing.xxl },
});
