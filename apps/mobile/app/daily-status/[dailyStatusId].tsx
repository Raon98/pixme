import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { copy } from '@/constants/copy';
import { moodEmoji, moodLabel } from '@/constants/moods';
import { formatTag } from '@/constants/tags';
import { formatCount, formatPostDate } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';
import {
  Button,
  ErrorState,
  Header,
  Icon,
  IconButton,
  PixelCharacter,
  Screen,
  Sheet,
  Skeleton,
  Text,
} from '@/ui';
import { useAuthStore } from '@/features/auth/authStore';
import { useMyDailyStatusDetail } from '@/features/dailyStatus/useDailyStatusHistory';
import { useShareStatus } from '@/features/share/useShareStatus';

/**
 * A single day's status.
 *
 * <p>Doubles as the owner's history detail and as a read-only view of someone
 * else's day. The character shown is a live snapshot for today only — for a
 * past day it's frozen at whatever Current PIXME pointed at then. Original
 * photo management lives on the Collection screen now (MY tab), since the
 * original belongs to the kept character, not to any particular day.
 */
export default function DailyStatusDetailRoute() {
  const { dailyStatusId } = useLocalSearchParams<{ dailyStatusId: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const myId = useAuthStore((state) => state.user?.id ?? null);
  const [menuOpen, setMenuOpen] = useState(false);

  const status = useMyDailyStatusDetail(dailyStatusId);

  const { share, sharing, sheet } = useShareStatus({
    characterUrl: status.data?.characterImageUrl ?? null,
    mood: status.data?.mood ?? null,
    message: status.data?.message ?? null,
    dateLabel: status.data ? formatPostDate(status.data.statusDate) : '',
  });

  if (status.isPending) {
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

  if (status.isError || !status.data) {
    return (
      <Screen edges={['top']}>
        <Header />
        <ErrorState error={status.error} onRetry={() => void status.refetch()} />
      </Screen>
    );
  }

  const data = status.data;
  const isOwner = data.author.id === myId;

  return (
    <Screen edges={['top']} scroll contentStyle={styles.content}>
      <Header
        title={formatPostDate(data.statusDate)}
        subtitle={isOwner ? undefined : `@${data.author.nickname}`}
        right={
          isOwner ? undefined : (
            <IconButton label={copy.safety.report} onPress={() => setMenuOpen(true)}>
              <Icon name="more" size={20} color={colors.text} />
            </IconButton>
          )
        }
      />

      <View
        style={[
          styles.stage,
          { backgroundColor: colors.stage, borderColor: colors.border },
        ]}
      >
        <PixelCharacter
          uri={data.characterImageUrl}
          size={200}
          idle
          accessibilityLabel={copy.a11y.thisDayPixel}
        />
      </View>

      {data.message ? (
        <Text variant="callout" align="center" style={styles.caption}>
          “{data.message}”
        </Text>
      ) : null}

      {data.mood ? (
        <Text
          variant="title2"
          align="center"
          style={styles.mood}
          accessibilityLabel={copy.a11y.mood(moodLabel(data.mood))}
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
        <Button
          label={copy.share.cta}
          variant="secondary"
          loading={sharing}
          onPress={() => void share()}
          style={styles.shareButton}
        />
      ) : (
        <Button
          label={copy.profile.view}
          variant="ghost"
          onPress={() => router.push(`/user/${data.author.id}`)}
          style={styles.profileButton}
        />
      )}

      {sheet}

      {/*
        Reporting the *post*, not its author. Guideline 1.2 asks for a way to
        flag objectionable content, and a user-level report cannot say which
        day's caption or character was the problem.
      */}
      <Sheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={formatPostDate(data.statusDate)}
      >
        <Button
          label={copy.safety.reportPost}
          variant="secondary"
          icon={<Icon name="flag" size={18} color={colors.text} />}
          onPress={() => {
            setMenuOpen(false);
            router.push({
              pathname: '/report',
              params: {
                targetType: 'DAILY_STATUS',
                targetId: data.id,
                nickname: data.author.nickname,
              },
            });
          }}
        />
      </Sheet>
    </Screen>
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
  profileButton: { marginTop: spacing.xxl },
  shareButton: { marginTop: spacing.xxl, alignSelf: 'center', minWidth: 200 },
});
