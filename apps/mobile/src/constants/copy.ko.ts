/**
 * Korean copy — PIXME's source locale and its fallback.
 *
 * PIXME's voice: short, warm, lowercase-ish, never evaluative. We never say
 * "다음", "패스", "싫어요" about another person, and never frame the product
 * as matching or rating. Keeping the strings here makes that reviewable in one
 * place.
 *
 * <p>This bundle is the shape of record: `Copy` in `./copy` is derived from it,
 * so adding a key here is what makes it exist (and what makes `copy.en.ts`
 * fail to compile until it is translated too).
 */
export const ko = {
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
      body: '♡ 좋아요를 누르거나\n👋 친해지고 싶다는 마음을 표현해보세요.',
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
    nicknameForbidden: '사용불가능한 닉네임입니다.',
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
    doneBody: '오늘 입은 모습을 사진으로 찍으면\n그대로 내 픽셀 캐릭터가 돼요.',
    doneCta: 'PIXME 만들기',
    nicknameRequired: '닉네임을 입력해주세요.',
    nicknameInvalid: '한글, 영문, 숫자, _만 쓸 수 있어요.',
    nicknameChecking: '확인 중…',
    nicknameAvailable: '사용할 수 있어요.',
    nicknameCheckFailed: '지금은 중복 확인을 할 수 없어요. 계속 진행할 수 있어요.',
    nicknameSuggestion: (suggestion: string) => `대신 "${suggestion}" 어때요?`,
    birthInvalid: '날짜를 다시 확인해주세요.',
    doneLater: '먼저 둘러볼래요',
  },

  today: {
    title: '오늘',
    emptyTitle: '오늘의 PIXME가 아직 조용해요.',
    emptyBody: '첫 번째로 오늘을 남겨볼까요?',
    /** Generic "make a character" — the paid action. */
    emptyCta: 'PIXME 만들기',
    /**
     * Shown instead of `emptyTitle`/`emptyBody` when the viewer already left
     * today's status and the feed is empty because nobody *else* has yet —
     * not because they haven't gone first. Saying "남겨볼까요?" to someone who
     * already did is simply wrong, and it has nothing left to pay for today.
     */
    emptyAfterPostedTitle: '아직 다른 사람이 없어요.',
    emptyAfterPostedBody: '오늘 활동하는 사람이 생기면 여기서 만나요.',
    browseSquare: '광장 둘러보기',
    /**
     * The free action, and the one that actually puts someone on Today and in
     * the square. Only offered to people who already have a PIXME to show —
     * a status has to point at a character.
     */
    statusCta: '오늘 상태 남기기',
    endTitle: '오늘은 여기까지예요.',
    endBody: '내일 또 새로운 오늘이 올라와요.',
    statusDoneTitle: '오늘의 상태를 남겼어요.',
    myPixelMissingTitle: '오늘은 어떻게 지내고 있나요?',
    myPixelMissingCta: 'PIXME 만들기',
  },

  square: {
    title: '오늘의 광장',
    subtitle: '오늘 활동 중인 사람들이 모여 있어요.',
    emptyTitle: '광장이 아직 비어 있어요.',
    emptyBody: '오늘 상태를 남기면 가장 먼저 광장에 서게 돼요.',
    /** First visit only. Nobody appears in the square without choosing to. */
    consentTitle: '광장에 나가볼까요?',
    consentBody:
      '켜면 오늘 활동할 때 내 PIXME가 광장에 나타나요.\n끄면 앱은 그대로 쓸 수 있고, 광장에만 보이지 않아요.',
    consentAccept: '광장에 나가기',
    consentDecline: '나중에',
    hiddenBanner: '지금은 광장에 보이지 않아요.',
    hiddenBannerCta: '켜기',
    nowVisible: '이제 광장에 나타나요.',
    nowHidden: '광장에서 내렸어요.',
    curations: {
      hearts: '🔥 오늘 좋아요를 많이 받은',
      fresh: '✨ 지금 막 도착했어요',
      active: '🌙 지금 활동 중',
      recurring: '💫 오늘 자주 보이는 PIXME',
    },
    /** Short form for the tab bar and section headers. */
    tabTitle: '광장',
    tapHint: '캐릭터를 눌러 오늘의 한마디를 볼 수 있어요.',
    occupantCount: (n: number) => `오늘 ${n}명이 광장에 나와 있어요.`,
    moveHint: '빈 자리를 누르면 그쪽으로 걸어가요.',
    peopleCount: (n: number) => `${n}명`,
  },

  create: {
    styles: {
      PIXME_BASIC: '기본',
      SOFT_PIXEL: '소프트 픽셀',
      MINI_PIXEL: '미니 픽셀',
      BIT_16: '16비트',
      RETRO_PC: '레트로 PC',
      ARCADE: '아케이드',
      Y2K_PIXEL: 'Y2K 픽셀',
    },
    styleLocked: '스토어에서 열 수 있어요.',
    styleBuyTitle: (name: string) => `${name} 스타일, 구매할까요?`,
    styleBuyBody:
      '한 번 구매하면 계속 쓸 수 있어요. 구매 후 바로 이 사진에 적용돼요.\n\n구매 후에는 전자상거래법에 따라 사용 전 7일 이내에만 청약철회가 가능해요.',
    sheetTitle: '오늘의 나를 PIXME로 남겨볼까요?',
    camera: '사진 찍기',
    library: '사진에서 선택',
    hint: '전신이 보일수록 오늘의 옷을 더 잘 표현할 수 있어요.',
    guideSelfie: '셀카 — 얼굴이 크게',
    guideOotd: '전신 — 머리부터 신발까지',
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
    /** A status needs a character to point at, so this comes first. */
    needPixelFirst: '먼저 PIXME를 만들어주세요.',
    alreadyPublished:
      '오늘의 PIXME를 이미 만들었어요. 새로 만들면 Current PIXME를 바꿀 수 있어요.',
    missingPhoto: '사진을 다시 선택해주세요.',
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
    /** Every result after the first — no free retry to offer, so just show it. */
    readyTitle: 'PIXME가 완성됐어요.',
    alreadyAcceptedTitle: '이미 선택한 PIXME예요.',
    accept: '이걸로 할래요',
    /** Only on the first character's result screen — the one and only retry. */
    freeRetry: '한 번 더 무료로 만들어보기',
    freeRetryHint: '첫 PIXME는 한 번 더 무료로 만들어볼 수 있어요.',
    /** Shown whenever a retry produced a second candidate. */
    compareTitle: '마음에 드는 쪽을 골라주세요.',
    compareFirst: '처음 만든 모습',
    compareSecond: '다시 만든 모습',
    compareHint: '두 모습 모두 내 기록에 남아요.',
    retryCostFree: '무료로 만들 수 있어요.',
    /** Neutral balance line shown above the camera/library buttons. */
    balance: (n: number) => `생성권 ${n}개`,
    noCreditTitle: '생성권이 없어요',
    noCreditBody: '사진을 올리려면 생성권이 필요해요. 스토어에서 받아볼까요?',
    noCreditCta: '스토어로 가기',
    failedTitle: '이번에는 픽셀로 옮기지 못했어요.',
    failedBody: '생성권은 사용되지 않았어요.',
    unsafeTitle: '이 사진으로는 PIXME를 만들기 어려워요.',
    unsafeBody: '얼굴과 옷이 잘 보이는 다른 사진으로 다시 시도해주세요.',
    timeoutTitle: '생각보다 오래 걸리고 있어요.',
    backgroundNotice: '창을 닫아도 생성은 계속돼요. 완성되면 알림으로 알려드릴게요.',
    timeoutBody: '완성되면 알림으로 알려드릴게요.',
  },

  publish: {
    title: '오늘의 나',
    captionLabel: '오늘의 한마디',
    captionPlaceholder: '오늘은 어떤 하루인가요?',
    moodLabel: '오늘의 기분',
    tagLabel: '태그',
    tagHint: '최대 4개까지 고를 수 있어요.',
    cta: '이 모습으로 오늘 남기기',
    /** Nothing is ever replaced — every kept character stays in the Collection. */
    collectionNotice:
      '지금까지 만든 PIXME는 모두 보관돼요.',
    customTagPlaceholder: '직접 입력',
    addTag: '추가',
    successTitle: '오늘의 PIXME를 남겼어요.',
  },

  reactions: {
    heart: '좋아요',
    heartSent: '좋아요를 눌렀어요',
    wave: '친해지고 싶어요',
    /** The wave button's own label once sent — not a toast. Short on purpose: it has to fit the button. */
    waveSentLabel: '보냈어요',
    waveSent: '마음을 전했어요',
    waveAlready: '이미 마음을 전했어요',
    connectedTitle: '✨ 둘이 연결됐어요.',
    connectedBody: '오늘의 PIXME를 계기로 새로운 사람이 연결됐어요.',
    connectedCta: '대화 시작',
    connectedLater: '나중에',
    waveComposeTitle: '친해지고 싶어요',
    waveComposeBody:
      '한 줄을 남기면, 서로 마음이 통했을 때 대화의 첫 마디가 돼요. 상대가 먼저 보기 전까진 아무에게도 보이지 않아요.',
    waveComposePlaceholder: '예) 옷 스타일이 멋져요!',
    waveComposeSend: '보내기',
    waveComposeSkip: '메시지 없이 보내기',
  },

  profile: {
    recent: '최근의 나',
    recentOther: '최근 PIXME',
    history: '픽셀 기록',
    receivedHearts: '받은 좋아요',
    connections: '연결된 사람',
    interests: '관심사',
    streak: '연속 기록',
    streakDays: (days: number) => `${days}일`,
    edit: '프로필 수정',
    emptyHistoryTitle: '아직 기록이 없어요.',
    emptyHistoryBody: '오늘 상태를 남기면 여기에 하루씩 쌓여요.',
    nicknameLabel: '닉네임',
    bioLabel: '한줄소개',
    saved: '프로필을 저장했어요.',
    birthLocked: '생년월일은 변경할 수 없어요. 잘못 입력했다면 고객센터로 알려주세요.',
    view: '프로필 보기',
    short: '프로필',
    stats: (hearts: string, pixels: string) =>
      `받은 좋아요 ${hearts} · PIXME ${pixels}`,
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
    browseToday: '오늘 구경하기',
    peerConnected: '오늘의 PIXME를 계기로 연결된 사이예요.',
    sendFailed: '메시지를 보내지 못했어요. 다시 시도해주세요.',
  },

  my: {
    title: 'MY',
    editProfile: '프로필 수정',
    plus: 'PIXME+',
    history: '내 픽셀 기록',
    settings: '설정',
    showOriginal: '원본 보기',
    hideOriginal: '원본 숨기기',
    firstPixelFree: '첫 PIXME는 무료예요.',
    firstRetryLeft: '첫 PIXME의 무료 재시도가 남아 있어요.',
    tapForMore: '탭해서 더 받기',
    decorPlus: 'PIXME+로 모든 꾸미기를 쓸 수 있어요.',
    decorHint: '배경과 테마를 골라 내 카드에 적용해요.',
    originalDeleted: '원본 사진은 저장하지 않았어요.',
  },

  notifications: {
    title: '알림',
    emptyTitle: '아직 알림이 없어요.',
    emptyBody: '좋아요와 새로운 연결이 생기면 여기로 알려드려요.',
    markAllRead: '모두 읽음',
    promptTitle: '알림을 받을까요?',
    promptBody:
      '누군가 내 PIXME에 좋아요를 남기거나, 서로 👋를 보내 대화가 열리면 알려드려요. 설정에서 언제든 바꿀 수 있어요.',
    promptAccept: '알림 받기',
    promptDecline: '나중에',
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
    ownedByAnotherAccount:
      '이 기기에서 이미 다른 계정으로 구매한 항목이에요. 그 계정으로 로그인하면 바로 쓸 수 있어요.',
    notAvailable: '지금은 이 상품을 불러올 수 없어요. 잠시 후 다시 시도해주세요.',
    purchaseCancelled: '결제를 취소했어요.',
    verifying: '결제를 확인하고 있어요…',
    successTitle: '준비됐어요!',
    /** Shared by the store list and the decoration picker. */
    owned: '보유 중',
    balanceNow: (n: number) => `지금 보유한 생성권 ${n}개`,
    firstFree: '첫 PIXME는 무료로 만들 수 있어요.',
    firstFreeUsed: '무료 생성을 모두 사용했어요.',
    legal:
      '좋아요, 연결, 대화는 언제나 무료예요. 친해지고 싶어요는 하루 2번 무료이고 PIXME+는 하루 5번까지 보낼 수 있어요. 결제는 스토어 계정으로 진행되고, 생성에 실패하면 사용된 생성권은 자동으로 돌려드려요.',
    subscriptionStarted: (name: string) => `${name} 구독이 시작됐어요.`,
    creditsAdded: (n: number) => `생성권 ${n}개가 추가됐어요.`,
    itemReady: (name: string) => `${name}을(를) 사용할 수 있어요.`,
    purchaseDone: '구매가 완료됐어요.',
    pending: '결제 확인에 시간이 걸리고 있어요. 완료되면 알려드릴게요.',
    applyNow: '바로 적용하기',
    applied: '적용했어요.',
  },

  plus: {
    title: 'PIXME+',
    tagline: '매일의 나를 더 자유롭게.',
    cta: 'PIXME+ 시작하기',
    manage: '구독 관리',
    legal:
      '구독은 자동 갱신되며, 기기 설정에서 언제든 해지할 수 있어요. 해지하거나 구독이 끝나면 프리미엄 배경·테마는 자동으로 기본값으로 돌아가요.',
    activeUntil: (date: string) => `${date}까지 이용 중`,
    note: 'PIXME+는 자기표현을 넓히는 구독이에요. 좋아요, 연결, 대화는 구독과 무관하게 모두에게 무료예요. 친해지고 싶어요는 누구나 하루 2번 무료이고, PIXME+는 하루 5번까지 보낼 수 있어요.',
  },

  share: {
    cta: '공유하기',
    unavailable: '공유할 수 있는 앱이 없어요.',
  },

  gate: {
    title: '먼저 PIXME를 만들어주세요.',
    body: '캐릭터가 하나 이상 있어야 광장과 대화를 쓸 수 있어요.\n오늘의 사진 한 장이면 돼요.',
    cta: 'PIXME 만들기',
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
    reportReasons: {
      INAPPROPRIATE_CONTENT: {
        label: '부적절한 콘텐츠',
        hint: '서비스에 맞지 않는 사진이나 글이에요.',
      },
      HARASSMENT: { label: '괴롭힘', hint: '불쾌하게 하거나 위협했어요.' },
      IMPERSONATION: { label: '사칭', hint: '다른 사람인 척하고 있어요.' },
      SPAM: { label: '광고 / 스팸', hint: '홍보나 반복적인 메시지예요.' },
      SEXUAL_CONTENT: { label: '성적 콘텐츠', hint: '성적인 내용이 포함돼 있어요.' },
      HATE_SPEECH: { label: '혐오 표현', hint: '특정 집단을 비하했어요.' },
      OTHER: { label: '기타', hint: '위에 없는 다른 이유예요.' },
    },
    reportNote:
      '접수된 신고는 운영팀이 확인하고, 필요한 경우 게시물 삭제나 이용 제한 조치를 해요. 처리 결과는 알림으로 알려드려요.',
    blockedAt: (when: string) => `${when} 차단`,
    blockedNote:
      '차단을 해제하면 서로의 PIXME가 다시 보일 수 있어요. 이전 대화는 복구되지 않아요.',
    unblockTitle: (nickname: string) => `${nickname} 차단을 해제할까요?`,
    unblockBody: '해제하면 서로의 오늘의 PIXME가 다시 보일 수 있어요.',
    unblocked: '차단을 해제했어요.',
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
    privacySection: '개인정보',
    termsSection: '약관',
    displaySection: '화면',
    photosSection: '사진',
    support: '문의하기',
    plusActive: '이용 중',
    themeLight: '라이트',
    themeDark: '다크',
    themeSystem: '시스템 설정',
    squareVisible: '오늘 광장에 표시',
    squareVisibleHint:
      '켜두면 오늘 활동할 때 광장에 내 Current PIXME가 나타나요. 끄면 앱은 평소처럼 쓸 수 있고, 광장에만 보이지 않아요.',
    squareVisibleOn: '오늘 활동하면 광장에 나타나요.',
    squareVisibleOff: '더 이상 광장에 나타나지 않아요.',
    keepOriginalOn: '원본 사진을 보관해요.',
    keepOriginalOff: '앞으로 원본 사진은 생성 직후 삭제돼요.',
    photoPolicyTitle: 'PIXME가 사진을 다루는 방식',
    photoPolicyPrivate:
      '원본 사진은 비공개 저장소에 올라가고, 다른 사용자에게는 어떤 경우에도 보이지 않아요.',
    photoPolicyScope:
      '캐릭터를 만드는 데 필요한 범위에서만 사용하고, 위치 정보 같은 사진 메타데이터는 올리기 전에 지워요.',
    photoPolicyDelete:
      '내 기록에서 원본을 개별 삭제할 수 있고, 계정을 삭제하면 모두 지워져요.',
    pushTypesSection: '알림 종류',
    pushDeniedBanner:
      '기기 설정에서 PIXME 알림이 꺼져 있어요. 아래 설정은 알림을 켠 뒤에 적용돼요.',
    pushNote:
      'PIXME는 알림을 아껴서 보내요. 좋아요는 묶어서, 오늘의 알림은 하루에 한 번만 보내고, 이미 오늘의 PIXME를 남겼다면 보내지 않아요.',
    pushHeart: '♡ 좋아요',
    pushHeartHint: '누군가 내 PIXME에 좋아요를 눌렀을 때',
    pushConnected: '✨ 서로 연결됨',
    pushConnectedHint: '서로 마음이 통해 연결됐을 때',
    pushMessage: '💬 새로운 메시지',
    pushMessageHint: '연결된 사람이 메시지를 보냈을 때',
    pushDaily: '오늘의 PIXME 알림',
    pushDailyHint: '하루에 한 번, 아직 오늘을 남기지 않았을 때만',
    deleteItemsTitle: '삭제되는 항목',
    deleteItems: [
      '프로필과 닉네임',
      '지금까지 만든 PIXME와 원본 사진',
      '받은 좋아요와 연결 기록',
      '모든 대화 내용',
    ],
    deleteRetention:
      '삭제 요청 즉시 모든 공개 화면에서 사라지고, 법령상 보관이 필요한 결제 기록을 제외한 개인정보는 정책에 따라 영구 삭제돼요. 구독 중이라면 스토어에서 별도로 해지해주세요.',
    deleteReasonTitle: '떠나는 이유를 알려주실 수 있나요? (선택)',
    deleteReasons: [
      '잘 안 쓰게 돼요',
      '사진 올리는 게 부담돼요',
      '사람이 적어요',
      '알림이 많아요',
      '기타',
    ],
    deleted: '계정이 삭제됐어요. 그동안 함께해줘서 고마워요.',
  },

  /** PIXME Collection — the kept characters, and what can be done to one. */
  collection: {
    current: '현재 사용 중인 PIXME',
    currentShort: '현재',
    tapToSwitch: '탭하여 변경',
    switchCta: '이 모습으로 바꾸기',
    switched: '오늘의 PIXME를 바꿨어요.',
    createCta: '새 PIXME 만들기',
    deleteOriginal: '원본 사진 삭제',
    deleteOriginalTitle: '원본 사진을 삭제할까요?',
    deleteOriginalBody:
      'PIXME 캐릭터와 기록은 그대로 남아요. 원본 사진만 영구 삭제돼요.',
    originalDeleted: '원본 사진을 삭제했어요.',
    deletePixel: '이 PIXME 삭제',
    deletePixelTitle: '이 PIXME를 삭제할까요?',
    deletePixelBody:
      'Collection에서 사라져요. 이미 지나간 날의 기록에는 그대로 남아요.',
    pixelDeleted: 'PIXME를 삭제했어요.',
  },

  /** 내 픽셀 기록 — the grid/calendar of past days. */
  historyView: {
    calendarView: '달력으로 보기',
    gridView: '모아보기',
    weekdays: ['일', '월', '화', '수', '목', '금', '토'],
  },

  /** 꾸미기 — the picker, and buying from inside it. */
  decorations: {
    emptyTitle: '아직 꾸밀 수 있는 게 없어요.',
    emptyBody: '스토어에서 배경이나 테두리를 받아보세요.',
    emptyCta: '스토어 열기',
    note: '적용한 꾸미기는 내 카드와 프로필에서 다른 사람에게도 보여요.\n광장에서는 모두가 같은 모습으로 서 있어요.',
    moreInStore: '스토어에서 더 보기',
    active: '적용 중',
    nicknameSample: '닉네임',
    buyTitle: (name: string) => `${name}, 구매할까요?`,
    buyBody: (description: string, price: string) =>
      `${description}\n\n${price} · 한 번 구매하면 계속 쓸 수 있어요.\n\n구매 후에는 전자상거래법에 따라 사용 전 7일 이내에만 청약철회가 가능해요.`,
    buyCta: (price: string) => `${price} 결제하기`,
    boughtTitle: (name: string) => `'${name}'을(를) 얻었어요!`,
    boughtBody: '바로 적용해볼까요?',
    boughtApply: '바로 적용하기',
    boughtLater: '나중에 하기',
    viewInStore: '스토어에서 보기',
    slots: {
      BACKGROUND: '카드 배경',
      FRAME: '카드 테두리',
      NICKNAME: '닉네임',
      PARTICLE: '연출',
      POSE: '포즈',
      EMOTION: '표정',
    },
  },

  /**
   * The daily 친해지고 싶어요 allowance running out. Deliberately soft — this
   * is a dialog, not a paywall.
   */
  quota: {
    title: '오늘은 여기까지예요',
    body: '오늘 보낼 수 있는 친해지고 싶어요를 다 썼어요. 매일 자정에 다시 채워져요.',
    bodyUpsell:
      '오늘 보낼 수 있는 친해지고 싶어요를 다 썼어요. 매일 자정에 다시 채워져요.\n\nPIXME+는 하루 5번까지 보낼 수 있어요.',
    plusCta: 'PIXME+ 알아보기',
  },

  /**
   * Screen-reader labels and hints. They never appear on screen, but they are
   * read aloud, so they are copy like everything else.
   */
  a11y: {
    pixelCharacter: 'PIXME 캐릭터',
    back: '뒤로',
    more: '더보기',
    send: '보내기',
    newActivity: '새 소식',
    badgeCount: (n: number) => `${n}개`,
    myCurrentPixel: '내 Current PIXME',
    todayCurrentPixel: '오늘의 Current PIXME',
    userCurrentPixel: (nickname: string) => `${nickname}의 Current PIXME`,
    userPixel: (nickname: string) => `${nickname}의 PIXME`,
    userPixelOpen: (nickname: string) => `${nickname}의 PIXME 보기`,
    userTodayPixel: (nickname: string) => `${nickname}의 오늘의 PIXME`,
    openProfile: (nickname: string) => `${nickname}의 프로필 열기`,
    conversationWith: (nickname: string) => `${nickname}와의 대화`,
    startChatWith: (nickname: string) => `${nickname}와 대화 시작`,
    mood: (label: string) => `기분 ${label}`,
    dayPixel: (date: string) => `${date}의 PIXME`,
    thisDayPixel: '이 날의 PIXME',
    freshPixel: '방금 만들어진 내 PIXME',
    myPixel: '내 PIXME',
    originalPhoto: '원본 사진',
    selectedPhoto: '선택한 사진',
    guideSelfie: '얼굴이 잘 보이는 셀카 예시',
    guideOotd: '머리부터 신발까지 보이는 전신 사진 예시',
    buyCredits: '생성권 구매하기',
    squareGround: '빈 자리를 눌러 내 캐릭터 옮기기',
    collectionSwitch: '이 PIXME로 바꾸기',
    collectionHint: '길게 누르면 원본 사진과 삭제를 볼 수 있어요',
    decorationTile: (name: string, active: boolean) =>
      active ? `${name}, 적용 중` : name,
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

  /**
   * Taxonomy labels. The *codes* are the server's and never change; only how
   * they read does. Kept here rather than in `constants/moods.ts` etc. so a
   * locale swap reaches them too — those tables now hold only code + emoji.
   */
  moods: {
    HAPPY: '좋아요',
    LOVELY: '설레요',
    SLEEPY: '졸려요',
    BLANK: '그냥',
    MELTED: '녹았어요',
    TEARY: '그래도',
    COOL: '좀 괜찮',
    CHAOS: '정신없어요',
  },

  interests: {
    MUSIC: '음악',
    CAFE: '카페',
    MOVIE: '영화',
    TRAVEL: '여행',
    WORKOUT: '운동',
    WALK: '산책',
    GAME: '게임',
    FASHION: '패션',
    FOOD: '맛집',
    PHOTO: '사진',
    EXHIBITION: '전시',
    READING: '독서',
  },

  /**
   * Suggested tags are *content*, not chrome — they end up stored on the
   * status and shown to everyone. Localised anyway: asking an English user to
   * tag their day "꾸안꾸" is worse than the tag space not lining up
   * perfectly across languages, and users type their own either way.
   */
  suggestedTags: [
    '카페', '산책', '출근', '운동', '여행', '데이트', '꾸안꾸', '올블랙',
    '집', '야행성', '퇴근', '주말', '비오는날', '교복', '오버핏',
  ],
} as const;
