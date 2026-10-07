import { useEffect } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { layout, radius, spacing, useTheme } from '@/theme';

export interface SkeletonProps {
  width?: ViewStyle['width'];
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A single shimmering block. Prefer the composed skeletons below. */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = radius.sm,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0.6);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 820, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius, backgroundColor: colors.skeleton },
        animated,
        style,
      ]}
    />
  );
}

/** Matches the vertical feed card so the swap-in doesn't shift layout. */
export function FeedCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.feedCard, { backgroundColor: colors.stage }]}>
      <View style={styles.feedHeader}>
        <Skeleton width={120} height={18} />
        <Skeleton width={56} height={12} style={{ marginTop: spacing.xs }} />
      </View>
      <Skeleton
        width={220}
        height={220}
        borderRadius={radius.lg}
        style={{ alignSelf: 'center' }}
      />
      <View style={styles.feedFooter}>
        <Skeleton width="60%" height={20} />
        <View style={styles.row}>
          <Skeleton width={64} height={28} borderRadius={radius.full} />
          <Skeleton
            width={64}
            height={28}
            borderRadius={radius.full}
            style={{ marginLeft: spacing.sm }}
          />
        </View>
      </View>
    </View>
  );
}

export function ProfileSkeleton() {
  return (
    <View style={{ paddingVertical: spacing.lg }}>
      <Skeleton
        width={120}
        height={120}
        borderRadius={radius.lg}
        style={{ alignSelf: 'center' }}
      />
      <Skeleton
        width={140}
        height={24}
        style={{ alignSelf: 'center', marginTop: spacing.base }}
      />
      <Skeleton
        width={200}
        height={16}
        style={{ alignSelf: 'center', marginTop: spacing.sm }}
      />
      <View style={[styles.row, { marginTop: spacing.xl }]}>
        <Skeleton width={72} height={28} borderRadius={radius.full} />
        <Skeleton
          width={72}
          height={28}
          borderRadius={radius.full}
          style={{ marginLeft: spacing.sm }}
        />
        <Skeleton
          width={72}
          height={28}
          borderRadius={radius.full}
          style={{ marginLeft: spacing.sm }}
        />
      </View>
    </View>
  );
}

export function GridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          width="31%"
          height={112}
          borderRadius={radius.md}
          style={{ marginBottom: spacing.sm }}
        />
      ))}
    </View>
  );
}

export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.listRow}>
          <Skeleton width={48} height={48} borderRadius={radius.base} />
          <View style={styles.listRowBody}>
            <Skeleton width="45%" height={16} />
            <Skeleton
              width="70%"
              height={13}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  feedCard: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    justifyContent: 'space-between',
    marginHorizontal: layout.gutter,
  },
  feedHeader: { alignItems: 'flex-start' },
  feedFooter: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  listRowBody: { flex: 1, marginLeft: spacing.md },
});
