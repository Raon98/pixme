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
  /** Opt-in: being active today can place this user in the square. */
  squareVisible: boolean;
  /** Whether the one-time square visibility explanation has been shown. */
  squareOnboarded: boolean;
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
  /** A free alternative when `reason === 'TAKEN'` (e.g. "지우" → "지우2"). */
  suggestion?: string | null;
}

/** Another person's profile. Age and exact counts are intentionally coarse. */
export interface PublicProfile {
  id: string;
  nickname: string;
  bio: string | null;
  interests: string[];
  representativeCharacterUrl: string | null;
  todayStatus: DailyStatusEntry | null;
  recentStatuses: DailyStatusSummary[];
  stats: { receivedHeartCount: number; pixelCount: number };
  /** On PIXME+. Marked on the profile only, never in the feed or the square. */
  plus: boolean;
  /** This person's active decorations, so their profile wears what they chose. */
  decorations: AppliedDecorations;
  relation: UserRelation;
}

export interface UserRelation {
  isMe: boolean;
  connectionStatus: ConnectionStatus;
  /** Set when a conversation already exists. */
  conversationId: string | null;
  heartedTodayStatus: boolean;
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

/**
 * Confirms a generation result as an owned character — the only moment one
 * is added to the Collection. `asCurrent` additionally repoints the user's
 * Current PIXME and, if today has a status row, marks it fresh.
 */
export interface KeepGenerationRequest {
  asCurrent: boolean;
  keepOriginal: boolean;
  label?: string | null;
}

/** One entry in the Collection — a confirmed, owned character. */
export interface PixelCharacter {
  id: string;
  characterImageUrl: string;
  style: PixelStyle;
  label: string | null;
  isCurrent: boolean;
  hasOriginal: boolean;
  createdAt: string;
}

/** Where a decoration is applied. One active item per slot. */
export type DecorationSlot =
  | 'BACKGROUND'
  | 'FRAME'
  | 'PARTICLE'
  | 'NICKNAME'
  | 'THEME'
  | 'POSE'
  | 'EMOTION';

/**
 * Slot → unlock code the author has applied. The server has already dropped
 * anything they may no longer use (a lapsed PIXME+ takes its items with it),
 * so the client renders whatever arrives without re-checking entitlements.
 */
export type AppliedDecorations = Partial<Record<DecorationSlot, string>>;

export interface DecorationItem {
  unlockCode: string;
  slot: DecorationSlot;
  name: string;
  description: string;
  fallbackPriceKrw: number;
  storeProductCode: string;
  /** True when it can be applied right now. */
  owned: boolean;
  /** True when that right comes from PIXME+ and ends with the subscription. */
  viaPlus: boolean;
  /** Part of PIXME+ only — there is no individual price to show. */
  plusOnly: boolean;
}

export interface DecorationsResponse {
  items: DecorationItem[];
  active: AppliedDecorations;
}

export interface PostAuthor {
  id: string;
  nickname: string;
  representativeCharacterUrl: string | null;
  connectionStatus: ConnectionStatus;
  decorations?: AppliedDecorations;
}

/**
 * "오늘의 상태" — free, daily, and independent of generating anything new.
 * `characterImageUrl` is a live snapshot of whatever Current PIXME pointed
 * at when this row was last touched; it freezes once the day is over.
 */
export interface DailyStatusEntry {
  id: string;
  author: PostAuthor;
  characterImageUrl: string | null;
  mood: string | null;
  message: string | null;
  tags: string[];
  heartCount: number;
  /** Whether the current viewer has hearted this status. */
  heartedByMe: boolean;
  /** True when today's Current PIXME switch is what's shown here. */
  freshCharacter: boolean;
  /** Calendar date (YYYY-MM-DD) this status represents. */
  statusDate: string;
  createdAt: string;
}

/** Compact form used in grids. */
export interface DailyStatusSummary {
  id: string;
  characterImageUrl: string | null;
  statusDate: string;
  mood: string | null;
  heartCount: number;
}

/**
 * Upserts today's status. Every field is optional: sending only
 * `pixelCharacterId` is a free Current PIXME switch; sending only
 * mood/message/tags is a pure text edit; both can be combined.
 */
export interface UpsertStatusRequest {
  mood?: string | null;
  message?: string | null;
  tags?: string[];
  pixelCharacterId?: string | null;
}

export interface TodayStatusResponse {
  /** Today's own status, if any. */
  myTodayStatus: DailyStatusEntry | null;
  firstGenerationAvailable: boolean;
  firstRetryAvailable: boolean;
  bonusFreeCredits: number;
  creditBalance: number;
  nextGenerationIsFree: boolean;
  /** Candidate generations made today that were never kept. */
  pendingGenerationId: string | null;
  /** Whether being active today can place this user in the square. */
  squareVisible: boolean;
  /** Whether the one-time square visibility explanation has been shown. */
  squareOnboarded: boolean;
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

/** "🟢 지금 있어요" / "✨ 방금 도착했어요" / "오늘 다녀간 PIXME". */
export type SquarePresenceState = 'JUST_ARRIVED' | 'ACTIVE' | 'VISITED';

export interface SquareOccupant {
  userId: string;
  /** Null when present today but no status set yet — still renders. */
  dailyStatusId: string | null;
  nickname: string;
  characterImageUrl: string;
  mood: string | null;
  message: string | null;
  presenceState: SquarePresenceState;
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
  userId: string;
  dailyStatusId: string | null;
  nickname: string;
  characterImageUrl: string;
  mood: string | null;
}

/* --------------------------------------------------------------- reactions */

export interface HeartResponse {
  dailyStatusId: string;
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
  status:
    | 'GRANTED'
    | 'ALREADY_GRANTED'
    /** Sold by the store to the underlying Apple/Play account, but already granted to a *different* PIXME account. */
    | 'OWNED_BY_ANOTHER_ACCOUNT'
    | 'PENDING'
    | 'INVALID';
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

export type ReportTargetType = 'USER' | 'DAILY_STATUS' | 'MESSAGE';

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
