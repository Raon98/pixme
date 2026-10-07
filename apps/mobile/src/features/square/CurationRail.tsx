import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { SquareCuration, SquareCurationEntry } from '@/api';
import { moodEmoji } from '@/constants/moods';
import { opacity, radius, spacing, useTheme } from '@/theme';
import { PixelCharacter, Text } from '@/ui';

/**
 * Curation rails above the square.
 *
 * Product constraint we hold to: no ranks, no numbers, no "1위". The server
 * mixes heart count with reaction rate, recency, a new-user boost and a
 * diversity term precisely so the same popular faces don't occupy the rail
 * every day — this component therefore renders an unordered row, never a
 * leaderboard.
 */
export function CurationRail({
  curation,
  onSelect,
}: {
  curation: SquareCuration;
  onSelect: (entry: SquareCurationEntry) => void;
}) {
  const { colors } = useTheme();
  if (curation.entries.length === 0) return null;

  return (
    <View style={styles.root}>
      <Text variant="label" tone="secondary" style={styles.title}>
        {curation.title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {curation.entries.map((entry) => (
          <Pressable
            key={entry.postId}
            accessibilityRole="button"
            accessibilityLabel={`${entry.nickname}의 PIXME 보기`}
            onPress={() => onSelect(entry)}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? opacity.pressed : 1,
              },
            ]}
          >
            <PixelCharacter uri={entry.characterImageUrl} size={56} />
            <Text variant="micro" numberOfLines={1} style={styles.name}>
              {entry.nickname}
              {entry.mood ? ` ${moodEmoji(entry.mood)}` : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.base },
  title: { marginBottom: spacing.sm },
  row: { paddingRight: spacing.lg },
  item: {
    width: 76,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  name: { marginTop: spacing.xs, maxWidth: 64, textAlign: 'center' },
});
