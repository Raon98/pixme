import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { moodEmoji } from '@/constants/moods';
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  palette,
  radius,
  spacing,
} from '@/theme';

/**
 * Logical size of the card. Captured at 3× for a 1080×1920 story.
 */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 640;
export const SHARE_CARD_PIXEL_RATIO = 3;

export interface ShareCardProps {
  characterUrl: string | null;
  mood: string | null;
  message: string | null;
  /** Already formatted for display. */
  dateLabel: string;
}

interface ShareCardInternalProps extends ShareCardProps {
  /** Fired once the character has painted, so a capture cannot come out blank. */
  onCharacterReady?: () => void;
}

/**
 * The image a PIXME day becomes when it leaves the app.
 *
 * <p>Reads raw tokens rather than the active theme on purpose. A profile theme
 * recolours the app for its owner, but the card is seen by people who have
 * never opened PIXME — it has to look the same every time, and it has to look
 * like the product rather than like whatever skin the sender happens to own.
 *
 * <p>Same art direction as the app: warm paper, one soft violet accent, and
 * nothing competing with the character for saturation. No frame, no badge, no
 * drop shadow — the whitespace is the design.
 */
export function ShareCard({
  characterUrl,
  mood,
  message,
  dateLabel,
  onCharacterReady,
}: ShareCardInternalProps) {
  return (
    <View style={styles.card}>
      <View style={styles.stage}>
        {/* Grounds the character so it reads as standing, not floating. */}
        <View style={styles.shadow} />
        {characterUrl ? (
          <Image
            source={{ uri: characterUrl }}
            style={styles.character}
            contentFit="contain"
            onLoadEnd={onCharacterReady}
          />
        ) : null}
      </View>

      {mood ? <Text style={styles.mood}>{moodEmoji(mood)}</Text> : null}

      {message ? (
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.date}>{dateLabel}</Text>
        <Text style={styles.wordmark}>PIXME</Text>
      </View>
    </View>
  );
}

const CHARACTER_SIZE = 240;

/**
 * Space held for the date + wordmark. The content group centres in what is
 * left, so the character sits optically centred rather than drifting toward
 * the top with a dead band underneath it.
 */
const FOOTER_RESERVE = 104;

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: palette.paper[50],
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: FOOTER_RESERVE,
    paddingHorizontal: spacing.xxl,
  },
  stage: {
    width: CHARACTER_SIZE,
    height: CHARACTER_SIZE,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  shadow: {
    position: 'absolute',
    bottom: 4,
    width: CHARACTER_SIZE * 0.5,
    height: 14,
    borderRadius: radius.full,
    backgroundColor: palette.violet[500],
    opacity: 0.07,
  },
  character: { width: CHARACTER_SIZE, height: CHARACTER_SIZE },
  mood: {
    marginTop: spacing.xxl - spacing.xxs,
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
  },
  message: {
    marginTop: spacing.md,
    maxWidth: 272,
    textAlign: 'center',
    color: palette.paper[800],
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.medium,
  },
  footer: {
    position: 'absolute',
    bottom: spacing.huge,
    alignItems: 'center',
  },
  date: {
    color: palette.paper[400],
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    letterSpacing: letterSpacing.wider,
  },
  wordmark: {
    marginTop: spacing.md,
    color: palette.violet[500],
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.sm,
    letterSpacing: letterSpacing.wider,
  },
});
