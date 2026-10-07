/**
 * Mood is a closed enum, not free emoji input: it keeps the feed tonally
 * consistent and makes "today's mood" filterable later.
 */
export const MOODS = [
  { code: 'HAPPY', emoji: '😊', label: '좋아요' },
  { code: 'LOVELY', emoji: '🥰', label: '설레요' },
  { code: 'SLEEPY', emoji: '😴', label: '졸려요' },
  { code: 'BLANK', emoji: '😶', label: '그냥' },
  { code: 'MELTED', emoji: '🫠', label: '녹았어요' },
  { code: 'TEARY', emoji: '🥲', label: '그래도' },
  { code: 'COOL', emoji: '😎', label: '좀 괜찮' },
  { code: 'CHAOS', emoji: '🤯', label: '정신없어요' },
] as const;

export type MoodCode = (typeof MOODS)[number]['code'];

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
