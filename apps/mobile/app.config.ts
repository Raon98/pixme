import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * PIXME — Expo app config.
 *
 * Every environment-specific value is read from the environment so that the
 * same source tree can be built for dev / staging / production without edits.
 * Nothing secret belongs here: the client never holds AI or storage keys.
 */
const BUNDLE_ID = process.env.PIXME_BUNDLE_ID ?? 'com.pixme.app';
const VARIANT = process.env.PIXME_VARIANT ?? 'production';
const IS_PROD = VARIANT === 'production';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PROD ? 'PIXME' : `PIXME (${VARIANT})`,
  slug: 'pixme',
  scheme: 'pixme',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  /**
   * The product, its support channel and its App Store listing are Korean —
   * `ko` stays the development region below, which is what sets the listing's
   * primary language and what iOS falls back to for any locale we do not
   * ship. Declaring the locales here (rather than letting the build default
   * to en) is what makes iOS show system dialogs — permissions, the Apple
   * Sign In sheet, StoreKit purchase prompts — in the user's language.
   *
   * <p>These files hold *native* strings only. In-app copy is localised
   * separately, in `src/constants/copy.*.ts`.
   */
  locales: { ko: './locales/ko.json', en: './locales/en.json' },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_PROD ? BUNDLE_ID : `${BUNDLE_ID}.${VARIANT}`,
    buildNumber: process.env.PIXME_IOS_BUILD_NUMBER ?? '1',
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      CFBundleDisplayName: 'PIXME',
      /**
       * Primary language of the bundle; without it iOS assumes en. Korean
       * stays primary — it is also the in-app fallback for every non-English
       * device.
       */
      CFBundleDevelopmentRegion: 'ko',
      CFBundleLocalizations: ['ko', 'en'],
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        '오늘의 PIXME 캐릭터를 만들기 위해 사진을 촬영합니다.',
      NSPhotoLibraryUsageDescription:
        '오늘의 PIXME 캐릭터를 만들기 위해 사진을 선택합니다.',
      NSPhotoLibraryAddUsageDescription:
        '만들어진 PIXME 캐릭터를 사진에 저장합니다.',
      // The kakao-login plugin below adds these itself (plus
      // storykompassauth) — kept here too only so a build still declares
      // them correctly if the plugin's merge ever no-ops on a rebuild.
      LSApplicationQueriesSchemes: [
        'kakaokompassauth',
        'kakaolink',
        // Required before iOS will report Instagram as installed, which is
        // what the story hand-off checks.
        'instagram-stories',
      ],
    },
  },
  android: {
    package: IS_PROD ? BUNDLE_ID : `${BUNDLE_ID}.${VARIANT}`,
    versionCode: Number(process.env.PIXME_ANDROID_VERSION_CODE ?? 1),
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#7C6CF0',
    },
    permissions: ['CAMERA', 'READ_MEDIA_IMAGES', 'POST_NOTIFICATIONS'],
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro', output: 'single' },
  plugins: [
    'expo-router',
    '@sentry/react-native',
    'expo-secure-store',
    'expo-apple-authentication',
    'expo-web-browser',
    'expo-asset',
    'expo-localization',
    [
      'expo-image-picker',
      {
        photosPermission:
          '오늘의 PIXME 캐릭터를 만들기 위해 사진을 선택합니다.',
        cameraPermission: '오늘의 PIXME 캐릭터를 만들기 위해 사진을 촬영합니다.',
        // Stills only — declaring a microphone purpose string for a capability
        // the app never exercises is a 5.1.1 rejection.
        microphonePermission: false,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#7C6CF0',
        defaultChannel: 'default',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#FFFDF8',
      },
    ],
    ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
    [
      '@react-native-seoul/kakao-login',
      {
        // The app's *native* Kakao key (from 플랫폼 설정, not the REST API
        // key) — public by design, the same way a bundle id is: it is baked
        // into the app binary and visible to anyone who inspects it. What
        // stays secret is the REST API client secret, which only the server
        // ever holds.
        kakaoAppKey: process.env.PIXME_KAKAO_NATIVE_APP_KEY ?? '',
      },
    ],
  ],
  experiments: { typedRoutes: true, tsconfigPaths: true },
  extra: {
    variant: VARIANT,
    apiBaseUrl:
      process.env.PIXME_API_BASE_URL ?? 'https://pixme-api.mohae.xyz/api/v1',
    wsBaseUrl: process.env.PIXME_WS_BASE_URL ?? 'wss://pixme-api.mohae.xyz/ws',
    kakaoRestApiKey: process.env.PIXME_KAKAO_REST_API_KEY ?? '',
    kakaoNativeAppKey: process.env.PIXME_KAKAO_NATIVE_APP_KEY ?? '',
    sentryDsn: process.env.PIXME_SENTRY_DSN ?? '',
    // Instagram requires an attributed app id to open a story draft. Absent
    // is a supported state: sharing falls back to the system share sheet.
    facebookAppId: process.env.PIXME_FACEBOOK_APP_ID ?? '',
    termsUrl: process.env.PIXME_TERMS_URL ?? 'https://pixme.mohae.xyz/terms',
    privacyUrl:
      process.env.PIXME_PRIVACY_URL ?? 'https://pixme.mohae.xyz/privacy',
    // No default on purpose. This address is published to users, and the
    // previous fallback was a personal Gmail that would have shipped
    // silently — unset means "use the support page" below, which is the
    // same URL already registered with App Store Connect.
    supportEmail: process.env.PIXME_SUPPORT_EMAIL ?? '',
    supportUrl:
      process.env.PIXME_SUPPORT_URL ?? 'https://pixme.mohae.xyz/support',
    // Not a secret — a project id is just a public identifier (visible in
    // the project's own dashboard URL). Hardcoded as the default because
    // `eas` subcommands (credentials, update, submit) evaluate this config
    // without loading `.env` the way `expo` commands do, so an env-only
    // value left this blank for them even with .env set correctly.
    eas: {
      projectId:
        process.env.EAS_PROJECT_ID ?? '39767569-78b0-441a-bab6-eb3d8e866fcf',
    },
  },
  owner: process.env.EXPO_OWNER ?? 'sungcheol98',
  /**
   * OTA updates — a JS-only change (copy, a style, a bug fix with no new
   * native dependency) ships by running `eas update`, and installed apps
   * pick it up on next launch. No store review, no build.
   *
   * <p>`fallbackToCacheTimeout: 0` means the app never blocks startup
   * waiting on the update check — it opens with whatever it already has and
   * checks in the background, so a slow network never shows a frozen
   * splash screen.
   *
   * <p>A *native* change (a new package, an Info.plist entry, anything
   * under `ios:`/`android:` above) still needs a real build — OTA only ever
   * replaces the JS bundle, never the native shell.
   */
  updates: {
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID ?? '39767569-78b0-441a-bab6-eb3d8e866fcf'}`,
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: { policy: 'appVersion' },
});
