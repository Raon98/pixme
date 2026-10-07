/**
 * Centralised user-facing copy.
 *
 * PIXME's voice: short, warm, lowercase-ish, never evaluative. We never say
 * "다음", "패스", "싫어요" about another person, and never frame the product
 * as matching or rating. Keeping the strings here makes that reviewable in one
 * place (and is the seam for localisation later).
 */
export const copy = {
  brand: {
    name: 'PIXME',
    nameKo: '픽미',
    slogan: '오늘의 나를 픽셀로.',
    sloganEn: 'Pixel your day.',
  },

  onboarding: [
    {
      title: '오늘의 나를 픽셀로.',
      body: '사진 한 장으로\n오늘 입은 모습 그대로\n나만의 픽셀 캐릭터를 만들어보세요.',
    },
    {
      title: '다른 사람들의 오늘을 구경해요.',
      body: '매일 달라지는 사람들의\nPIXME를 만나보세요.',
    },
    {
      title: '가볍게 마음을 표현해요.',
      body: '♡ 하트를 보내거나\n👋 친해지고 싶다는 마음을 표현해보세요.',
    },
  ],
  onboardingCta: 'PIXME 시작하기',

  auth: {
    title: 'PIXME',
    subtitle: '오늘의 나를 픽셀로.',
    apple: 'Apple로 계속하기',
    kakao: '카카오로 계속하기',
    legal: '계속하면 이용약관과 개인정보처리방침에 동의하게 됩니다.',
    cancelled: '로그인을 취소했어요.',
    failed: '로그인에 실패했어요. 잠시 후 다시 시도해주세요.',
  },

  profileSetup: {
    nicknameTitle: '어떻게 불러드릴까요?',
    nicknameHint: '2~12자, 한글·영문·숫자를 쓸 수 있어요.',
    nicknamePlaceholder: '닉네임',
    nicknameTaken: '이미 사용 중인 닉네임이에요.',
    birthTitle: '생년월일을 알려주세요.',
    birthHint: '나이는 다른 사람에게 공개되지 않아요.',
    birthTooYoung: 'PIXME는 만 14세부터 이용할 수 있어요.',
    interestTitle: '요즘 뭐에 관심이 있나요?',
    interestHint: '여러 개 고를 수 있어요. 비슷한 사람의 오늘을 더 많이 보여드려요.',
    bioTitle: '한줄소개를 남겨볼까요?',
    bioHint: '나중에 바꿀 수 있어요.',
    bioPlaceholder: '예) 퇴근하고 산책 좋아해요',
    skip: '건너뛰기',
    done: '첫 PIXME를 만들어볼까요?',
    doneBody: '오늘 입은 모습을 사진으로 찍으면\n픽셀 캐릭터가 되어 광장에 나가요.',
    doneCta: 'PIXME 만들기',
    doneLater: '먼저 둘러볼래요',
  },

  today: {
    title: '오늘',
    emptyTitle: '오늘의 PIXME가 아직 조용해요.',
    emptyBody: '첫 번째로 오늘을 남겨볼까요?',
    emptyCta: 'PIXME 만들기',
    endTitle: '오늘은 여기까지예요.',
    endBody: '내일 또 새로운 오늘이 올라와요.',
    myPixelMissingTitle: '오늘의 나는 어떤 모습인가요?',
    myPixelMissingCta: 'PIXME 만들기',
  },

  square: {
    title: '오늘의 광장',
    subtitle: '오늘 PIXME를 만든 사람들이 모여 있어요.',
    emptyTitle: '광장이 아직 비어 있어요.',
    emptyBody: '오늘의 PIXME를 만들면 가장 먼저 광장에 서게 돼요.',
    curations: {
      hearts: '🔥 오늘 많이 받은 하트',
      fresh: '✨ 지금 막 도착했어요',
      active: '🌙 지금 활동 중',
      recurring: '💫 오늘 자주 보이는 PIXME',
    },
  },

  create: {
    sheetTitle: '오늘의 나를 PIXME로 남겨볼까요?',
    camera: '사진 찍기',
    library: '사진에서 선택',
    hint: '전신이 보일수록 오늘의 옷을 더 잘 표현할 수 있어요.',
    previewTitle: '이 사진으로 만들까요?',
    previewHint: '얼굴과 옷이 잘 보이게 맞춰주세요. 셀카도 괜찮아요.',
    previewCta: '이 사진으로 만들기',
    retake: '다시 고르기',
    permissionCameraTitle: '카메라 권한이 필요해요',
    permissionCameraBody:
      '설정에서 카메라 접근을 허용하면 바로 오늘의 PIXME를 만들 수 있어요.',
    permissionLibraryTitle: '사진 권한이 필요해요',
    permissionLibraryBody:
      '설정에서 사진 접근을 허용하면 앨범에서 사진을 고를 수 있어요.',
    openSettings: '설정 열기',
  },

  generation: {
    steps: [
      '오늘의 스타일을 살펴보고 있어요.',
      '헤어와 옷을 픽셀로 옮기는 중…',
      'PIXME가 거의 완성됐어요.',
    ],
    resultTitle: '오늘의 PIXME',
    firstResultTitle: '첫 PIXME가 완성됐어요.',
    accept: '이걸로 할래요',
    retry: '다시 만들어보기',
    /** Only on the first character's result screen. */
    freeRetry: '한 번 더 무료로 만들어보기',
    freeRetryHint: '첫 PIXME는 한 번 더 무료로 만들어볼 수 있어요.',
    /** Shown after the free retry, when there are two candidates. */
    compareTitle: '마음에 드는 쪽을 골라주세요.',
    compareFirst: '처음 만든 모습',
    compareSecond: '다시 만든 모습',
    retryCostFree: '무료로 만들 수 있어요.',
    retryCostCredit: '추가 생성권 1개가 사용돼요.',
    retryNoCredit: '생성권이 없어요. 스토어에서 받아볼까요?',
    bonusRemaining: '무료 PIXME 생성권 1개가 남아 있어요.',
    bonusRemainingCount: (count: number) =>
      `무료 PIXME 생성권 ${count}개가 남아 있어요.`,
    failedTitle: '이번에는 픽셀로 옮기지 못했어요.',
    failedBody: '생성권은 사용되지 않았어요.',
    unsafeTitle: '이 사진으로는 PIXME를 만들기 어려워요.',
    unsafeBody: '얼굴과 옷이 잘 보이는 다른 사진으로 다시 시도해주세요.',
    timeoutTitle: '생각보다 오래 걸리고 있어요.',
    timeoutBody: '완성되면 알림으로 알려드릴게요.',
  },

  publish: {
    title: '오늘의 PIXME',
    captionLabel: '오늘의 한마디',
    captionPlaceholder: '오늘은 어떤 하루인가요?',
    moodLabel: '오늘의 기분',
    tagLabel: '태그',
    tagHint: '최대 4개까지 고를 수 있어요.',
    cta: '오늘의 광장에 보내기',
    replaceTitle: '오늘의 PIXME를 바꿀까요?',
    replaceBody:
      '오늘 대표 PIXME는 하나예요. 새로 만든 모습으로 바꾸면 이전 모습은 내 기록에만 남아요.',
    replaceConfirm: '새 모습으로 바꾸기',
    replaceCancel: '그대로 둘래요',
    successTitle: '오늘의 PIXME가 광장에 도착했어요.',
  },

  reactions: {
    heart: '하트',
    heartSent: '하트를 보냈어요',
    wave: '친해지고 싶어요',
    waveSent: '마음을 전했어요',
    waveAlready: '이미 마음을 전했어요',
    connectedTitle: '✨ 둘이 연결됐어요.',
    connectedBody: '오늘의 PIXME를 계기로 새로운 사람이 연결됐어요.',
    connectedCta: '대화 시작',
    connectedLater: '나중에',
  },

  profile: {
    recent: '최근의 나',
    recentOther: '최근 PIXME',
    history: '픽셀 기록',
    receivedHearts: '받은 하트',
    connections: '연결된 사람',
    interests: '관심사',
    edit: '프로필 수정',
    emptyHistoryTitle: '아직 기록이 없어요.',
    emptyHistoryBody: '오늘의 PIXME를 만들면 여기에 하루씩 쌓여요.',
    blocked: '차단한 사용자예요.',
  },

  chat: {
    title: '대화',
    newConnections: '새로운 연결',
    recent: '최근 대화',
    emptyTitle: '아직 연결된 사람이 없어요.',
    emptyBody: '오늘의 PIXME를 구경하며 마음을 표현해보세요.',
    emptyMessagesTitle: '대화를 시작해보세요.',
    emptyMessagesBody: '서로 👋가 통하면 대화를 시작할 수 있어요.',
    systemConnected:
      'PIXME에서 서로 친해지고 싶다는 마음이 통했어요.',
    inputPlaceholder: '메시지 보내기',
    blockedByMe: '차단한 사용자와는 대화할 수 없어요.',
    leftConversation: '상대방이 더 이상 대화할 수 없는 상태예요.',
    reconnecting: '연결 중…',
  },

  my: {
    title: 'MY',
    editProfile: '프로필 수정',
    plus: 'PIXME+',
    history: '내 픽셀 기록',
    settings: '설정',
    showOriginal: '원본 보기',
    hideOriginal: '원본 숨기기',
    originalDeleted: '원본 사진은 저장하지 않았어요.',
  },

  notifications: {
    title: '알림',
    emptyTitle: '아직 알림이 없어요.',
    emptyBody: '하트와 새로운 연결이 생기면 여기로 알려드려요.',
    markAllRead: '모두 읽음',
  },

  store: {
    title: 'PIXME 스토어',
    creditsSection: '추가 생성권',
    stylesSection: '스타일',
    decorSection: '꾸미기',
    plusSection: 'PIXME+',
    restore: '구매 복원',
    restored: '구매 내역을 복원했어요.',
    nothingToRestore: '복원할 구매 내역이 없어요.',
    purchaseFailed: '결제를 완료하지 못했어요.',
    purchaseCancelled: '결제를 취소했어요.',
    verifying: '결제를 확인하고 있어요…',
    successTitle: '준비됐어요!',
    pending: '결제 확인에 시간이 걸리고 있어요. 완료되면 알려드릴게요.',
  },

  plus: {
    title: 'PIXME+',
    tagline: '매일의 나를 더 자유롭게.',
    cta: 'PIXME+ 시작하기',
    manage: '구독 관리',
    legal:
      '구독은 자동 갱신되며, 기기 설정에서 언제든 해지할 수 있어요.',
  },

  safety: {
    report: '신고',
    block: '차단',
    unblock: '차단 해제',
    blockTitle: '이 사용자를 차단할까요?',
    blockBody:
      '차단하면 서로의 PIXME가 보이지 않고, 대화도 더 이상 이어지지 않아요.',
    blockedTitle: '차단했어요.',
    reportTitle: '어떤 점이 문제였나요?',
    reportDetailPlaceholder: '자세한 내용을 알려주시면 확인에 도움이 돼요. (선택)',
    reportAlsoBlock: '이 사용자도 함께 차단하기',
    reportSubmit: '신고 보내기',
    reportDone: '신고를 접수했어요. 확인 후 조치할게요.',
    emptyBlockedTitle: '차단한 사용자가 없어요.',
  },

  settings: {
    title: '설정',
    account: '계정',
    notifications: '알림',
    blocked: '차단한 사용자',
    privacy: '개인정보처리방침',
    terms: '이용약관',
    plus: 'PIXME+',
    restore: '구매 복원',
    theme: '화면 테마',
    logout: '로그아웃',
    logoutConfirm: '로그아웃할까요?',
    deleteAccount: '계정 삭제',
    version: '앱 버전',
    keepOriginal: '원본 사진 보관',
    keepOriginalHint:
      '끄면 PIXME가 만들어진 뒤 원본 사진을 바로 삭제해요. 내 기록에서 원본을 다시 볼 수 없어요.',
    deleteTitle: '정말 계정을 삭제할까요?',
    deleteBody:
      '프로필, 지금까지 만든 PIXME 기록, 연결과 대화가 모두 삭제돼요. 되돌릴 수 없어요.',
    deleteConfirmHint: '확인을 위해 "삭제"를 입력해주세요.',
    deleteConfirmWord: '삭제',
    deleteCta: '계정 삭제',
    deleted: '계정이 삭제됐어요. 그동안 함께해줘서 고마워요.',
  },

  errors: {
    generic: '잠시 문제가 생겼어요.',
    feedLoad: '잠시 PIXME를 불러오지 못했어요.',
    network: '인터넷 연결을 확인해주세요.',
    retry: '다시 시도',
    sessionExpired: '다시 로그인해주세요.',
    notFound: '찾을 수 없는 내용이에요.',
    rateLimited: '잠시 후에 다시 시도해주세요.',
    serverMaintenance: 'PIXME를 점검하고 있어요. 조금만 기다려주세요.',
    updateRequired: '새 버전으로 업데이트하면 계속 사용할 수 있어요.',
    update: '업데이트',
  },

  common: {
    confirm: '확인',
    cancel: '취소',
    next: '다음',
    done: '완료',
    save: '저장',
    close: '닫기',
    delete: '삭제',
    loading: '불러오는 중…',
  },
} as const;
