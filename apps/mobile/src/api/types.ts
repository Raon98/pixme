/**
 * Wire types — the contract with the PIXME API (`/api/v1`).
 *
 * These mirror the server DTOs one-to-one. Notably absent from every response
 * a *third party* can read: `originalImageUrl`. The server only serialises it
 * on `/pixels/me` and `/pixels/{id}/original`, and only for the owner.
 */

/* ------------------------------------------------------------------ shared */

export interface Page<T> {
  items: T[];
  /** Opaque cursor; `null` when there is nothing more. */
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  /** Field-level validation errors, keyed by field name. */
  fieldErrors?: Record<string, string>;
  traceId?: string;
}

/* -------------------------------------------------------------------- auth */

export type AuthProvider = 'APPLE' | 'KAKAO';

export interface AppleAuthRequest {
  identityToken: string;
  authorizationCode?: string;
  /** Apple only returns these on first consent; forward them if present. */
  fullName?: string | null;
  email?: string | null;
  nonce?: string;
}

export interface KakaoAuthRequest {
  /** Kakao OAuth authorization code obtained via the in-app browser. */
  authorizationCode: string;
  redirectUri: string;
  codeVerifier?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until `accessToken` expires. */
  expiresIn: number;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: MeResponse;
  /** True when this call created the account (drives the SIGN_UP event). */
  isNewUser: boolean;
}

export interface RefreshRequest {
  refreshToken: string;
}

/* -------------------------------------------------------------------- user */

export type UserStatus = 'PENDING_PROFILE' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface MeResponse {
  id: string;
  provider: AuthProvider;
  nickname: string | null;
  bio: string | null;
  birthDate: string | null;
  status: UserStatus;
  /** True once nickname + birthDate + ≥1 interest exist. */
  profileCompleted: boolean;
  interests: string[];
  representativeCharacterUrl: string | null;
  stats: UserStats;
  entitlements: Entitlements;
  settings: UserSettings;
  createdAt: string;
}

export interface UserStats {
  receivedHeartCount: number;
  connectionCount: number;
  pixelCount: number;
  /** Consecutive days with a published representative PIXME. */
  streakDays: number;
}

/**
 * What a generation costs right now.
 *
 * <p>Free generation is an onboarding grant, not a daily allowance, so the
 * three free entitlements are separate: the retry is only reachable from the
 * first result screen, while the bonus credit can be spent any time.
 */
export interface Entitlements {
  plusActive: boolean;
  plusExpiresAt: string | null;
  /** The very first PIXME is still free. */
  firstGenerationAvailable: boolean;
  /** The one free retry of that first result. */
  firstRetryAvailable: boolean;
  /** Non-expiring free credits granted at sign-up. */
  bonusFreeCredits: number;
  /** Paid credits remaining. */
  creditBalance: number;
  /** Convenience: starting a new PIXME right now costs nothing. */
  nextGenerationIsFree: boolean;
  unlockedStyles: string[];
  unlockedDecorations: string[];
}

export interface UserSettings {
  pushHeart: boolean;
  pushConnectionRequest: boolean;
  pushConnected: boolean;
  pushMessage: boolean;
  pushDailyReminder: boolean;
  /** When false the server deletes the original photo after generation. */
  keepOriginalPhoto: boolean;
}

export interface UpdateMeRequest {
  nickname?: string;
  bio?: string | null;
  birthDate?: string;
  interests?: string[];
  settings?: Partial<UserSettings>;
}

export interface NicknameAvailability {
  available: boolean;
  reason?: 'TAKEN' | 'FORBIDDEN' | 'INVALID_FORMAT';
}

/** Another person's profile. Age and exact counts are intentionally coarse. */
export interface PublicProfile {
  id: string;
  nickname: string;
  bio: string | null;
  interests: string[];
  representativeCharacterUrl: string | null;
  todayPost: PixelPost | null;
  recentPosts: PixelPostSummary[];
  stats: { receivedHeartCount: number; pixelCount: number };
  relation: UserRelation;
}

export interface UserRelation {
  isMe: boolean;
  connectionStatus: ConnectionStatus;
  /** Set when a conversation already exists. */
  conversationId: string | null;
  heartedTodayPost: boolean;
  blockedByMe: boolean;
}

/* ------------------------------------------------------------------- pixel */

export type PixelStyle =
  | 'PIXME_BASIC'
  | 'Y2K_PIXEL'
  | 'BIT_16'
  | 'RETRO_PC'
  | 'ARCADE'
  | 'MINI_PIXEL'
  | 'SOFT_PIXEL';

export type GenerationStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED_UNSAFE';

export type PixelVisibility = 'PUBLIC' | 'PRIVATE';

export type SpendKind =
  | 'FREE_FIRST'
  | 'FREE_FIRST_RETRY'
  | 'FREE_BONUS'
  | 'PAID_CREDIT';

