import { copy } from './copy';

/**
 * Mood is a closed enum, not free emoji input: it keeps the feed tonally
 * consistent and makes "today's mood" filterable later.
 */
const MOOD_CODES = [
  { code: 'HAPPY', emoji: '😊' },
  { code: 'LOVELY', emoji: '🥰' },
  { code: 'SLEEPY', emoji: '😴' },
  { code: 'BLANK', emoji: '😶' },
  { code: 'MELTED', emoji: '🫠' },
  { code: 'TEARY', emoji: '🥲' },
  { code: 'COOL', emoji: '😎' },
  { code: 'CHAOS', emoji: '🤯' },
] as const;

/**
 * The code and the emoji are the same in every language; only the label
 * changes, so it is read from the active bundle rather than stored here.
 */
export const MOODS = MOOD_CODES.map((mood) => ({
  ...mood,
  label: copy.moods[mood.code],
}));

export type MoodCode = (typeof MOOD_CODES)[number]['code'];

export const MOOD_BY_CODE = Object.fromEntries(
  MOODS.map((m) => [m.code, m]),
) as Record<MoodCode, (typeof MOODS)[number]>;

export function moodEmoji(code: string | null | undefined): string {
  if (!code) return '';
  return MOOD_BY_CODE[code as MoodCode]?.emoji ?? '';
}

export function moodLabel(code: string | null | undefined): string {
  if (!code) return '';
  return MOOD_BY_CODE[code as MoodCode]?.label ?? '';
}
