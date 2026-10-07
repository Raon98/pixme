/**
 * The mock API — every network call, answered locally.
 *
 * <p>Used only when `MOCK_MODE` is on (`src/lib/mock.ts`). Each export below
 * is typed `satisfies typeof real...Api`, so if a real endpoint's signature
 * changes, this file fails to compile instead of silently drifting out of
 * sync.
 *
 * <p>One test character (`MOCK_CHARACTER_URI`) stands in for every generated
 * PIXME, including the two other "people" in the feed and square — there is
 * only one source photo to work with, so the point is to exercise the screens
 * and the state machine, not to look like a populated app.
 *
 * <p>State lives in module-level variables and resets on reload. That is
 * deliberate: this is a preview tool, not a persistence layer.
 */
import { MOCK_CHARACTER_URI } from '@/lib/mock';

import { ApiError, ApiErrorCode } from './errors';
import { authApi as realAuthApi } from './endpoints/auth';
import { chatApi as realChatApi } from './endpoints/chat';
import { connectionsApi as realConnectionsApi } from './endpoints/connections';
import { notificationsApi as realNotificationsApi } from './endpoints/notifications';
import { pixelsApi as realPixelsApi } from './endpoints/pixels';
import { reactionsApi as realReactionsApi } from './endpoints/reactions';
import { safetyApi as realSafetyApi } from './endpoints/safety';
import { squareApi as realSquareApi } from './endpoints/square';
import { storeApi as realStoreApi } from './endpoints/store';
import { systemApi as realSystemApi } from './endpoints/system';
import { usersApi as realUsersApi } from './endpoints/users';
import type {
  AppNotification,
  Connection,
  ConnectionStatus,
  Conversation,
  CreditSummary,
  Entitlements,
  Message,
  MeResponse,
  MyPixelPost,
  Page,
  PixelGeneration,
  PixelPost,
  PixelPostSummary,
  PostAuthor,
  PublicProfile,
  SpendKind,
  SquareResponse,
  StoreCatalog,
  TodayStatus,
} from './types';

/* ------------------------------------------------------------------ utils */

const delay = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms));

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `mock-${prefix}-${sequence}`;
}

function isoNow(offsetMinutes = 0): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/* --------------------------------------------------------------- identity */

const ME_ID = 'mock-me';

interface MockPersonState {
  id: string;
  nickname: string;
  bio: string | null;
  interests: string[];
  receivedHeartCount: number;
  connectionCount: number;
  pixelCount: number;
  streakDays: number;
  /** null until this person has a published representative post. */
  representativeCharacterUrl: string | null;
  connectionStatus: ConnectionStatus;
}

const me: MockPersonState = {
  id: ME_ID,
  nickname: '나',
  bio: '픽미 미리보기 중이에요.',
  interests: ['MUSIC', 'CAFE'],
  receivedHeartCount: 0,
  connectionCount: 0,
  pixelCount: 0,
  streakDays: 0,
  representativeCharacterUrl: null,
  connectionStatus: 'NONE',
};

/** The other two "people" the preview populates the feed and square with. */
const others: MockPersonState[] = [
  {
    id: 'mock-mingi',
    nickname: '민지',
    bio: '퇴근하고 산책 좋아해요.',
    interests: ['CAFE', 'WALK'],
    receivedHeartCount: 12,
    connectionCount: 1,
    pixelCount: 8,
    streakDays: 3,
    representativeCharacterUrl: MOCK_CHARACTER_URI,
    connectionStatus: 'NONE',
  },
  {
    id: 'mock-hyunwoo',
    nickname: '현우',
    bio: '오늘도 아무 일 없이.',
    interests: ['GAME', 'MOVIE'],
    receivedHeartCount: 4,
    connectionCount: 0,
    pixelCount: 2,
    streakDays: 1,
    representativeCharacterUrl: MOCK_CHARACTER_URI,
    connectionStatus: 'NONE',
  },
];

function personById(userId: string): MockPersonState | null {
  if (userId === me.id) return me;
  return others.find((person) => person.id === userId) ?? null;
}

