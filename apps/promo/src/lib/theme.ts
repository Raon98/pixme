/**
 * 영상 전체가 앱의 실제 디자인 토큰을 따른다 — apps/mobile/src/theme/tokens.ts
 * 의 warm paper 뉴트럴 + soft violet 액센트를 그대로 복사한 것.
 */
export const color = {
  paper: '#FBF7EF',
  paperDeep: '#F5F0E6',
  ink: '#1A1816',
  inkSoft: '#4C4740',
  inkFaint: '#8E8778',
  accent: '#7C6CF0',
  accentDeep: '#6453DD',
  accentSoft: '#E6E2FD',
  heart: '#F04F79',
  white: '#FFFFFF',
  bezel: '#2E2B26',
} as const;

export const font = {
  black: 'Pretendard Black',
  extraBold: 'Pretendard ExtraBold',
  bold: 'Pretendard Bold',
  semi: 'Pretendard SemiBold',
  medium: 'Pretendard Medium',
  regular: 'Pretendard Regular',
} as const;
