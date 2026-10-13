import { copy } from './copy';

/**
 * Interests are a server-owned taxonomy (table `interest`), but the client
 * ships this list as the offline fallback and for icon/label mapping. Codes
 * must stay in sync with `V2__seed_interests.sql`.
 */
export interface InterestOption {
  code: string;
  label: string;
  emoji: string;
}

const INTEREST_CODES = [
  { code: 'MUSIC', emoji: '🎧' },
  { code: 'CAFE', emoji: '☕️' },
  { code: 'MOVIE', emoji: '🎬' },
  { code: 'TRAVEL', emoji: '✈️' },
  { code: 'WORKOUT', emoji: '🏃' },
  { code: 'WALK', emoji: '🌿' },
  { code: 'GAME', emoji: '🎮' },
  { code: 'FASHION', emoji: '🧥' },
  { code: 'FOOD', emoji: '🍜' },
  { code: 'PHOTO', emoji: '📷' },
  { code: 'EXHIBITION', emoji: '🖼' },
  { code: 'READING', emoji: '📚' },
] as const;

/** Labels come from the active locale; codes stay the server's. */
export const INTERESTS: readonly InterestOption[] = INTEREST_CODES.map(
  (interest) => ({
    ...interest,
    label:
      copy.interests[interest.code as keyof typeof copy.interests] ??
      interest.code,
  }),
);

export const INTEREST_BY_CODE: Record<string, InterestOption> =
  Object.fromEntries(INTERESTS.map((i) => [i.code, i]));

export function interestLabel(code: string): string {
  return INTEREST_BY_CODE[code]?.label ?? code;
}