function author(person: MockPersonState): PostAuthor {
  return {
    id: person.id,
    nickname: person.nickname,
    representativeCharacterUrl: person.representativeCharacterUrl,
    connectionStatus: person.connectionStatus,
  };
}

/* -------------------------------------------------------------- settings */

const settings: MeResponse['settings'] = {
  pushHeart: true,
  pushConnectionRequest: true,
  pushConnected: true,
  pushMessage: true,
  pushDailyReminder: true,
  keepOriginalPhoto: true,
};

/* ----------------------------------------------------------- entitlements */

const entitlements: Entitlements = {
  plusActive: false,
  plusExpiresAt: null,
  firstGenerationAvailable: true,
  firstRetryAvailable: false,
  bonusFreeCredits: 1,
  creditBalance: 0,
  nextGenerationIsFree: true,
  unlockedStyles: [],
  unlockedDecorations: [],
};

function refreshNextGenerationIsFree() {
  entitlements.nextGenerationIsFree =
    entitlements.firstGenerationAvailable || entitlements.bonusFreeCredits > 0;
}

/** Mirrors `CreditService.spendForGeneration` — free chances before paid. */
function spendForNewGeneration(): SpendKind {
  if (entitlements.firstGenerationAvailable) {
    entitlements.firstGenerationAvailable = false;
    entitlements.firstRetryAvailable = true;
    refreshNextGenerationIsFree();
    return 'FREE_FIRST';
  }
  if (entitlements.bonusFreeCredits > 0) {
    entitlements.bonusFreeCredits -= 1;
    refreshNextGenerationIsFree();
    return 'FREE_BONUS';
  }
  if (entitlements.creditBalance > 0) {
    entitlements.creditBalance -= 1;
    return 'PAID_CREDIT';
  }
  throw new ApiError({
    code: ApiErrorCode.NoGenerationAvailable,
    message: '생성권이 없어요.',
    status: 402,
  });
}

/** Mirrors `CreditService.spendForFirstRetry` — scoped, then falls through. */
function spendForRetry(): SpendKind {
  if (entitlements.firstRetryAvailable) {
    entitlements.firstRetryAvailable = false;
    return 'FREE_FIRST_RETRY';
  }
  return spendForNewGeneration();
}

/* ----------------------------------------------------------- generations */

interface MockGeneration extends PixelGeneration {
  pollCount: number;
}

const generations = new Map<string, MockGeneration>();

/** Real pipeline progress thresholds, so GenerationStages paces identically. */
const PROGRESS_STEPS = [20, 45, 70, 90, 100];

function createGeneration(spendKind: SpendKind, retryOf: string | null): MockGeneration {
  const id = nextId('gen');
  const generation: MockGeneration = {
    id,
    status: 'PROCESSING',
    style: 'PIXME_BASIC',
    progress: PROGRESS_STEPS[0] ?? 20,
    characterImageUrl: null,
    failureReason: null,
    spendKind,
    usedFreeGeneration: spendKind !== 'PAID_CREDIT',
    usedCredit: spendKind === 'PAID_CREDIT',
    retryOfGenerationId: retryOf,
    createdAt: isoNow(),
    completedAt: null,
    pollCount: 0,
  };
  generations.set(id, generation);
  return generation;
}

function pollGeneration(id: string): MockGeneration {
  const generation = generations.get(id);
  if (!generation) {
    throw new ApiError({ code: ApiErrorCode.Validation, message: '찾을 수 없어요.', status: 404 });
  }
  if (generation.status === 'COMPLETED') return generation;

  generation.pollCount += 1;
  const stepIndex = Math.min(generation.pollCount, PROGRESS_STEPS.length - 1);
  generation.progress = PROGRESS_STEPS[stepIndex] ?? 100;

  if (generation.progress >= 100) {
    generation.status = 'COMPLETED';
    generation.characterImageUrl = MOCK_CHARACTER_URI;
    generation.completedAt = isoNow();
  }
  return generation;
}

function rootOf(generation: MockGeneration): string {
  return generation.retryOfGenerationId ?? generation.id;
}

/* ------------------------------------------------------------------ posts */

const posts = new Map<string, PixelPost | MyPixelPost>();
const hearted = new Set<string>();

