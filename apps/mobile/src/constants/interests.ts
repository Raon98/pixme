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

export const INTERESTS: readonly InterestOption[] = [
  { code: 'MUSIC', label: '음악', emoji: '🎧' },
  { code: 'CAFE', label: '카페', emoji: '☕️' },
  { code: 'MOVIE', label: '영화', emoji: '🎬' },
  { code: 'TRAVEL', label: '여행', emoji: '✈️' },
  { code: 'WORKOUT', label: '운동', emoji: '🏃' },
  { code: 'WALK', label: '산책', emoji: '🌿' },
  { code: 'GAME', label: '게임', emoji: '🎮' },
  { code: 'FASHION', label: '패션', emoji: '🧥' },
  { code: 'FOOD', label: '맛집', emoji: '🍜' },
  { code: 'PHOTO', label: '사진', emoji: '📷' },
  { code: 'EXHIBITION', label: '전시', emoji: '🖼' },
  { code: 'READING', label: '독서', emoji: '📚' },
] as const;

export const INTEREST_BY_CODE: Record<string, InterestOption> =
  Object.fromEntries(INTERESTS.map((i) => [i.code, i]));

export function interestLabel(code: string): string {
  return INTEREST_BY_CODE[code]?.label ?? code;
}
