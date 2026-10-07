import {
  differenceInMinutes,
  differenceInYears,
  format,
  isToday,
  isYesterday,
  parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';

/** All server timestamps are ISO-8601 UTC strings. */
export function toDate(iso: string | Date): Date {
  return typeof iso === 'string' ? parseISO(iso) : iso;
}

/**
 * Relative time for feed cards / chat list. Korean, short form.
 *  "방금", "12분 전", "3시간 전", "어제", "10월 2일"
 */
export function formatRelative(iso: string | Date): string {
  const date = toDate(iso);
  const minutes = differenceInMinutes(new Date(), date);

  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (isToday(date)) return `${Math.floor(minutes / 60)}시간 전`;
  if (isYesterday(date)) return '어제';
  return format(date, 'M월 d일', { locale: ko });
}

/** Chat bubble timestamp: "오후 3:21" */
export function formatClock(iso: string | Date): string {
  return format(toDate(iso), 'a h:mm', { locale: ko });
}

/** Chat list timestamp: today → clock, this year → "10월 2일", else "2025.10.2" */
export function formatConversationTime(iso: string | Date): string {
  const date = toDate(iso);
  if (isToday(date)) return format(date, 'a h:mm', { locale: ko });
  if (isYesterday(date)) return '어제';
  if (date.getFullYear() === new Date().getFullYear()) {
    return format(date, 'M월 d일', { locale: ko });
  }
  return format(date, 'yyyy.M.d');
}

/** History detail header: "10월 7일 화요일" */
export function formatPostDate(iso: string | Date): string {
  return format(toDate(iso), 'M월 d일 EEEE', { locale: ko });
}

/** History grid month header: "2026년 10월" */
export function formatMonthTitle(iso: string | Date): string {
  return format(toDate(iso), 'yyyy년 M월', { locale: ko });
}

/** `postDate` is a plain calendar date (YYYY-MM-DD) in the user's timezone. */
export function todayPostDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDayNumber(iso: string | Date): string {
  return format(toDate(iso), 'd');
}

export function calculateAge(birthDate: string): number {
  return differenceInYears(new Date(), toDate(birthDate));
}

/** 1200 → "1.2천", 34000 → "3.4만" */
export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 10_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}천`;
  return `${(value / 10_000).toFixed(1).replace(/\.0$/, '')}만`;
}

/** Unread badge cap. */
export function formatBadge(value: number): string {
  return value > 99 ? '99+' : String(value);
}

/**
 * Prices come from the store as localised strings; this is only the fallback
 * used when a product failed to load from the store. Never hardcode a price
 * as the primary source of truth.
 */
export function formatKrw(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
