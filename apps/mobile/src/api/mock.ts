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
import { dailyStatusApi as realDailyStatusApi } from './endpoints/dailyStatus';
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
  DailyStatusEntry,
  DailyStatusSummary,
  Entitlements,
  Message,
  MeResponse,
  Page,
  PixelCharacter,
  PixelGeneration,
  PostAuthor,
  PublicProfile,
  SpendKind,
  SquareOccupant,
  SquareResponse,
  StoreCatalog,
  TodayStatusResponse,
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
  connectionStatus: ConnectionStatus;
  /** null until this person has kept a character. */
  currentCharacterId: string | null;
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
  connectionStatus: 'NONE',
  currentCharacterId: null,
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
    connectionStatus: 'NONE',
    currentCharacterId: null,
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
    connectionStatus: 'NONE',
    currentCharacterId: null,
  },
];

function personById(userId: string): MockPersonState | null {
  if (userId === me.id) return me;
  return others.find((person) => person.id === userId) ?? null;
}

function representativeUrlOf(person: MockPersonState): string | null {
  const character = person.currentCharacterId ? characters.get(person.currentCharacterId) : null;
  return character?.characterImageUrl ?? null;
}

function author(person: MockPersonState): PostAuthor {
  return {
    id: person.id,
    nickname: person.nickname,
    representativeCharacterUrl: representativeUrlOf(person),
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
  squareVisible: false,
  squareOnboarded: false,
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

/* ------------------------------------------------------------- characters */

const characters = new Map<string, PixelCharacter>();
/** generationId -> characterId, so `keep` is idempotent per generation. */
const characterByGeneration = new Map<string, string>();

function keepCharacter(
  person: MockPersonState,
  generation: MockGeneration,
  asCurrent: boolean,
): PixelCharacter {
  const existingId = characterByGeneration.get(generation.id);
  if (existingId) {
    const existing = characters.get(existingId)!;
    if (asCurrent) setCurrentCharacter(person, existing.id);
    return existing;
  }

  const id = nextId('char');
  const character: PixelCharacter = {
    id,
    characterImageUrl: generation.characterImageUrl ?? MOCK_CHARACTER_URI,
    style: generation.style,
    label: null,
    isCurrent: false,
    hasOriginal: true,
    createdAt: isoNow(),
  };
  characters.set(id, character);
  characterByGeneration.set(generation.id, id);
  person.pixelCount += 1;

  if (asCurrent) setCurrentCharacter(person, id);
  return character;
}

function setCurrentCharacter(person: MockPersonState, characterId: string): void {
  if (person.currentCharacterId) {
    const previous = characters.get(person.currentCharacterId);
    if (previous) previous.isCurrent = false;
  }
  person.currentCharacterId = characterId;
  const character = characters.get(characterId);
  if (character) character.isCurrent = true;
  ensureTodayPointsAt(person, characterId);
}

/* --------------------------------------------------------- daily statuses */

const dailyStatuses = new Map<string, DailyStatusEntry>();
const hearted = new Set<string>();
/** personId -> today's dailyStatusId. */
const todayStatusByPerson = new Map<string, string>();

function ensureTodayPointsAt(person: MockPersonState, characterId: string): DailyStatusEntry {
  const character = characters.get(characterId);
  const existingId = todayStatusByPerson.get(person.id);
  if (existingId) {
    const existing = dailyStatuses.get(existingId)!;
    existing.characterImageUrl = character?.characterImageUrl ?? existing.characterImageUrl;
    existing.freshCharacter = true;
    return existing;
  }

  const id = nextId('status');
  const status: DailyStatusEntry = {
    id,
    author: author(person),
    characterImageUrl: character?.characterImageUrl ?? null,
    mood: null,
    message: null,
    tags: [],
    heartCount: 0,
    heartedByMe: false,
    freshCharacter: true,
    statusDate: todayDate(),
    createdAt: isoNow(),
  };
  dailyStatuses.set(id, status);
  todayStatusByPerson.set(person.id, id);
  person.streakDays += 1;
  return status;
}

function seedTodayStatus(
  person: MockPersonState,
  minutesAgo: number,
  message: string,
  mood: string,
  tags: string[],
): void {
  const characterId = nextId('char');
  characters.set(characterId, {
    id: characterId,
    characterImageUrl: MOCK_CHARACTER_URI,
    style: 'PIXME_BASIC',
    label: null,
    isCurrent: true,
    hasOriginal: false,
    createdAt: isoNow(-minutesAgo - 1),
  });
  person.currentCharacterId = characterId;
  person.pixelCount += 1;

  const id = nextId('status');
  const status: DailyStatusEntry = {
    id,
    author: author(person),
    characterImageUrl: MOCK_CHARACTER_URI,
    mood,
    message,
    tags,
    heartCount: person.receivedHeartCount,
    heartedByMe: false,
    freshCharacter: true,
    statusDate: todayDate(),
    createdAt: isoNow(-minutesAgo),
  };
  dailyStatuses.set(id, status);
  todayStatusByPerson.set(person.id, id);
}

seedTodayStatus(others[0]!, 42, '오늘은 그냥 산책.', 'HAPPY', ['산책', '카페']);
seedTodayStatus(others[1]!, 140, '비 와서 그런가 좀 멍해요.', 'BLANK', ['집', '비오는날']);

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

/** Everyone with a today status is "present" in the mock square. */
function presentPeople(): MockPersonState[] {
  return [me, ...others].filter((person) => {
    if (!todayStatusByPerson.has(person.id)) return false;
    if (person.id === me.id) return settings.squareVisible;
    return true;
  });
}

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
    representativeCharacterUrl: representativeUrlOf(me),
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

function summaryOf(status: DailyStatusEntry): DailyStatusSummary {
  return {
    id: status.id,
    characterImageUrl: status.characterImageUrl,
    statusDate: status.statusDate,
    mood: status.mood,
    heartCount: status.heartCount,
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
    if (body.settings) {
      Object.assign(settings, body.settings);
      if (body.settings.squareVisible !== undefined) settings.squareOnboarded = true;
    }
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
    const statusId = todayStatusByPerson.get(person.id);
    const todayStatus = statusId ? dailyStatuses.get(statusId) ?? null : null;
    return {
      id: person.id,
      nickname: person.nickname,
      bio: person.bio,
      interests: person.interests,
      representativeCharacterUrl: representativeUrlOf(person),
      todayStatus,
      recentStatuses: todayStatus ? [summaryOf(todayStatus)] : [],
      stats: { receivedHeartCount: person.receivedHeartCount, pixelCount: person.pixelCount },
      relation: {
        isMe: person.id === me.id,
        connectionStatus: person.connectionStatus,
        conversationId: connections.get(connectionId(person.id))?.conversationId ?? null,
        heartedTodayStatus: todayStatus ? hearted.has(todayStatus.id) : false,
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

  keep: async (generationId, body): Promise<PixelCharacter> => {
    await delay();
    const generation = generations.get(generationId);
    if (!generation || generation.status !== 'COMPLETED') {
      throw new ApiError({ code: ApiErrorCode.Validation, message: '아직 완성되지 않았어요.', status: 409 });
    }
    return keepCharacter(me, generation, body.asCurrent);
  },

  collection: async (): Promise<PixelCharacter[]> => {
    await delay();
    return [...characters.values()]
      .filter((character) => characterOwnerId(character.id) === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  setCurrent: async (characterId): Promise<PixelCharacter> => {
    await delay();
    const character = characters.get(characterId);
    if (!character) throw new ApiError({ code: ApiErrorCode.Validation, message: '찾을 수 없어요.', status: 404 });
    setCurrentCharacter(me, characterId);
    return character;
  },

  deleteCharacter: async (characterId) => {
    if (me.currentCharacterId === characterId) {
      throw new ApiError({
        code: ApiErrorCode.Validation,
        message: '현재 사용 중인 PIXME는 삭제할 수 없어요.',
        status: 400,
      });
    }
    characters.delete(characterId);
  },

  originalUrl: async () => {
    throw new ApiError({ code: ApiErrorCode.Validation, message: '원본이 없어요.', status: 404 });
  },

  deleteOriginal: async () => undefined,
} satisfies typeof realPixelsApi;

/** Which mock person owns a character — only "나" keeps new ones in the preview. */
function characterOwnerId(characterId: string): string {
  return me.currentCharacterId === characterId || characterByGeneration.has(characterId)
    ? me.id
    : (() => {
        for (const id of todayStatusByPerson.keys()) {
          const person = personById(id);
          if (person?.currentCharacterId === characterId) return person.id;
        }
        return me.id;
      })();
}

export const mockDailyStatusApi = {
  todayFeed: async (): Promise<Page<DailyStatusEntry>> => {
    await delay();
    const items = [...others]
      .map((person) => todayStatusByPerson.get(person.id))
      .filter((id): id is string => Boolean(id))
      .map((id) => dailyStatuses.get(id)!)
      .filter(Boolean);
    return { items, nextCursor: null, hasMore: false };
  },

  myToday: async (): Promise<TodayStatusResponse> => {
    await delay(150);
    const statusId = todayStatusByPerson.get(me.id);
    const myTodayStatus = statusId ? dailyStatuses.get(statusId) ?? null : null;
    return {
      myTodayStatus,
      firstGenerationAvailable: entitlements.firstGenerationAvailable,
      firstRetryAvailable: entitlements.firstRetryAvailable,
      bonusFreeCredits: entitlements.bonusFreeCredits,
      creditBalance: entitlements.creditBalance,
      nextGenerationIsFree: entitlements.nextGenerationIsFree,
      pendingGenerationId: null,
      squareVisible: settings.squareVisible,
      squareOnboarded: settings.squareOnboarded,
    };
  },

  upsertMyToday: async (body): Promise<DailyStatusEntry> => {
    await delay();
    const characterId = body.pixelCharacterId ?? me.currentCharacterId;
    if (!characterId) {
      throw new ApiError({ code: ApiErrorCode.Validation, message: '먼저 PIXME를 만들어주세요.', status: 400 });
    }
    const status = ensureTodayPointsAt(me, characterId);
    if (body.mood !== undefined) status.mood = body.mood ?? null;
    if (body.message !== undefined) status.message = body.message ?? null;
    if (body.tags !== undefined) status.tags = body.tags ?? [];
    if (body.pixelCharacterId === undefined) status.freshCharacter = false;
    return status;
  },

  myHistory: async (): Promise<Page<DailyStatusSummary>> => {
    await delay();
    const statusId = todayStatusByPerson.get(me.id);
    const items = statusId && dailyStatuses.has(statusId) ? [summaryOf(dailyStatuses.get(statusId)!)] : [];
    return { items, nextCursor: null, hasMore: false };
  },

  detail: async (dailyStatusId) => {
    await delay(150);
    const status = dailyStatuses.get(dailyStatusId);
    if (!status) throw new ApiError({ code: ApiErrorCode.Validation, message: '찾을 수 없어요.', status: 404 });
    return status;
  },

  userHistory: async (userId): Promise<Page<DailyStatusSummary>> => {
    await delay();
    const statusId = todayStatusByPerson.get(userId);
    const items = statusId && dailyStatuses.has(statusId) ? [summaryOf(dailyStatuses.get(statusId)!)] : [];
    return { items, nextCursor: null, hasMore: false };
  },
} satisfies typeof realDailyStatusApi;

export const mockSquareApi = {
  today: async (): Promise<SquareResponse> => {
    await delay();
    const present = presentPeople();
    const occupants: SquareOccupant[] = present.map((person, index) => {
      const statusId = todayStatusByPerson.get(person.id);
      const status = statusId ? dailyStatuses.get(statusId) ?? null : null;
      return {
        userId: person.id,
        dailyStatusId: status?.id ?? null,
        nickname: person.nickname,
        characterImageUrl: representativeUrlOf(person) ?? MOCK_CHARACTER_URI,
        mood: status?.mood ?? null,
        message: status?.message ?? null,
        presenceState: index === 0 ? 'JUST_ARRIVED' : 'ACTIVE',
        x: 220 + index * 260,
        y: 500 + (index % 2) * 320,
        idleVariant: index % 3,
        depth: index % 3,
      };
    });

    const heartsRail = [...others]
      .sort((a, b) => b.receivedHeartCount - a.receivedHeartCount)
      .slice(0, 2)
      .map((person) => {
        const statusId = todayStatusByPerson.get(person.id);
        const status = statusId ? dailyStatuses.get(statusId) : null;
        return {
          userId: person.id,
          dailyStatusId: status?.id ?? null,
          nickname: person.nickname,
          characterImageUrl: representativeUrlOf(person) ?? MOCK_CHARACTER_URI,
          mood: status?.mood ?? null,
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
  sendHeart: async (dailyStatusId) => {
    await delay(150);
    const status = dailyStatuses.get(dailyStatusId);
    if (!status) throw new ApiError({ code: ApiErrorCode.Validation, message: '찾을 수 없어요.', status: 404 });
    if (!hearted.has(dailyStatusId)) {
      hearted.add(dailyStatusId);
      status.heartCount += 1;
      status.heartedByMe = true;
      const target = personById(status.author.id);
      if (target) target.receivedHeartCount += 1;
    }
    return { dailyStatusId, heartCount: status.heartCount, heartedByMe: true };
  },
  removeHeart: async (dailyStatusId) => {
    await delay(150);
    const status = dailyStatuses.get(dailyStatusId);
    if (!status) throw new ApiError({ code: ApiErrorCode.Validation, message: '찾을 수 없어요.', status: 404 });
    if (hearted.has(dailyStatusId)) {
      hearted.delete(dailyStatusId);
      status.heartCount = Math.max(0, status.heartCount - 1);
      status.heartedByMe = false;
      const target = personById(status.author.id);
      if (target) target.receivedHeartCount = Math.max(0, target.receivedHeartCount - 1);
    }
    return { dailyStatusId, heartCount: status.heartCount, heartedByMe: false };
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
