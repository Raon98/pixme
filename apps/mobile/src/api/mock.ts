/**
 * The mock API — every network call, answered locally.
 *
 * <p>Used only when `MOCK_MODE` is on (`src/lib/mock.ts`). Each export below
 * is typed `satisfies typeof real...Api`, so if a real endpoint's signature
 * changes, this file fails to compile instead of silently drifting out of
 * sync.
 *
 * <p>The cast is the three real accounts this build is tested with, each with
 * its own API-generated render (`src/lib/mock.ts`) — 나 (cheol1998@kakao.com),
 * the App Review account (ahdzz11@naver.com) and 민주
 * (cheer997979@naver.com). Deliberately not a crowd of invented names: an
 * invented crowd made the square look busier than it will be on launch day,
 * and reusing one render across two names showed the same face twice.
 *
 * <p>State lives in module-level variables and resets on reload. That is
 * deliberate: this is a preview tool, not a persistence layer.
 */
import { copy } from '@/constants/copy';
import {
  MOCK_AHDZZ_URIS,
  MOCK_CHARACTER_URI,
  MOCK_CHEOL_URI,
  MOCK_GENERATED_URIS,
  MOCK_MINJU_URI,
} from '@/lib/mock';

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
import { decorationsApi as realDecorationsApi } from './endpoints/decorations';
import { usersApi as realUsersApi } from './endpoints/users';
import type {
  AppliedDecorations,
  AppNotification,
  Connection,
  ConnectionStatus,
  Conversation,
  CreditSummary,
  DailyStatusEntry,
  DailyStatusSummary,
  DecorationItem,
  DecorationsResponse,
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
  /**
   * The real account this preview identity stands in for. Not used by any
   * mock endpoint — it is here so the mapping between a face in the square
   * and the account that will own it after sign-in is written down.
   */
  email: string;
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
  email: 'cheol1998@kakao.com',
  nickname: '성철',
  bio: '픽미 만드는 중.',
  interests: ['MUSIC', 'CAFE'],
  receivedHeartCount: 0,
  connectionCount: 0,
  pixelCount: 0,
  streakDays: 0,
  connectionStatus: 'NONE',
  currentCharacterId: null,
};

/**
 * Everyone else in the preview.
 *
 * <p>Exactly the two other real accounts — no invented filler. The square
 * looking sparse with three people is the honest preview; padding it with
 * strangers hid how a nearly-empty square actually reads.
 */
const others: MockPersonState[] = [
  {
    id: 'mock-ahdzz',
    email: 'ahdzz11@naver.com',
    nickname: '준서',
    bio: '오늘도 아무 일 없이.',
    interests: ['GAME', 'MOVIE'],
    receivedHeartCount: 6,
    connectionCount: 0,
    pixelCount: 4,
    streakDays: 2,
    connectionStatus: 'NONE',
    currentCharacterId: null,
  },
  {
    id: 'mock-minju',
    email: 'cheer997979@naver.com',
    nickname: '민주',
    bio: '오늘은 좀 걷고 싶은 날.',
    interests: ['WALK', 'MUSIC'],
    receivedHeartCount: 8,
    connectionCount: 0,
    pixelCount: 5,
    streakDays: 2,
    // Seeded as if she already waved at you — the only way a preview (one
    // device, no one on the other end) can show the instant-match path at
    // all. mock-ahdzz stays NONE, so tapping 친해지고 싶어요 there shows the
    // ordinary one-sided path instead.
    connectionStatus: 'REQUESTED_BY_THEM',
    currentCharacterId: null,
  },
];

/** The render each account owns, keyed by mock id. */
const CHARACTER_BY_PERSON: Record<string, string> = {
  [ME_ID]: MOCK_CHEOL_URI,
  'mock-ahdzz': MOCK_AHDZZ_URIS[0]!,
  'mock-minju': MOCK_MINJU_URI,
};

function personById(userId: string): MockPersonState | null {
  if (userId === me.id) return me;
  return others.find((person) => person.id === userId) ?? null;
}

function representativeUrlOf(person: MockPersonState): string | null {
  const character = person.currentCharacterId ? characters.get(person.currentCharacterId) : null;
  return character?.characterImageUrl ?? null;
}