function seedTodayPost(person: MockPersonState, minutesAgo: number, caption: string, mood: string, tags: string[]): void {
  const id = nextId('post');
  const post: PixelPost = {
    id,
    author: author(person),
    characterImageUrl: MOCK_CHARACTER_URI,
    caption,
    mood,
    tags,
    style: 'PIXME_BASIC',
    visibility: 'PUBLIC',
    heartCount: person.receivedHeartCount,
    heartedByMe: false,
    postDate: todayDate(),
    isRepresentative: true,
    createdAt: isoNow(-minutesAgo),
  };
  posts.set(id, post);
}

seedTodayPost(others[0]!, 42, '오늘은 그냥 산책.', 'HAPPY', ['산책', '카페']);
seedTodayPost(others[1]!, 140, '비 와서 그런가 좀 멍해요.', 'BLANK', ['집', '비오는날']);

let myTodayPostId: string | null = null;

/* --------------------------------------------------------------- square --- */

const squareScene: SquareResponse['scene'] = {
  code: 'BASIC',
  name: '오늘의 광장',
  version: 1,
  palette: { sky: '#EAF2FF', ground: '#F6F1E4', accent: '#7C6CF0' },
  props: [
    { code: 'TREE', x: 120, y: 430, scale: 1.4, zIndex: 1 },
    { code: 'BENCH', x: 320, y: 560, scale: 1.1, zIndex: 2 },
    { code: 'CAFE', x: 820, y: 250, scale: 1.6, zIndex: 0 },
    { code: 'FOUNTAIN', x: 500, y: 760, scale: 1.5, zIndex: 2 },
    { code: 'BUS_STOP', x: 160, y: 900, scale: 1.2, zIndex: 3 },
  ],
};

/* ------------------------------------------------------------- connections */

const connections = new Map<string, Connection>();

/** Every wave connects instantly — there's no second real device to answer it. */
function connectWith(userId: string): Connection {
  const target = personById(userId);
  if (!target) {
    throw new ApiError({ code: ApiErrorCode.Validation, message: '사용자를 찾을 수 없어요.', status: 404 });
  }

  target.connectionStatus = 'CONNECTED';
  target.connectionCount += 1;
  me.connectionCount += 1;

  const conversationId = nextId('conv');
  const connection: Connection = {
    id: nextId('connection'),
    peer: author(target),
    conversationId,
    connectedAt: isoNow(),
    acknowledged: false,
  };
  connections.set(connectionId(target.id), connection);
  if (!conversations.has(conversationId)) {
    conversations.set(conversationId, {
      id: conversationId,
      peer: author(target),
      lastMessage: null,
      unreadCount: 0,
      lastMessageAt: isoNow(),
      createdAt: isoNow(),
      inactive: false,
    });
    messages.set(conversationId, [
      {
        id: nextId('msg'),
        conversationId,
        senderId: null,
        type: 'SYSTEM',
        content: 'PIXME에서 서로 친해지고 싶다는 마음이 통했어요.',
        createdAt: isoNow(),
        readAt: isoNow(),
      },
    ]);
  }
  return connection;
}

function connectionId(peerId: string): string {
  return peerId;
}

/* -------------------------------------------------------------------- chat */

const conversations = new Map<string, Conversation>();
const messages = new Map<string, Message[]>();

/* --------------------------------------------------------- notifications --- */

let notificationBadgeSeeded = false;
const notifications: AppNotification[] = [];

/* ------------------------------------------------------------------- mock api */

export const mockSystemApi = {
  config: async () => {
    await delay(150);
    return {
      minimumSupportedVersion: '1.0.0',
      maintenance: { active: false, message: null },
      features: { squareScenes: true, pixelStyles: true, rewardedAds: false, boost: false },
      storeRevision: 1,
    };
  },
} satisfies typeof realSystemApi;

export const mockAuthApi = {
  apple: async () => {
    throw new ApiError({ code: ApiErrorCode.Unknown, message: '미리보기 모드예요.', status: 400 });
  },
  kakao: async () => {
    throw new ApiError({ code: ApiErrorCode.Unknown, message: '미리보기 모드예요.', status: 400 });
  },
  refresh: async () => ({ accessToken: 'mock', refreshToken: 'mock', expiresIn: 3600 }),
  logout: async () => undefined,
} satisfies typeof realAuthApi;

