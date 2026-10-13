import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { SquareCuration, SquareCurationEntry } from '@/api';
import { copy } from '@/constants/copy';
import { moodEmoji } from '@/constants/moods';
import { opacity, radius, spacing, useTheme } from '@/theme';
import { PixelCharacter, Text } from '@/ui';

/**
 * Curation rails above the square.
 *
 * Product constraint we hold to: no ranks, no numbers, no "#1". The server
 * mixes heart count with reaction rate, recency, a new-user boost and a
 * diversity term precisely so the same popular faces don't occupy the rail
 * every day — this component therefore renders an unordered row, never a
 * leaderboard.
 *
 * <p>Visually the entries are *scenes*, not list rows: each character stands
 * on its own tinted ground with its name resting on it. Bordered boxes read
 * as a table of records, which is exactly the leaderboard feeling the product
 * is trying not to have.
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
      <View style={styles.titleRow}>
        <Text variant="label" tone="secondary" style={styles.title}>
          {curation.title}
        </Text>
        <Text variant="micro" tone="tertiary">
          {copy.square.peopleCount(curation.entries.length)}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {curation.entries.map((entry) => (
          <Pressable
            key={entry.userId}
            accessibilityRole="button"
            accessibilityLabel={copy.a11y.userPixelOpen(entry.nickname)}
            onPress={() => onSelect(entry)}
            style={({ pressed }) => [
              styles.item,
              { opacity: pressed ? opacity.pressed : 1 },
            ]}
          >
            <View style={[styles.stage, { backgroundColor: colors.surfaceSubtle }]}>
              <LinearGradient
                colors={['transparent', colors.surface]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <PixelCharacter uri={entry.characterImageUrl} size={64} />
              <View style={styles.stageShadow} pointerEvents="none" />
            </View>

            <Text variant="micro" numberOfLines={1} style={styles.name}>
              {entry.nickname}
            </Text>
            {entry.mood ? (
              <Text variant="micro" style={styles.mood}>
                {moodEmoji(entry.mood)}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.base },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { flexShrink: 1 },
  row: { paddingRight: spacing.lg, gap: spacing.sm },
  item: { width: 78, alignItems: 'center' },
  stage: {
    width: 78,
    height: 86,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xs,
    overflow: 'hidden',
  },
  stageShadow: {
    position: 'absolute',
    bottom: 10,
    width: 34,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#000000',
    opacity: 0.12,
  },
  name: { marginTop: spacing.xs, maxWidth: 74, textAlign: 'center' },
  mood: { marginTop: 1 },
});
