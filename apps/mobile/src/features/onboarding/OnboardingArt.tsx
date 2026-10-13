import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';
import { Icon } from '@/ui';

/**
 * Onboarding illustrations.
 *
 * Built from the design system's own primitives rather than shipped artwork:
 * the real pixel characters are user-generated, so a stock illustration of a
 * character would misrepresent what the user is about to get. Each panel
 * instead shows the *mechanic* — photo → pixel grid, a small crowd, and the
 * two reactions.
 */
export function OnboardingArt({ index }: { index: number }) {
  const { colors } = useTheme();

  if (index === 0) {
    return (
      <View style={styles.root}>
        <View style={[styles.photo, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
          <Icon name="camera" size={34} color={colors.textTertiary} />
        </View>
        <Icon name="chevron-right" size={22} color={colors.textTertiary} />
        <View style={styles.grid}>
          {Array.from({ length: 16 }).map((_, cell) => (
            <View
              key={cell}
              style={[
                styles.cell,
                {
                  backgroundColor:
                    PIXEL_MASK[cell] === 1
                      ? colors.accent
                      : PIXEL_MASK[cell] === 2
                        ? colors.wave
                        : colors.surfaceSubtle,
                },
              ]}
            />
          ))}
        </View>
      </View>
    );
  }

  if (index === 1) {
    return (
      <View style={styles.root}>
        {[0, 1, 2].map((slot) => (
          <View
            key={slot}
            style={[
              styles.crowdMember,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.border,
                marginTop: slot === 1 ? -spacing.base : spacing.base,
              },
            ]}
          >
            <Icon name="user" size={26} color={colors.textTertiary} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.reaction, { backgroundColor: colors.heartSubtle }]}>
        <Icon name="heart-filled" size={30} color={colors.heart} />
      </View>
      <View style={[styles.reaction, { backgroundColor: colors.waveSubtle }]}>
        <Icon name="wave" size={30} color={colors.wave} />
      </View>
    </View>
  );
}

/** 4x4 silhouette: 1 = body, 2 = accent (a hat), 0 = empty. */
const PIXEL_MASK = [0, 2, 2, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0];

const styles = StyleSheet.create({
  root: {
    height: 170,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: 84,
    height: 104,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  grid: {
    width: 88,
    height: 88,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: spacing.md,
  },
  cell: { width: 20, height: 20, margin: 1, borderRadius: radius.pixel },
  crowdMember: {
    width: 74,
    height: 74,
    borderRadius: radius.base,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xs,
  },
  reaction: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
  },
});