/**
 * Pulled out of the object literal on purpose: a method referencing
 * `mockUsersApi.me()` from inside the same object literal is a circular type
 * reference that TypeScript cannot infer without a hand-written annotation.
 */
function buildMeResponse(): MeResponse {
  return {
    id: me.id,
    provider: 'APPLE',
    nickname: me.nickname,
    bio: me.bio,
    birthDate: '2000-01-01',
    status: 'ACTIVE',
    profileCompleted: true,
    interests: me.interests,
    representativeCharacterUrl: me.representativeCharacterUrl,
    stats: {
      receivedHeartCount: me.receivedHeartCount,
      connectionCount: me.connectionCount,
      pixelCount: me.pixelCount,
      streakDays: me.streakDays,
    },
    entitlements,
    settings,
    createdAt: isoNow(-60 * 24),
  };
}

export const mockUsersApi = {
  me: async (): Promise<MeResponse> => {
    await delay();
    return buildMeResponse();
  },
  updateMe: async (body): Promise<MeResponse> => {
    await delay();
    if (body.nickname) me.nickname = body.nickname;
    if (body.bio !== undefined) me.bio = body.bio;
    if (body.interests) me.interests = body.interests;
    if (body.settings) Object.assign(settings, body.settings);
    return buildMeResponse();
  },
  checkNickname: async () => {
    await delay(150);
    return { available: true };
  },
  profile: async (userId): Promise<PublicProfile> => {
    await delay();
    const person = personById(userId);
    if (!person) {
      throw new ApiError({ code: ApiErrorCode.Validation, message: '사용자를 찾을 수 없어요.', status: 404 });
    }
    const todayPost = [...posts.values()].find(
      (post) => post.author.id === person.id && post.isRepresentative,
    );
    return {
      id: person.id,
      nickname: person.nickname,
      bio: person.bio,
      interests: person.interests,
      representativeCharacterUrl: person.representativeCharacterUrl,
      todayPost: todayPost ?? null,
      recentPosts: todayPost
        ? [
            {
              id: todayPost.id,
              characterImageUrl: todayPost.characterImageUrl,
              postDate: todayPost.postDate,
              mood: todayPost.mood,
              heartCount: todayPost.heartCount,
            },
          ]
        : [],
      stats: { receivedHeartCount: person.receivedHeartCount, pixelCount: person.pixelCount },
      relation: {
        isMe: person.id === me.id,
        connectionStatus: person.connectionStatus,
        conversationId: connections.get(connectionId(person.id))?.conversationId ?? null,
        heartedTodayPost: todayPost ? hearted.has(todayPost.id) : false,
        blockedByMe: false,
      },
    };
  },
  interests: async () => {
    await delay(150);
    const { INTERESTS } = await import('@/constants/interests');
    return INTERESTS.map((interest) => ({
      code: interest.code,
      label: interest.label,
      emoji: interest.emoji,
    }));
  },
  registerPushToken: async () => undefined,
  removePushToken: async () => undefined,
  block: async () => undefined,
  unblock: async () => undefined,
  blockedUsers: async () => [],
  deleteAccount: async () => undefined,
} satisfies typeof realUsersApi;

