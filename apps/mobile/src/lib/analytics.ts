import { logger } from './logger';
import { storage, StorageKey } from './storage';

/**
 * Product analytics.
 *
 * Privacy rule (hard): event properties never contain personal data — no
 * nickname, bio, caption text, email, image URL or raw photo reference. Only
 * ids, enums, counts and durations. The server mirrors this rule.
 */
export const AnalyticsEvent = {
  SignUp: 'SIGN_UP',
  SignIn: 'SIGN_IN',
  OnboardingCompleted: 'ONBOARDING_COMPLETED',
  ProfileSetupCompleted: 'PROFILE_SETUP_COMPLETED',

  PixelGenerationStarted: 'PIXEL_GENERATION_STARTED',
  PixelGenerationCompleted: 'PIXEL_GENERATION_COMPLETED',
  PixelGenerationFailed: 'PIXEL_GENERATION_FAILED',
  PixelGenerationRetry: 'PIXEL_GENERATION_RETRY',
  PixelKept: 'PIXEL_KEPT',
  DailyStatusUpdated: 'DAILY_STATUS_UPDATED',

  FeedCardViewed: 'FEED_CARD_VIEWED',
  HeartSent: 'HEART_SENT',
  HeartRemoved: 'HEART_REMOVED',
  ConnectionRequestSent: 'CONNECTION_REQUEST_SENT',
  ConnectionCreated: 'CONNECTION_CREATED',
  ChatStarted: 'CHAT_STARTED',
  MessageSent: 'MESSAGE_SENT',

  SquareOpened: 'SQUARE_OPENED',
  SquareProfileOpened: 'SQUARE_PROFILE_OPENED',

  StoreOpened: 'STORE_OPENED',
  CreditPurchased: 'CREDIT_PURCHASED',
  SubscriptionStarted: 'SUBSCRIPTION_STARTED',
  PurchaseFailed: 'PURCHASE_FAILED',

  UserReported: 'USER_REPORTED',
  UserBlocked: 'USER_BLOCKED',
  AccountDeleted: 'ACCOUNT_DELETED',
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

export type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

const log = logger('analytics');

/** Swap this for Amplitude / PostHog / GA without touching call sites. */
export interface AnalyticsSink {
  identify(userId: string | null): void | Promise<void>;
  track(name: AnalyticsEventName, props?: AnalyticsProps): void | Promise<void>;
  screen(name: string, props?: AnalyticsProps): void | Promise<void>;
  flush?(): void | Promise<void>;
}

/** Dev / no-provider sink: logs locally, drops nothing on the network. */
const consoleSink: AnalyticsSink = {
  identify: (userId) => log.debug('identify', { userId }),
  track: (name, props) => log.debug(`track ${name}`, props),
  screen: (name, props) => log.debug(`screen ${name}`, props),
};

let sink: AnalyticsSink = consoleSink;
let anonymousId: string | null = null;

const FORBIDDEN_KEYS = [
  'nickname',
  'bio',
  'caption',
  'email',
  'phone',
  'imageUrl',
  'originalImageUrl',
  'message',
  'content',
  'birthDate',
];

function scrub(props?: AnalyticsProps): AnalyticsProps | undefined {
  if (!props) return undefined;
  const out: AnalyticsProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (FORBIDDEN_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      if (__DEV__) {
        log.warn(`dropped personal property "${key}" from analytics payload`);
      }
      continue;
    }
    out[key] = value;
  }
  return out;
}

export const analytics = {
  configure(next: AnalyticsSink) {
    sink = next;
  },

  async bootstrap() {
    anonymousId = await storage.getItem<string>(
      StorageKey.AnalyticsAnonymousId,
    );
    if (!anonymousId) {
      anonymousId = `anon_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      await storage.setItem(StorageKey.AnalyticsAnonymousId, anonymousId);
    }
  },

  identify(userId: string | null) {
    void sink.identify(userId);
  },

  track(name: AnalyticsEventName, props?: AnalyticsProps) {
    void sink.track(name, scrub(props));
  },

  screen(name: string, props?: AnalyticsProps) {
    void sink.screen(name, scrub(props));
  },

  get anonymousId() {
    return anonymousId;
  },
};
