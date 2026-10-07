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
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_PROD ? BUNDLE_ID : `${BUNDLE_ID}.${VARIANT}`,
    buildNumber: process.env.PIXME_IOS_BUILD_NUMBER ?? '1',
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      CFBundleDisplayName: 'PIXME',
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        '오늘의 PIXME 캐릭터를 만들기 위해 사진을 촬영합니다.',
      NSPhotoLibraryUsageDescription:
        '오늘의 PIXME 캐릭터를 만들기 위해 사진을 선택합니다.',
      NSPhotoLibraryAddUsageDescription:
        '만들어진 PIXME 캐릭터를 사진에 저장합니다.',
      NSMicrophoneUsageDescription: '사용하지 않습니다.',
      LSApplicationQueriesSchemes: ['kakaokompassauth', 'kakaolink'],
    },
  },
  android: {
    package: IS_PROD ? BUNDLE_ID : `${BUNDLE_ID}.${VARIANT}`,
    versionCode: Number(process.env.PIXME_ANDROID_VERSION_CODE ?? 1),
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#FFFDF8',
    },
    permissions: ['CAMERA', 'READ_MEDIA_IMAGES', 'POST_NOTIFICATIONS'],
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro', output: 'single' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
    'expo-web-browser',
    'expo-asset',
    [
      'expo-image-picker',
      {
        photosPermission:
          '오늘의 PIXME 캐릭터를 만들기 위해 사진을 선택합니다.',
        cameraPermission: '오늘의 PIXME 캐릭터를 만들기 위해 사진을 촬영합니다.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#6C5CE7',
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
  ],
  experiments: { typedRoutes: true, tsconfigPaths: true },
  extra: {
    variant: VARIANT,
    apiBaseUrl:
      process.env.PIXME_API_BASE_URL ?? 'https://api.pixme.app/api/v1',
    wsBaseUrl: process.env.PIXME_WS_BASE_URL ?? 'wss://api.pixme.app/ws',
    kakaoRestApiKey: process.env.PIXME_KAKAO_REST_API_KEY ?? '',
    kakaoNativeAppKey: process.env.PIXME_KAKAO_NATIVE_APP_KEY ?? '',
    sentryDsn: process.env.PIXME_SENTRY_DSN ?? '',
    termsUrl: process.env.PIXME_TERMS_URL ?? 'https://pixme.app/terms',
    privacyUrl: process.env.PIXME_PRIVACY_URL ?? 'https://pixme.app/privacy',
    supportEmail: process.env.PIXME_SUPPORT_EMAIL ?? 'help@pixme.app',
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '' },
  },
  owner: process.env.EXPO_OWNER,
  updates: { fallbackToCacheTimeout: 0 },
  runtimeVersion: { policy: 'appVersion' },
});