export const mockPixelsApi = {
  createUploadTicket: async (body) => {
    await delay(200);
    return {
      uploadId: nextId('upload'),
      uploadUrl: 'mock://upload',
      headers: { 'Content-Type': body.mimeType },
      expiresAt: isoNow(10),
    };
  },

  startGeneration: async () => {
    await delay(200);
    return createGeneration(spendForNewGeneration(), null);
  },

  retryGeneration: async (body) => {
    await delay(200);
    const source = generations.get(body.generationId);
    return createGeneration(spendForRetry(), source ? rootOf(source) : body.generationId);
  },

  candidates: async (generationId) => {
    await delay(150);
    const target = generations.get(generationId);
    const root = target ? rootOf(target) : generationId;
    return [...generations.values()]
      .filter((generation) => generation.id === root || generation.retryOfGenerationId === root)
      .filter((generation) => generation.characterImageUrl !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  generation: async (generationId) => {
    await delay(500);
    return pollGeneration(generationId);
  },

  publish: async (generationId, body): Promise<PixelPost> => {
    await delay();
    const generation = generations.get(generationId);
    if (!generation || generation.status !== 'COMPLETED' || !generation.characterImageUrl) {
      throw new ApiError({ code: ApiErrorCode.Validation, message: '아직 완성되지 않았어요.', status: 409 });
    }

    if (myTodayPostId && !body.replaceRepresentative) {
      throw new ApiError({
        code: ApiErrorCode.AlreadyPublishedToday,
        message: '오늘의 PIXME가 이미 있어요.',
        status: 409,
      });
    }
    if (myTodayPostId) {
      const previous = posts.get(myTodayPostId);
      if (previous) previous.isRepresentative = false;
    }

    const id = nextId('post');
    const post: MyPixelPost = {
      id,
      author: author(me),
      characterImageUrl: generation.characterImageUrl,
      caption: body.caption ?? null,
      mood: body.mood ?? null,
      tags: body.tags ?? [],
      style: generation.style,
      visibility: 'PUBLIC',
      heartCount: 0,
      heartedByMe: false,
      postDate: todayDate(),
      isRepresentative: true,
      createdAt: isoNow(),
      originalImageUrl: null,
      originalRetained: false,
    };
    posts.set(id, post);
    myTodayPostId = id;
    me.representativeCharacterUrl = post.characterImageUrl;
    me.pixelCount += 1;
    me.streakDays += 1;
    return post;
  },

  todayStatus: async (): Promise<TodayStatus> => {
    await delay(150);
    const myPost = myTodayPostId ? posts.get(myTodayPostId) ?? null : null;
    return {
      myTodayPost: myPost,
      firstGenerationAvailable: entitlements.firstGenerationAvailable,
      firstRetryAvailable: entitlements.firstRetryAvailable,
      bonusFreeCredits: entitlements.bonusFreeCredits,
      creditBalance: entitlements.creditBalance,
      nextGenerationIsFree: entitlements.nextGenerationIsFree,
      pendingGenerationId: null,
    };
  },

  todayFeed: async (): Promise<Page<PixelPost>> => {
    await delay();
    const items = [...posts.values()].filter(
      (post) => post.author.id !== me.id && post.isRepresentative,
    );
    return { items, nextCursor: null, hasMore: false };
  },

  myPixels: async (): Promise<Page<MyPixelPost>> => {
    await delay();
    const items = [...posts.values()].filter(
      (post): post is MyPixelPost => post.author.id === me.id,
    );
    return { items, nextCursor: null, hasMore: false };
  },

  detail: async (postId) => {
    await delay(150);
    const post = posts.get(postId);
    if (!post) throw new ApiError({ code: ApiErrorCode.Validation, message: '찾을 수 없어요.', status: 404 });
    return post;
  },

  myDetail: async (postId) => {
    await delay(150);
    const post = posts.get(postId);
    if (!post || post.author.id !== me.id) {
      throw new ApiError({ code: ApiErrorCode.Validation, message: '찾을 수 없어요.', status: 404 });
    }
    return post as MyPixelPost;
  },

  originalUrl: async () => {
    throw new ApiError({ code: ApiErrorCode.Validation, message: '원본이 없어요.', status: 404 });
  },

  deleteOriginal: async () => undefined,

  unpublish: async (postId) => {
    const post = posts.get(postId);
    if (!post) throw new ApiError({ code: ApiErrorCode.Validation, message: '찾을 수 없어요.', status: 404 });
    post.isRepresentative = false;
    post.visibility = 'PRIVATE';
    if (myTodayPostId === postId) myTodayPostId = null;
    return post;
  },

  deletePost: async (postId) => {
    posts.delete(postId);
    if (myTodayPostId === postId) myTodayPostId = null;
  },

  userPixels: async (userId): Promise<Page<PixelPostSummary>> => {
    await delay();
    const items = [...posts.values()]
      .filter((post) => post.author.id === userId)
      .map((post) => ({
        id: post.id,
        characterImageUrl: post.characterImageUrl,
        postDate: post.postDate,
        mood: post.mood,
        heartCount: post.heartCount,
      }));
    return { items, nextCursor: null, hasMore: false };
  },
} satisfies typeof realPixelsApi;

export const mockSquareApi = {
  today: async (): Promise<SquareResponse> => {
    await delay();
    const todayPosts = [...posts.values()].filter((post) => post.isRepresentative);
    const occupants: SquareResponse['occupants'] = todayPosts.map((post, index) => ({
      postId: post.id,
      userId: post.author.id,
      nickname: post.author.nickname,
      characterImageUrl: post.characterImageUrl,
      mood: post.mood,
      x: 220 + index * 260,
      y: 500 + (index % 2) * 320,
      idleVariant: index % 3,
      depth: index % 3,
    }));

    const heartsRail = [...others]
      .sort((a, b) => b.receivedHeartCount - a.receivedHeartCount)
      .slice(0, 2)
      .map((person) => {
        const post = [...posts.values()].find((item) => item.author.id === person.id);
        return {
          postId: post?.id ?? person.id,
          userId: person.id,
          nickname: person.nickname,
          characterImageUrl: person.representativeCharacterUrl ?? MOCK_CHARACTER_URI,
          mood: post?.mood ?? null,
        };
      });

    return {
      scene: { ...squareScene, props: [...squareScene.props] },
      occupants,
      curations:
        heartsRail.length > 0
          ? [{ code: 'HEARTS', title: '🔥 오늘 많이 받은 하트', entries: heartsRail }]
          : [],
      totalCount: occupants.length,
      nextCursor: null,
    };
  },
} satisfies typeof realSquareApi;

export const mockReactionsApi = {
  sendHeart: async (postId) => {
    await delay(150);
    const post = posts.get(postId);
    if (!post) throw new ApiError({ code: ApiErrorCode.Validation, message: '찾을 수 없어요.', status: 404 });
    if (!hearted.has(postId)) {
      hearted.add(postId);
      post.heartCount += 1;
      post.heartedByMe = true;
      const target = personById(post.author.id);
      if (target) target.receivedHeartCount += 1;
    }
    return { postId, heartCount: post.heartCount, heartedByMe: true };
  },
  removeHeart: async (postId) => {
    await delay(150);
    const post = posts.get(postId);
    if (!post) throw new ApiError({ code: ApiErrorCode.Validation, message: '찾을 수 없어요.', status: 404 });
    if (hearted.has(postId)) {
      hearted.delete(postId);
      post.heartCount = Math.max(0, post.heartCount - 1);
      post.heartedByMe = false;
      const target = personById(post.author.id);
      if (target) target.receivedHeartCount = Math.max(0, target.receivedHeartCount - 1);
    }
    return { postId, heartCount: post.heartCount, heartedByMe: false };
  },
} satisfies typeof realReactionsApi;

export const mockConnectionsApi = {
  request: async (userId) => {
    await delay(250);
    const connection = connectWith(userId);
    return { status: 'CONNECTED', connection };
  },
  cancel: async () => ({ status: 'NONE' as const, connection: null }),
  list: async () => ({
    pendingIncoming: [],
    connections: [...connections.values()],
  }),
  acknowledge: async (connectionIdValue) => {
    const entry = [...connections.values()].find((item) => item.id === connectionIdValue);
    if (entry) entry.acknowledged = true;
  },
} satisfies typeof realConnectionsApi;

export const mockChatApi = {
  conversations: async () => {
    await delay(200);
    return [...conversations.values()].map((conversation) => {
      const history = messages.get(conversation.id) ?? [];
      const last = history[history.length - 1] ?? null;
      return { ...conversation, lastMessage: last, lastMessageAt: last?.createdAt ?? conversation.createdAt };
    });
  },
  conversation: async (conversationId) => {
    const conversation = conversations.get(conversationId);
    if (!conversation) throw new ApiError({ code: ApiErrorCode.Validation, message: '찾을 수 없어요.', status: 404 });
    return conversation;
  },
  messages: async (conversationId): Promise<Page<Message>> => {
    await delay(200);
    const history = messages.get(conversationId) ?? [];
    return { items: [...history].reverse(), nextCursor: null, hasMore: false };
  },
  sendMessage: async (conversationId, body) => {
    await delay(150);
    const message: Message = {
      id: nextId('msg'),
      conversationId,
      senderId: me.id,
      type: 'TEXT',
      content: body.content,
      createdAt: isoNow(),
      readAt: null,
    };
    const history = messages.get(conversationId) ?? [];
    history.push(message);
    messages.set(conversationId, history);
    const conversation = conversations.get(conversationId);
    if (conversation) conversation.lastMessageAt = message.createdAt;
    return message;
  },
  markRead: async () => undefined,
} satisfies typeof realChatApi;

export const mockNotificationsApi = {
  list: async (): Promise<Page<AppNotification>> => {
    await delay(150);
    return { items: notifications, nextCursor: null, hasMore: false };
  },
  badge: async () => {
    await delay(100);
    if (!notificationBadgeSeeded) notificationBadgeSeeded = true;
    return { unreadNotifications: 0, unreadMessages: 0, pendingConnections: 0 };
  },
  markRead: async () => undefined,
  markAllRead: async () => undefined,
} satisfies typeof realNotificationsApi;

export const mockStoreApi = {
  catalog: async (): Promise<StoreCatalog> => {
    await delay();
    const product = (
      code: string,
      kind: StoreCatalog['creditPacks'][number]['kind'],
      name: string,
      description: string,
      priceKrw: number,
      creditAmount: number | null,
      unlockCode: string | null,
      badge: string | null,
    ) => ({
      code,
      kind,
      storeProductId: `app.pixme.${code.toLowerCase()}`,
      name,
      description,
      fallbackPriceKrw: priceKrw,
      creditAmount,
      unlockCode,
      badge,
      sortOrder: 0,
      previewImageUrl: null,
      owned: false,
    });

    return {
      creditPacks: [
        product('CREDIT_1', 'CREDIT_PACK', 'PIXME 1회', '가끔 한 번 더 만들고 싶을 때.', 900, 1, null, null),
        product('CREDIT_3', 'CREDIT_PACK', 'PIXME 3회', '마음에 드는 모습이 나올 때까지.', 1900, 3, null, '인기'),
        product('CREDIT_10', 'CREDIT_PACK', 'PIXME 10회', '미리 넉넉히. 기간 제한 없이 보유해요.', 4900, 10, null, '가장 알뜰'),
      ],
      styles: [],
      decorations: [],
      subscriptions: [
        product('PLUS_MONTHLY', 'SUBSCRIPTION', 'PIXME+', '자주 만드는 사람을 위한 선택형 구독.', 5900, 15, 'PLUS', null),
      ],
      plusBenefits: [
        { code: 'MONTHLY_CREDITS', title: '매달 생성권 15회', description: '자주 만드는 사람을 위한 넉넉한 양.', emoji: '✨' },
        { code: 'PREMIUM_BACKGROUNDS', title: '프리미엄 배경', description: '카드 배경을 더 자유롭게.', emoji: '🖼' },
        { code: 'PROFILE_THEME', title: '프로필 테마', description: '내 공간을 내 취향대로.', emoji: '🌈' },
      ],
    };
  },
  verifyPurchase: async () => {
    await delay();
    entitlements.creditBalance += 1;
    return { status: 'GRANTED', entitlements };
  },
  restorePurchases: async () => ({ entitlements, restoredCount: 0 }),
  credits: async (): Promise<CreditSummary> => {
    await delay(150);
    return {
      creditBalance: entitlements.creditBalance,
      firstGenerationAvailable: entitlements.firstGenerationAvailable,
      firstRetryAvailable: entitlements.firstRetryAvailable,
      bonusFreeCredits: entitlements.bonusFreeCredits,
      history: [],
    };
  },
  entitlements: async () => {
    await delay(100);
    return entitlements;
  },
} satisfies typeof realStoreApi;

export const mockSafetyApi = {
  report: async () => {
    await delay();
  },
} satisfies typeof realSafetyApi;
