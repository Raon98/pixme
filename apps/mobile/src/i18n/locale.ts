/** The locales PIXME ships in-app copy for. */
export const SUPPORTED_LOCALES = ['ko', 'en'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Korean is the product's language, not merely its first translation: it is
 * both the default and the fallback. English is opt-in by device language, so
 * anything that is not `en*` (including an unreadable or missing device locale)
 * resolves to Korean.
 */
export const DEFAULT_LOCALE: AppLocale = 'ko';

/** `en`, `en-US`, `EN_gb` → 'en'. Everything else → 'ko'. */
export function localeFromTag(tag: string | null | undefined): AppLocale {
  if (!tag) return DEFAULT_LOCALE;
  const language = tag.trim().toLowerCase().split(/[-_]/)[0];
  return language === 'en' ? 'en' : DEFAULT_LOCALE;
}

/**
 * Reads the device language once, at startup.
 *
 * <p>Deliberately not reactive: `copy` is a plain object read inline by
 * hundreds of render paths, so re-resolving it mid-session would leave a
 * half-translated screen on screen. iOS and Android both restart the app when
 * the user changes system language, which is when this runs again.
 *
 * <p>`getLocales()` is synchronous native state and should never throw, but a
 * missing native module (a build taken before `expo-localization` was added
 * to the native project, a bare web bundle, a unit test without the Expo
 * mock) throws the moment the module is evaluated — a static `import` at the
 * top of this file would crash before this function even runs, taking the
 * whole app down with it. Required lazily, inside the same try, so a missing
 * native module just falls back to Korean like any other failure here.
 */
export function resolveDeviceLocale(): AppLocale {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require('expo-localization');
    const locales = getLocales();
    for (const locale of locales) {
      const resolved = localeFromTag(
        locale.languageCode ?? locale.languageTag,
      );
      // The first entry we can read wins: the list is in the user's own
      // preference order.
      if (locale.languageCode || locale.languageTag) return resolved;
    }
  } catch {
    // fall through
  }
  return DEFAULT_LOCALE;
}
