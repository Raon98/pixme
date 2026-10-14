import Constants from 'expo-constants';

/**
 * Typed access to `app.config.ts` → `extra`.
 *
 * Nothing in here may be secret: this object is readable from the shipped
 * bundle. AI provider keys, storage credentials and IAP shared secrets live on
 * the server only.
 */
interface RawExtra {
  variant?: string;
  apiBaseUrl?: string;
  wsBaseUrl?: string;
  kakaoRestApiKey?: string;
  kakaoNativeAppKey?: string;
  supportUrl?: string;
  facebookAppId?: string;
  termsUrl?: string;
  privacyUrl?: string;
  supportEmail?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as RawExtra;

function required(value: string | undefined, name: string): string {
  if (!value) {
    // Fail loudly in dev, degrade gracefully in release builds.
    if (__DEV__) {
      throw new Error(
        `[PIXME config] Missing required value "${name}". Add it to .env / EAS secrets.`,
      );
    }
    return '';
  }
  return value;
}

export type AppVariant = 'development' | 'staging' | 'production';

export const config = {
  variant: (extra.variant ?? 'production') as AppVariant,
  isProduction: (extra.variant ?? 'production') === 'production',
  appVersion: Constants.expoConfig?.version ?? '1.0.0',
  buildNumber:
    Constants.expoConfig?.ios?.buildNumber ??
    String(Constants.expoConfig?.android?.versionCode ?? '1'),

  apiBaseUrl: required(extra.apiBaseUrl, 'apiBaseUrl'),
  wsBaseUrl: required(extra.wsBaseUrl, 'wsBaseUrl'),

  kakao: {
    restApiKey: extra.kakaoRestApiKey ?? '',
    nativeAppKey: extra.kakaoNativeAppKey ?? '',
  },


  share: {
    /** Empty when unset — the story hand-off degrades to the share sheet. */
    facebookAppId: extra.facebookAppId ?? '',
  },

  links: {
    terms: extra.termsUrl ?? 'https://pixme.app/terms',
    privacy: extra.privacyUrl ?? 'https://pixme.app/privacy',
    /**
     * A mailto only when an address is actually configured; otherwise the
     * published support page. Guideline 1.2 wants reachable contact info,
     * and a mailto to an unset address is worse than a page that exists.
     */
    support: extra.supportEmail
      ? `mailto:${extra.supportEmail}`
      : (extra.supportUrl ?? 'https://pixme.mohae.xyz/support'),
  },

  /** Network behaviour. */
  http: {
    timeoutMs: 20_000,
    /** Image generation polling can legitimately take a while. */
    generationTimeoutMs: 120_000,
    retryCount: 2,
  },

  /** Product rules the client needs to know to render correct copy. */
  rules: {
    /** A user publishes exactly one representative PIXME per day. */
    representativePixelsPerDay: 1,
    minNicknameLength: 2,
    maxNicknameLength: 12,
    maxBioLength: 60,
    maxCaptionLength: 60,
    maxTagsPerPost: 4,
    minInterests: 1,
    maxInterests: 8,
    minAge: 14,
    feedPageSize: 10,
    squarePageSize: 40,
    historyPageSize: 30,
    chatPageSize: 40,
  },
} as const;