export interface PixelGeneration {
  id: string;
  status: GenerationStatus;
  style: PixelStyle;
  /** 0–100. Server-reported, so the loading UI matches reality. */
  progress: number;
  characterImageUrl: string | null;
  /** Present on FAILED / REJECTED_UNSAFE. */
  failureReason: GenerationFailureReason | null;
  /** Which allowance this consumed; refunded in kind on failure. */
  spendKind: SpendKind;
  usedFreeGeneration: boolean;
  usedCredit: boolean;
  /** Set when this render is a retry, pointing at the original. */
  retryOfGenerationId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export type GenerationFailureReason =
  | 'UNSAFE_IMAGE'
  | 'NO_PERSON_DETECTED'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'INTERNAL';

export interface StartGenerationRequest {
  /** Key returned by the upload step. */
  uploadId: string;
  style: PixelStyle;
  /**
   * Idempotency key. A double-tapped button or a network retry resolves to
   * the same generation instead of a second charge.
   */
  clientRequestId?: string;
}

export interface RetryGenerationRequest {
  generationId: string;
  style: PixelStyle;
  clientRequestId?: string;
}

export interface UploadTicket {
  uploadId: string;
  /** Pre-signed PUT URL into the private originals bucket. */
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface PixelPost {
  id: string;
  author: PostAuthor;
  characterImageUrl: string;
  caption: string | null;
  mood: string | null;
  tags: string[];
  style: PixelStyle;
  visibility: PixelVisibility;
  heartCount: number;
  /** Whether the current viewer has hearted this post. */
  heartedByMe: boolean;
  /** Calendar date (YYYY-MM-DD) this post represents. */
  postDate: string;
  isRepresentative: boolean;
  createdAt: string;
}

export interface PostAuthor {
  id: string;
  nickname: string;
  representativeCharacterUrl: string | null;
  connectionStatus: ConnectionStatus;
}

/** Compact form used in grids. */
export interface PixelPostSummary {
  id: string;
  characterImageUrl: string;
  postDate: string;
  mood: string | null;
  heartCount: number;
}

/** Owner-only view; adds the private original. */
export interface MyPixelPost extends PixelPost {
  originalImageUrl: string | null;
  originalRetained: boolean;
}

export interface PublishPixelRequest {
  caption?: string | null;
  mood?: string | null;
  tags?: string[];
  /** When true, replaces today's existing representative post. */
  replaceRepresentative?: boolean;
}

export interface TodayStatus {
  /** Today's published representative post, if any. */
  myTodayPost: PixelPost | null;
  firstGenerationAvailable: boolean;
  firstRetryAvailable: boolean;
  bonusFreeCredits: number;
  creditBalance: number;
  nextGenerationIsFree: boolean;
  /** Candidate generations made today that were never published. */
  pendingGenerationId: string | null;
}

/* ------------------------------------------------------------------ square */

export interface SquareResponse {
  scene: SquareScene;
  /** Characters with server-assigned, non-overlapping canvas coordinates. */
  occupants: SquareOccupant[];
  curations: SquareCuration[];
  totalCount: number;
  nextCursor: string | null;
}

export interface SquareScene {
  code: string;
  name: string;
  /** Background art + prop layout, versioned so clients can cache it. */
  version: number;
  palette: { sky: string; ground: string; accent: string };
  props: SquareProp[];
}

export interface SquareProp {
  code: string;
  x: number;
  y: number;
  scale: number;
  /** Larger renders in front. */
  zIndex: number;
}

export interface SquareOccupant {
  postId: string;
  userId: string;
  nickname: string;
  characterImageUrl: string;
  mood: string | null;
  /** Canvas coordinates in `layout.squareCanvas` space. */
  x: number;
  y: number;
  /** Idle animation variant so the crowd doesn't move in lockstep. */
  idleVariant: number;
  /** 0 = front row (larger), higher = further back (smaller). */
  depth: number;
}

export interface SquareCuration {
  code: 'HEARTS' | 'FRESH' | 'ACTIVE' | 'RECURRING';
  title: string;
  entries: SquareCurationEntry[];
}

export interface SquareCurationEntry {
  postId: string;
  userId: string;
  nickname: string;
  characterImageUrl: string;
  mood: string | null;
}

/* --------------------------------------------------------------- reactions */

export interface HeartResponse {
  postId: string;
  heartCount: number;
  heartedByMe: boolean;
}

/* -------------------------------------------------------------- connection */

export type ConnectionStatus =
  | 'NONE'
  | 'REQUESTED_BY_ME'
  | 'REQUESTED_BY_THEM'
  | 'CONNECTED'
  | 'BLOCKED';

export interface ConnectRequestResponse {
  status: ConnectionStatus;
  /** Present when this request completed a mutual connection. */
  connection: Connection | null;
}

export interface Connection {
  id: string;
  peer: PostAuthor;
  conversationId: string;
  connectedAt: string;
  /** False until the user has opened the celebration screen. */
  acknowledged: boolean;
}

export interface ConnectionListResponse {
  pendingIncoming: PendingConnection[];
  connections: Connection[];
}

export interface PendingConnection {
  userId: string;
  nickname: string;
  characterImageUrl: string | null;
  requestedAt: string;
}

/* -------------------------------------------------------------------- chat */

export interface Conversation {
  id: string;
  peer: PostAuthor;
  lastMessage: Message | null;
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  /** True when the peer blocked us or deleted their account. */
  inactive: boolean;
}

export type MessageType = 'TEXT' | 'SYSTEM';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string | null;
  type: MessageType;
  content: string;
  createdAt: string;
  readAt: string | null;
}

export interface SendMessageRequest {
  /** Client-generated UUID for idempotency and optimistic rendering. */
  clientMessageId: string;
  type: MessageType;
  content: string;
}

/* ----------------------------------------------------------- notifications */

export type NotificationType =
  | 'HEART'
  | 'CONNECTION_REQUEST'
  | 'CONNECTED'
  | 'MESSAGE'
  | 'REACTION_SPIKE'
  | 'DAILY_REMINDER'
  | 'GENERATION_COMPLETED'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Pixel thumbnail of the actor, when there is one. */
  imageUrl: string | null;
  /** Deep-link target, e.g. `/user/123` or `/chat/abc`. */
  deepLink: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationBadge {
  unreadNotifications: number;
  unreadMessages: number;
  pendingConnections: number;
}

export interface RegisterPushTokenRequest {
  token: string;
  platform: 'IOS' | 'ANDROID';
  appVersion: string;
}

/* --------------------------------------------------------------- store/iap */

export type ProductKind =
  | 'CREDIT_PACK'
  | 'STYLE'
  | 'DECORATION'
  | 'SUBSCRIPTION';

export interface StoreProduct {
  /** Internal product code; stable across stores. */
  code: string;
  kind: ProductKind;
  /** Store SKU to look up with the platform billing client. */
  storeProductId: string;
  name: string;
  description: string;
  /** Fallback display price; the localised store price wins when available. */
  fallbackPriceKrw: number;
  /** Credits granted (CREDIT_PACK only). */
  creditAmount: number | null;
  /** Style / decoration code unlocked (STYLE, DECORATION only). */
  unlockCode: string | null;
  badge: string | null;
  sortOrder: number;
  previewImageUrl: string | null;
  /** Already owned (non-consumable) or currently active (subscription). */
  owned: boolean;
}

export interface StoreCatalog {
  creditPacks: StoreProduct[];
  styles: StoreProduct[];
  decorations: StoreProduct[];
  subscriptions: StoreProduct[];
  plusBenefits: PlusBenefit[];
}

export interface PlusBenefit {
  code: string;
  title: string;
  description: string;
  emoji: string;
}

export interface VerifyPurchaseRequest {
  platform: 'IOS' | 'ANDROID';
  productCode: string;
  storeProductId: string;
  /** iOS: signed transaction JWS. Android: purchase token. */
  receipt: string;
  transactionId: string;
}

export interface VerifyPurchaseResponse {
  status: 'GRANTED' | 'ALREADY_GRANTED' | 'PENDING' | 'INVALID';
  entitlements: Entitlements;
}

/** No reset date: free generation is an onboarding grant, not a daily one. */
export interface CreditSummary {
  creditBalance: number;
  firstGenerationAvailable: boolean;
  firstRetryAvailable: boolean;
  bonusFreeCredits: number;
  history: CreditLedgerEntry[];
}

export interface CreditLedgerEntry {
  id: string;
  delta: number;
  reason:
    | 'PURCHASE'
    | 'GENERATION'
    | 'GENERATION_REFUND'
    | 'SUBSCRIPTION_GRANT'
    | 'PROMOTION'
    | 'REWARD_AD';
  balanceAfter: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ safety */

export type ReportReason =
  | 'INAPPROPRIATE_CONTENT'
  | 'HARASSMENT'
  | 'IMPERSONATION'
  | 'SPAM'
  | 'SEXUAL_CONTENT'
  | 'HATE_SPEECH'
  | 'OTHER';

export type ReportTargetType = 'USER' | 'PIXEL_POST' | 'MESSAGE';

export interface CreateReportRequest {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail?: string;
  alsoBlock: boolean;
}

export interface BlockedUser {
  userId: string;
  nickname: string;
  representativeCharacterUrl: string | null;
  blockedAt: string;
}

/* ------------------------------------------------------------------ system */

export interface AppConfigResponse {
  /** Clients below this must update before continuing. */
  minimumSupportedVersion: string;
  maintenance: { active: boolean; message: string | null };
  /** Server-driven feature flags so we can dark-launch safely. */
  features: Record<string, boolean>;
  /** Pricing and copy for the store, so prices are never hardcoded. */
  storeRevision: number;
}
