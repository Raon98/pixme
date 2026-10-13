import { en } from './copy.en';
import { ko } from './copy.ko';
import type { Copy, CopyBundle } from './copy.types';
import { resolveDeviceLocale, type AppLocale } from '@/i18n/locale';

export type { Copy, CopyBundle } from './copy.types';
export type { AppLocale } from '@/i18n/locale';

/** Every shipped bundle, keyed by the locale it serves. */
const BUNDLES: Record<AppLocale, CopyBundle> = { ko, en };

/**
 * The locale this session is running in — resolved once, from the device
 * language, at import time. Anything that is not an English device gets
 * Korean.
 */
export const locale: AppLocale = resolveDeviceLocale();

/**
 * Centralised user-facing copy.
 *
 * PIXME's voice: short, warm, lowercase-ish, never evaluative. We never say
 * "다음", "패스", "싫어요" about another person, and never frame the product
 * as matching or rating. Keeping the strings in one place is what makes that
 * reviewable — and what made localisation a swap rather than a rewrite.
 *
 * <p>The surface is unchanged: this is still a plain nested object read as
 * `copy.today.title` or `copy.generation.balance(5)`, with no hook, no
 * provider and no `t()` call. What changed is where the values come from —
 * `copy.ko.ts` is the shape of record (and the fallback), `copy.en.ts` is
 * checked against it by the type system, and this module picks one.
 *
 * <p>Resolution happens at module load, not per read, so there is no proxy or
 * getter overhead on a render path. See `@/i18n/locale` for why the choice is
 * not reactive.
 */
export const copy: Copy = BUNDLES[locale] ?? ko;