/**
 * Declared up here, not next to the other decoration mocks further down:
 * `author` reads it and runs while the top-level feed fixtures are being
 * built, so a `const` declared later is still in its temporal dead zone and
 * crashed the whole app on boot.
 */
const activeDecorations: AppliedDecorations = { BACKGROUND: 'BG_SUNSET' };

function author(person: MockPersonState): PostAuthor {
  return {
    id: person.id,
    nickname: person.nickname,
    representativeCharacterUrl: representativeUrlOf(person),
    connectionStatus: person.connectionStatus,
    // Only "나" decorates in the preview, so the card rendering is visibly
    // different from everyone else's and the effect is easy to judge.
    decorations: person.id === ME_ID ? { ...activeDecorations } : {},
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
  // No onboarding bonus credit (removed 2026-10-07) — two free chances only:
  // the first generation and its one scoped retry.
  bonusFreeCredits: 0,
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

let generationsCompleted = 0;

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
    // A different render each time — see MOCK_GENERATED_URIS. Reusing one
    // image made every result identical to today's published character, and
    // the result screen correctly but uselessly reported it as already kept.
    generation.characterImageUrl =
      MOCK_GENERATED_URIS[generationsCompleted % MOCK_GENERATED_URIS.length] ??
      MOCK_CHARACTER_URI;
    generationsCompleted += 1;
    generation.completedAt = isoNow();
    // Mirrors NotificationService.onGenerationCompleted. The id has to travel
    // in the link: opened from this notification the result screen has no
    // usable draft to read, so without it a finished generation reads as a
    // failure.
    notifications.unshift({
      id: nextId('noti'),
      type: 'GENERATION_COMPLETED',
      title: '오늘의 PIXME가 완성됐어요',
      body: '지금 바로 광장에 보내볼까요?',
      imageUrl: null,
      deepLink: `/create/result?generationId=${generation.id}`,
      readAt: null,
      createdAt: isoNow(),
    });
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
  characterUri: string = MOCK_CHARACTER_URI,
): void {
  const characterId = nextId('char');
  characters.set(characterId, {
    id: characterId,
    characterImageUrl: characterUri,
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
    characterImageUrl: characterUri,
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

const SEEDS: Record<string, { minutesAgo: number; message: string; mood: string; tags: string[] }> = {
  'mock-ahdzz': { minutesAgo: 95, message: '퇴근하고 한 바퀴.', mood: 'CALM', tags: ['산책', '운동'] },
  'mock-minju': { minutesAgo: 42, message: '오늘은 그냥 산책.', mood: 'HAPPY', tags: ['산책', '카페'] },
};

// Each account posts today with its *own* render — no rotation, since there
// is no longer a crowd to spread three faces across.
others.forEach((person) => {
  const seed = SEEDS[person.id];
  if (!seed) return;
  seedTodayStatus(
    person,
    seed.minutesAgo,
    seed.message,
    seed.mood,
    seed.tags,
    CHARACTER_BY_PERSON[person.id] ?? MOCK_CHARACTER_URI,
  );
});

/**
 * "나" starts out already in the square with a character and today's status.
 * The real app defaults `squareVisible` to false and asks first — but in a
 * preview there is nobody else to populate it, so starting empty would hide
 * the screen being previewed. Turn the setting off in 설정 > 개인정보 to see
 * the hidden-state banner and the opt-in path.
 */
seedTodayStatus(me, 25, '미리보기 중이에요.', 'HAPPY', ['테스트'], MOCK_CHEOL_URI);

// The App Review account's second render becomes an older Collection entry,
// so at least one profile in the preview has history to scroll. It stays on
// that account rather than becoming a second stranger: it is the same face.
const pastCharacterUri = MOCK_AHDZZ_URIS[1];
if (pastCharacterUri) {
  const pastCharacterId = nextId('char');
  characters.set(pastCharacterId, {
    id: pastCharacterId,
    characterImageUrl: pastCharacterUri,
    style: 'PIXME_BASIC',
    label: null,
    isCurrent: false,
    hasOriginal: false,
    createdAt: isoNow(-60 * 24 * 3),
  });
}

settings.squareVisible = true;
settings.squareOnboarded = true;
entitlements.firstGenerationAvailable = false;
entitlements.firstRetryAvailable = true;
refreshNextGenerationIsFree();

/* --------------------------------------------------------------- square --- */

/** Must match `layout.squareCanvas`; occupant coords are in this space. */
const CANVAS = { width: 1000, height: 1400 };

/**
 * Mirrors the real `SquarePlacementAllocator`: Mitchell's best-candidate
 * sampling, not a grid. A grid reads as a seating chart; this reads as a
 * crowd. Deterministic (seeded by index) so the mock layout is stable across
 * renders without needing to persist anything.
 */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLACEMENT_SEED = 20261010;
const CANDIDATES_PER_POINT = 12;
const MARGIN_RATIO = 0.1;

/**
 * Every prop's coordinate, fed in as already-taken points so a person can
 * never be proposed on top of a tree or a fountain — the same technique
 * `SquareService` uses server-side, ported here since the mock has no
 * database to seed from.
 */
const PROP_POINTS = [
  { x: 150, y: 150 },
  { x: 820, y: 150 },
  { x: 500, y: 520 },
  { x: 500, y: 850 },
  { x: 850, y: 1150 },
];

let placedPoints: { x: number; y: number }[] = [...PROP_POINTS];

/**
 * Re-seeded on every call so repeated refetches reproduce the same layout
 * instead of `placedPoints` growing without bound across refetches (which
 * would also make placement quality silently degrade over a long preview
 * session as every new candidate had more and more "taken" points to dodge).
 */
function resetPlacement(): () => number {
  placedPoints = [...PROP_POINTS];
  return mulberry32(PLACEMENT_SEED);
}

let random = mulberry32(PLACEMENT_SEED);

function placeInCanvas(): { x: number; y: number } {
  const marginX = CANVAS.width * MARGIN_RATIO;
  const marginY = CANVAS.height * MARGIN_RATIO;
  const usableWidth = CANVAS.width - marginX * 2;
  const usableHeight = CANVAS.height - marginY * 2;

  let best = { x: CANVAS.width / 2, y: CANVAS.height / 2 };
  let bestDistance = -1;

  for (let attempt = 0; attempt < CANDIDATES_PER_POINT; attempt += 1) {
    const candidate = {
      x: marginX + random() * usableWidth,
      y: marginY + random() * usableHeight,
    };
    let nearest = Infinity;
    for (const point of placedPoints) {
      const dx = point.x - candidate.x;
      const dy = point.y - candidate.y;
      // Vertical distance weighted more: two people side by side read fine,
      // one directly behind another occludes them.
      const distance = Math.sqrt(dx * dx + dy * dy * 1.8);
      if (distance < nearest) nearest = distance;
    }
    if (nearest > bestDistance) {
      bestDistance = nearest;
      best = candidate;
    }
  }

  placedPoints.push(best);
  return best;
}

const squareScene: SquareResponse['scene'] = {
  code: 'BASIC',
  name: '오늘의 광장',
  version: 1,
  palette: { sky: '#EAF2FF', ground: '#F6F1E4', accent: '#7C6CF0' },
  props: [
    { code: 'TREE', x: 150, y: 150, scale: 1.4, zIndex: 1 },
    { code: 'CAFE', x: 820, y: 150, scale: 1.6, zIndex: 0 },
    { code: 'BENCH', x: 500, y: 520, scale: 1.1, zIndex: 2 },
    { code: 'FOUNTAIN', x: 500, y: 850, scale: 1.5, zIndex: 2 },
    { code: 'PLANT', x: 850, y: 1150, scale: 1.1, zIndex: 3 },
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

/**
 * Mirrors the server's mutual-match rule: a wave only becomes a connection
 * when the other side has *already* waved. There is no second device in a
 * preview to send that second wave live, so one seed identity starts in
 * `REQUESTED_BY_THEM` (she "already" waved at you) to demonstrate the
 * instant-match path, and the rest start at `NONE` to demonstrate the
 * one-sided "마음을 전했어요" path — every wave connecting instantly, which this
 * replaced, hid the asymmetry that is the entire point of the feature.
 */
function requestConnection(userId: string): { status: ConnectionStatus; connection: Connection | null } {
  const target = personById(userId);
  if (!target) {
    throw new ApiError({ code: ApiErrorCode.Validation, message: '사용자를 찾을 수 없어요.', status: 404 });
  }

  if (target.connectionStatus === 'CONNECTED') {
    return { status: 'CONNECTED', connection: connections.get(connectionId(target.id)) ?? null };
  }
  if (target.connectionStatus === 'REQUESTED_BY_THEM') {
    return { status: 'CONNECTED', connection: finalizeConnection(target) };
  }
  if (target.connectionStatus === 'REQUESTED_BY_ME') {
    // Idempotent — already waved, no new state.
    return { status: 'REQUESTED_BY_ME', connection: null };
  }

  target.connectionStatus = 'REQUESTED_BY_ME';
  return { status: 'REQUESTED_BY_ME', connection: null };
}

function finalizeConnection(
  target: MockPersonState,
  fixedConversationId?: string,
): Connection {
  target.connectionStatus = 'CONNECTED';
  target.connectionCount += 1;
  me.connectionCount += 1;

  // The seeded conversation takes a stable id so it can be deep-linked
  // (`pixme://chat/<id>`) when capturing screens; live ones stay generated.
  const conversationId = fixedConversationId ?? nextId('conv');
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

/**
 * One conversation that already exists when the preview opens.
 *
 * <p>Preview mode started every account with zero connections, which meant
 * 대화 was permanently an empty state — fine for checking the empty state,
 * useless for seeing (or capturing) what the screen looks like in use. 준서
 * is seeded as already connected with a short exchange; 민주 stays on
 * `REQUESTED_BY_THEM` so the instant-match path is still demonstrable.
 */
const SEEDED_CONVERSATION_ID = 'mock-conv-seed';

function seedConversation(): void {
  const peer = others.find((person) => person.id === 'mock-ahdzz');
  if (!peer) return;

  const connection = finalizeConnection(peer, SEEDED_CONVERSATION_ID);
  const conversationId = connection.conversationId;
  if (!conversationId) return;

  const thread: Message[] = [
    {
      id: nextId('msg'),
      conversationId,
      senderId: null,
      type: 'SYSTEM',
      content: copy.chat.systemConnected,
      createdAt: isoNow(-182),
      readAt: isoNow(-182),
    },
    {
      id: nextId('msg'),
      conversationId,
      senderId: peer.id,
      type: 'TEXT',
      content: '안녕하세요! 오늘 PIXME 보고 반가워서 눌렀어요 😊',
      createdAt: isoNow(-176),
      readAt: isoNow(-170),
    },
    {
      id: nextId('msg'),
      conversationId,
      senderId: me.id,
      type: 'TEXT',
      content: '저도요! 산책 좋아하시나봐요',
      createdAt: isoNow(-168),
      readAt: isoNow(-160),
    },
    {
      id: nextId('msg'),
      conversationId,
      senderId: peer.id,
      type: 'TEXT',
      content: '네 퇴근하고 한 바퀴 도는 게 요즘 유일한 낙이에요',
      createdAt: isoNow(-14),
      readAt: null,
    },
  ];
  messages.set(conversationId, thread);

  const last = thread[thread.length - 1]!;
  conversations.set(conversationId, {
    id: conversationId,
    peer: author(peer),
    lastMessage: last,
    unreadCount: 1,
    lastMessageAt: last.createdAt,
    createdAt: isoNow(-182),
    inactive: false,
  });
}

/* -------------------------------------------------------------------- chat */

const conversations = new Map<string, Conversation>();
const messages = new Map<string, Message[]>();

seedConversation();

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
  kakaoNative: async () => {
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
      // One subscriber in the preview, so the profile badge is actually visible.
      plus: person.id === 'mock-minju',
      // 민주 wears a decorated profile in the preview — the point of sending
      // these is that *other people* see what she chose.
      decorations:
        person.id === 'mock-minju'
          ? { BACKGROUND: 'BG_STARRY', FRAME: 'FRAME_PIXEL', NICKNAME: 'NICKNAME_GLOW' }
          : {},
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
    random = resetPlacement();
    const occupants: SquareOccupant[] = present
      .map((person, index) => {
        const statusId = todayStatusByPerson.get(person.id);
        const status = statusId ? dailyStatuses.get(statusId) ?? null : null;
        const { x, y } = placeInCanvas();
        return {
          userId: person.id,
          dailyStatusId: status?.id ?? null,
          nickname: person.nickname,
          characterImageUrl: representativeUrlOf(person) ?? MOCK_CHARACTER_URI,
          mood: status?.mood ?? null,
          message: status?.message ?? null,
          presenceState: (index === 0 ? 'JUST_ARRIVED' : 'ACTIVE') as SquareOccupant['presenceState'],
          x,
          y,
          idleVariant: index % 3,
          // Same rule the server uses: higher up the canvas reads as further back.
          depth: Math.min(4, Math.max(0, Math.round((1 - y / CANVAS.height) * 4))),
        };
      })
      // Painter's order, as the server returns it: back row drawn first.
      .sort((a, b) => a.y - b.y);

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
          ? [{ code: 'HEARTS', title: '🔥 오늘 좋아요를 많이 받은', entries: heartsRail }]
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
    return requestConnection(userId);
  },
  cancel: async (userId) => {
    await delay(150);
    const target = personById(userId);
    if (target?.connectionStatus === 'REQUESTED_BY_ME') {
      target.connectionStatus = 'NONE';
    }
    return { status: target?.connectionStatus ?? 'NONE', connection: null };
  },
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
      // Mirrors the six paid styles the server seeds. Left empty originally,
      // which quietly hid the 스타일 section here *and* left the style buy
      // sheet in 미리보기 with no price to show — the one screen where these
      // are actually sold.
      styles: [
        product('STYLE_Y2K', 'STYLE', 'Y2K 픽셀', '2000년대 감성의 선명한 색과 굵은 외곽선.', 2900, null, 'Y2K_PIXEL', null),
        product('STYLE_16BIT', 'STYLE', '16비트', '한 단계 더 촘촘한 픽셀과 풍부한 음영.', 2900, null, 'BIT_16', null),
        product('STYLE_RETRO_PC', 'STYLE', '레트로 PC', '제한된 팔레트의 초기 PC 화면 느낌.', 2900, null, 'RETRO_PC', null),
        product('STYLE_ARCADE', 'STYLE', '아케이드', '오락실 캐비닛에서 막 나온 듯한 대비.', 2900, null, 'ARCADE', null),
        product('STYLE_MINI', 'STYLE', '미니 픽셀', '더 작고 동글동글한 비율.', 2900, null, 'MINI_PIXEL', null),
        product('STYLE_SOFT', 'STYLE', '소프트 픽셀', '부드러운 파스텔 톤의 차분한 마감.', 2900, null, 'SOFT_PIXEL', null),
      ],
      // Mirrors MOCK_DECORATIONS (the richer catalog `/decorations` uses) as
      // plain store products — this is what makes the decoration purchase
      // dialog's "스토어에서 보기" CTA land somewhere populated instead of an
      // empty 꾸미기 section.
      decorations: MOCK_DECORATIONS.map((item) =>
        product(
          item.storeProductCode,
          'DECORATION',
          item.name,
          item.description,
          item.fallbackPriceKrw,
          null,
          item.unlockCode,
          null,
        ),
      ),
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
  restorePurchases: async () => ({
    entitlements,
    restoredCount: 0,
    ownedByAnotherAccountCount: 0,
  }),
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

/* ----------------------------------------------------------- decorations --- */

/**
 * A slice of the real catalog, enough to exercise every slot in the picker.
 * `owned` mirrors the server rule: bought outright, or any item at all while
 * PIXME+ is active.
 */
const MOCK_DECORATIONS: DecorationItem[] = [
  {
    unlockCode: 'BG_SUNSET',
    slot: 'BACKGROUND',
    name: '노을 배경',
    description: '카드 배경을 노을빛으로.',
    fallbackPriceKrw: 1900,
    storeProductCode: 'DECOR_BG_SUNSET',
    owned: true,
    viaPlus: false,
    plusOnly: false,
  },
  {
    unlockCode: 'BG_STARRY',
    slot: 'BACKGROUND',
    name: '별밤 배경',
    description: '작은 픽셀 별이 반짝이는 배경.',
    fallbackPriceKrw: 1900,
    storeProductCode: 'DECOR_BG_STARRY',
    owned: false,
    viaPlus: false,
    plusOnly: false,
  },
  {
    unlockCode: 'BG_ANIMATED_RAIN',
    slot: 'BACKGROUND',
    name: '움직이는 비 배경',
    description: '카드 뒤로 픽셀 빗방울이 조용히 내려요.',
    fallbackPriceKrw: 2900,
    storeProductCode: 'DECOR_BG_ANIMATED_RAIN',
    owned: false,
    viaPlus: false,
    plusOnly: false,
  },
  {
    unlockCode: 'BG_ANIMATED_SNOW',
    slot: 'BACKGROUND',
    name: '움직이는 눈 배경',
    description: '천천히 쌓이는 픽셀 눈.',
    fallbackPriceKrw: 2900,
    storeProductCode: 'DECOR_BG_ANIMATED_SNOW',
    owned: false,
    viaPlus: false,
    plusOnly: false,
  },
  {
    unlockCode: 'FRAME_PIXEL',
    slot: 'FRAME',
    name: '픽셀 프레임',
    description: '카드 테두리를 픽셀 프레임으로.',
    fallbackPriceKrw: 1900,
    storeProductCode: 'DECOR_FRAME_PIXEL',
    owned: true,
    viaPlus: false,
    plusOnly: false,
  },
  {
    unlockCode: 'NICKNAME_GLOW',
    slot: 'NICKNAME',
    name: '닉네임 글로우',
    description: '닉네임에 은은한 빛을 더해요.',
    fallbackPriceKrw: 1900,
    storeProductCode: 'DECOR_NICKNAME_GLOW',
    owned: false,
    viaPlus: false,
    plusOnly: false,
  },
  {
    unlockCode: 'PARTICLE_HEART',
    slot: 'PARTICLE',
    name: '하트 파티클',
    description: '하트를 받을 때 더 특별한 연출.',
    fallbackPriceKrw: 1900,
    storeProductCode: 'DECOR_PARTICLE_HEART',
    owned: false,
    viaPlus: false,
    plusOnly: false,
  },
  {
    unlockCode: 'THEME_PAPER',
    slot: 'THEME',
    name: '종이 프로필 테마',
    description: '프로필 전체를 종이 질감으로.',
    fallbackPriceKrw: 2900,
    storeProductCode: 'DECOR_THEME_PAPER',
    owned: false,
    viaPlus: false,
    plusOnly: false,
  },
  {
    unlockCode: 'THEME_NIGHT',
    slot: 'THEME',
    name: '밤하늘 프로필 테마',
    description: '프로필 전체를 깊은 밤 색으로.',
    fallbackPriceKrw: 3900,
    storeProductCode: 'DECOR_THEME_NIGHT',
    owned: false,
    viaPlus: false,
    plusOnly: false,
  },
];

function decorationView(): DecorationsResponse {
  // PIXME+ opens the whole catalog for as long as it is active — the same
  // live rule the server applies, so the preview can't drift from it.
  const items = MOCK_DECORATIONS.map((item) => ({
    ...item,
    owned: item.owned || entitlements.plusActive,
    viaPlus: !item.owned && entitlements.plusActive,
  }));
  return { items, active: { ...activeDecorations } };
}

export const mockDecorationsApi = {
  list: async (): Promise<DecorationsResponse> => {
    await delay(120);
    return decorationView();
  },
  apply: async (slot, unlockCode): Promise<DecorationsResponse> => {
    await delay(150);
    if (!unlockCode) {
      delete activeDecorations[slot];
      return decorationView();
    }

    const item = decorationView().items.find(
      (candidate) => candidate.unlockCode === unlockCode,
    );
    if (!item) {
      throw new ApiError({ code: ApiErrorCode.Validation, message: '존재하지 않는 꾸미기예요.', status: 400 });
    }
    if (item.slot !== slot) {
      throw new ApiError({ code: ApiErrorCode.Validation, message: '이 자리에 적용할 수 없는 꾸미기예요.', status: 400 });
    }
    if (!item.owned) {
      throw new ApiError({ code: ApiErrorCode.Forbidden, message: '아직 보유하지 않은 꾸미기예요.', status: 403 });
    }

    activeDecorations[slot] = unlockCode;
    return decorationView();
  },
} satisfies typeof realDecorationsApi;
