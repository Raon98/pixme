/**
 * Suggested tags shown on the publish screen. Users may also type their own;
 * the server normalises (trim, strip leading '#', lowercase-ascii, length cap)
 * and runs them through the text filter.
 */
export const SUGGESTED_TAGS: readonly string[] = [
  '카페',
  '산책',
  '출근',
  '운동',
  '여행',
  '데이트',
  '꾸안꾸',
  '올블랙',
  '집',
  '야행성',
  '퇴근',
  '주말',
  '비오는날',
  '교복',
  '오버핏',
] as const;

export const TAG_MAX_LENGTH = 12;

/** Mirrors the server's `TagNormalizer`. */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '')
    .slice(0, TAG_MAX_LENGTH);
}

export function formatTag(tag: string): string {
  return `#${tag}`;
}
