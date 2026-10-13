import type { CopyBundle } from './copy.types';

/**
 * English copy.
 *
 * Written to match the Korean's voice rather than its words: short, warm,
 * contractions welcome, never evaluative about another person. Product nouns
 * (`PIXME`, `PIXME+`, `Current PIXME`, `PIXME Collection`) are never
 * translated. The mutual-interest gesture is "Say hi" — deliberately lighter
 * than "add friend", and distinct from "Like".
 *
 * <p>Typed as `CopyBundle`, which is the Korean bundle's shape with string
 * literals widened. A key added to `copy.ko.ts` and not translated here is a
 * compile error, and so is a key that exists only here.
 */
export const en: CopyBundle = {
  brand: {
    name: 'PIXME',
    nameKo: '픽미',
    slogan: 'Pixel your day.',
    sloganEn: 'Pixel your day.',
  },

  onboarding: [
    {
      title: 'Pixel your day.',
      body: 'One photo, and what you\nwore today becomes\na pixel character of your own.',
    },
    {
      title: "See how everyone's doing today.",
      body: 'Meet the PIXMEs people make,\nnew again every day.',
    },
    {
      title: 'Say how you feel, lightly.',
      body: 'Tap ♡ Like,\nor 👋 to say hi.',
    },
  ],
  onboardingCta: 'Start PIXME',

  auth: {
    title: 'PIXME',
    subtitle: 'Pixel your day.',
    apple: 'Continue with Apple',
    kakao: 'Continue with Kakao',
    legal: 'By continuing, you agree to our Terms of Service and Privacy Policy.',
    cancelled: 'Sign-in cancelled.',
    failed: "Couldn't sign you in. Please try again in a moment.",
  },

  profileSetup: {
    nicknameTitle: 'What should we call you?',
    nicknameHint: '2–12 characters. Letters, numbers or Korean.',
    nicknamePlaceholder: 'Nickname',
    nicknameTaken: "That nickname's already taken.",
    nicknameForbidden: "That nickname can't be used.",
    birthTitle: 'When were you born?',
    birthHint: 'Your age is never shown to anyone else.',
    birthTooYoung: 'PIXME is for ages 14 and up.',
    interestTitle: 'What are you into these days?',
    interestHint:
      "Pick as many as you like. We'll show you more days from people like you.",
    bioTitle: 'Want to add a one-liner?',
    bioHint: 'You can change this later.',
    bioPlaceholder: 'e.g. I love a walk after work',
    skip: 'Skip',
    done: 'Shall we make your first PIXME?',
    doneBody:
      "Take a photo of what you're wearing today\nand it becomes your pixel character, just like that.",
    doneCta: 'Make a PIXME',
    nicknameRequired: 'Please enter a nickname.',
    nicknameInvalid: 'Letters, numbers, Korean and _ only.',
    nicknameChecking: 'Checking…',
    nicknameAvailable: "That one's free.",
    nicknameCheckFailed:
      "We can't check that one right now. You can keep going.",
    nicknameSuggestion: (suggestion: string) =>
      `How about "${suggestion}" instead?`,
    birthInvalid: 'Please check that date.',
    doneLater: "I'll look around first",
  },

  today: {
    title: 'Today',
    emptyTitle: "Today's PIXME is still quiet.",
    emptyBody: 'Want to be the first one here today?',
    /** Generic "make a character" — the paid action. */
    emptyCta: 'Make a PIXME',
    emptyAfterPostedTitle: 'No one else yet.',
    emptyAfterPostedBody: "We'll bring you together here once someone else is active today.",
    browseSquare: 'Browse the square',
    /**
     * The free action, and the one that actually puts someone on Today and in
     * the square. Only offered to people who already have a PIXME to show —
     * a status has to point at a character.
     */
    statusCta: "Post today's status",
    endTitle: "That's everyone for today.",
    endBody: 'A new day lands here tomorrow.',
    statusDoneTitle: "Your status for today is up.",
    myPixelMissingTitle: "How's today going?",
    myPixelMissingCta: 'Make a PIXME',
  },

  square: {
    title: "Today's Square",
    subtitle: "Everyone who's around today is here.",
    emptyTitle: 'The Square is still empty.',
    emptyBody:
      "Post today's status and you'll be the first one standing in the Square.",
    /** First visit only. Nobody appears in the square without choosing to. */
    consentTitle: 'Head out to the Square?',
    consentBody:
      "Turn it on and your PIXME shows up in the Square whenever you're around today.\nTurn it off and the app works exactly the same — you just won't appear there.",
    consentAccept: 'Go to the Square',
    consentDecline: 'Later',
    hiddenBanner: "You're not showing in the Square right now.",
    hiddenBannerCta: 'Turn on',
    nowVisible: "You're in the Square now.",
    nowHidden: "You've stepped out of the Square.",
    curations: {
      hearts: '🔥 Most liked today',
      fresh: '✨ Just arrived',
      active: '🌙 Around right now',
      recurring: '💫 PIXMEs you keep seeing today',
    },
    /** Short form for the tab bar and section headers. */
    tabTitle: 'Square',
    tapHint: 'Tap a character to see their line for today.',
    occupantCount: (n: number) =>
      `${n} ${n === 1 ? 'person is' : 'people are'} in the Square today.`,
    moveHint: 'Tap an empty spot and you walk over to it.',
    peopleCount: (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`,
  },

  create: {
    styles: {
      PIXME_BASIC: 'Basic',
      SOFT_PIXEL: 'Soft pixel',
      MINI_PIXEL: 'Mini pixel',
      BIT_16: '16-bit',
      RETRO_PC: 'Retro PC',
      ARCADE: 'Arcade',
      Y2K_PIXEL: 'Y2K pixel',
    },
    styleLocked: 'Unlock it in the store.',
    styleBuyTitle: (name: string) => `Buy the ${name} style?`,
    styleBuyBody:
      'Bought once, yours to keep — and applied to this photo right away.',
    sheetTitle: 'Want to turn today into a PIXME?',
    camera: 'Take a photo',
    library: 'Choose from photos',
    hint: 'The more of you in frame, the better today’s outfit comes through.',
    guideSelfie: 'Selfie — face up close',
    guideOotd: 'Full body — head to shoes',
    previewTitle: 'Use this photo?',
    previewHint:
      'Line it up so your face and outfit show. A selfie works too.',
    previewCta: 'Make it with this photo',
    retake: 'Pick another',
    permissionCameraTitle: 'Camera access needed',
    permissionCameraBody:
      "Allow camera access in Settings and you can make today's PIXME right away.",
    permissionLibraryTitle: 'Photo access needed',
    permissionLibraryBody:
      'Allow photo access in Settings to pick a photo from your library.',
    /** A status needs a character to point at, so this comes first. */
    needPixelFirst: 'Make a PIXME first.',
    alreadyPublished:
      "You've already made today's PIXME. Making another lets you change your Current PIXME.",
    missingPhoto: 'Please pick a photo again.',
    openSettings: 'Open Settings',
  },

  generation: {
    steps: [
      "Taking a look at today's style.",
      'Moving your hair and outfit into pixels…',
      'Your PIXME is almost ready.',
    ],
    resultTitle: "Today's PIXME",
    firstResultTitle: 'Your first PIXME is ready.',
    readyTitle: 'Your PIXME is ready.',
    alreadyAcceptedTitle: "You've already picked this one.",
    accept: "I'll take this one",
    /** Only on the first character's result screen — the one and only retry. */
    freeRetry: 'Try one more, free',
    freeRetryHint: 'Your first PIXME gets one more free try.',
    /** Shown whenever a retry produced a second candidate. */
    compareTitle: 'Pick the one you like.',
    compareFirst: 'The first one',
    compareSecond: 'The new one',
    compareHint: 'Both stay in your record either way.',
    retryCostFree: "This one's free.",
    /** Neutral balance line shown above the camera/library buttons. */
    balance: (n: number) => `${n} credit${n === 1 ? '' : 's'}`,
    noCreditTitle: 'No credits left',
    noCreditBody:
      'You need a credit to upload a photo. Grab some from the store?',
    noCreditCta: 'Go to the store',
    failedTitle: "We couldn't get this one into pixels.",
    failedBody: 'No credit was used.',
    unsafeTitle: "This photo won't work for a PIXME.",
    unsafeBody: 'Try another one where your face and outfit show clearly.',
    timeoutTitle: 'This is taking longer than usual.',
    backgroundNotice:
      "You can close this — it keeps going, and we'll send a notification when it's ready.",
    timeoutBody: "We'll send you a notification when it's done.",
  },

  publish: {
    title: "Today's me",
    captionLabel: 'Today in a word',
    captionPlaceholder: "How's today been?",
    moodLabel: "Today's mood",
    tagLabel: 'Tags',
    tagHint: 'Pick up to 4.',
    cta: 'Use this one for today',
    /** Nothing is ever replaced — every kept character stays in the Collection. */
    collectionNotice:
      'Every PIXME you make is kept.',
    customTagPlaceholder: 'Type your own',
    addTag: 'Add',
    successTitle: "Today's PIXME is up.",
  },

  reactions: {
    heart: 'Like',
    heartSent: 'Liked',
    wave: 'Say hi',
    /** The wave button's own label once sent — not a toast. Short on purpose: it has to fit the button. */
    waveSentLabel: 'Sent',
    waveSent: 'You said hi.',
    waveAlready: 'You already said hi.',
    connectedTitle: '✨ You two are connected.',
    connectedBody: "Today's PIXME brought someone new your way.",
    connectedCta: 'Start chatting',
    connectedLater: 'Later',
    waveComposeTitle: 'Say hi',
    waveComposeBody:
      "Add a line and it becomes the first thing said, if it's mutual. Nobody sees it before then.",
    waveComposePlaceholder: 'e.g. Love your outfit!',
    waveComposeSend: 'Send',
    waveComposeSkip: 'Send without a message',
  },

  profile: {
    recent: 'Lately',
    recentOther: 'Recent PIXMEs',
    history: 'Pixel record',
    receivedHearts: 'Likes received',
    connections: 'Connections',
    interests: 'Interests',
    streak: 'Streak',
    streakDays: (days: number) => `${days}d`,
    edit: 'Edit profile',
    emptyHistoryTitle: 'Nothing here yet.',
    emptyHistoryBody:
      "Post today's status and your days start stacking up here, one at a time.",
    nicknameLabel: 'Nickname',
    bioLabel: 'One-liner',
    saved: 'Profile saved.',
    birthLocked:
      "Your birth date can't be changed. If it's wrong, let support know.",
    view: 'View profile',
    short: 'Profile',
    stats: (hearts: string, pixels: string) =>
      `${hearts} likes · ${pixels} PIXMEs`,
    blocked: "You've blocked this person.",
  },

  chat: {
    title: 'Chats',
    newConnections: 'New connections',
    recent: 'Recent chats',
    emptyTitle: 'No connections yet.',
    emptyBody: "Look around today's PIXMEs and say how you feel.",
    emptyMessagesTitle: 'Say something to get started.',
    emptyMessagesBody: 'When you both 👋, you can start a chat.',
    systemConnected: 'You both said hi on PIXME.',
    inputPlaceholder: 'Send a message',
    blockedByMe: "You can't chat with someone you've blocked.",
    leftConversation: "This person can't continue the conversation.",
    reconnecting: 'Reconnecting…',
    browseToday: 'Look around today',
    peerConnected: "You two connected over today's PIXME.",
    sendFailed: "Couldn't send that. Please try again.",
  },

  my: {
    title: 'MY',
    editProfile: 'Edit profile',
    plus: 'PIXME+',
    history: 'My pixel record',
    settings: 'Settings',
    showOriginal: 'Show original',
    hideOriginal: 'Hide original',
    firstPixelFree: 'Your first PIXME is free.',
    firstRetryLeft: 'You still have a free retry on your first PIXME.',
    tapForMore: 'Tap to get more',
    decorPlus: 'PIXME+ unlocks every decoration.',
    decorHint: 'Pick a background or a theme for your card.',
    originalDeleted: "The original photo wasn't saved.",
  },

  notifications: {
    title: 'Notifications',
    emptyTitle: 'Nothing here yet.',
    emptyBody:
      "We'll let you know here when you get likes or a new connection.",
    markAllRead: 'Mark all read',
    promptTitle: 'Turn on notifications?',
    promptBody:
      "We'll let you know when someone likes your PIXME, or when a mutual 👋 opens a conversation. You can change this anytime in Settings.",
    promptAccept: 'Turn on',
    promptDecline: 'Not now',
  },

  store: {
    title: 'PIXME Store',
    creditsSection: 'Extra credits',
    stylesSection: 'Styles',
    decorSection: 'Decorations',
    plusSection: 'PIXME+',
    restore: 'Restore purchases',
    restored: 'Your purchases are restored.',
    nothingToRestore: 'No purchases to restore.',
    purchaseFailed: "Couldn't complete the payment.",
    ownedByAnotherAccount:
      "This device already bought it on a different account. Sign in there to use it.",
    notAvailable: "This item can't be loaded right now. Please try again shortly.",
    purchaseCancelled: 'Payment cancelled.',
    verifying: 'Checking your payment…',
    successTitle: 'All set!',
    pending:
      "Your payment is taking a moment to confirm. We'll let you know when it's through.",
    /** Shared by the store list and the decoration picker. */
    owned: 'Owned',
    balanceNow: (n: number) =>
      `You now have ${n} credit${n === 1 ? '' : 's'}`,
    firstFree: 'Your first PIXME is free.',
    firstFreeUsed: "You've used your free one.",
    legal:
      'Likes, connections and chats are always free. Everyone gets 2 hellos a day, and PIXME+ gets 5. Payments go through your store account, and if a generation fails the credit comes straight back.',
    subscriptionStarted: (name: string) => `Your ${name} subscription is live.`,
    creditsAdded: (n: number) =>
      `${n} credit${n === 1 ? '' : 's'} added.`,
    itemReady: (name: string) => `${name} is ready to use.`,
    purchaseDone: 'Purchase complete.',
    applyNow: 'Apply now',
    applied: 'Applied.',
  },

  plus: {
    title: 'PIXME+',
    tagline: 'More room to be you, every day.',
    cta: 'Start PIXME+',
    manage: 'Manage subscription',
    legal:
      'Your subscription renews automatically, and you can cancel any time in your device settings. If you cancel or your subscription ends, premium backgrounds and themes go back to the defaults.',
    activeUntil: (date: string) => `Active until ${date}`,
    note: 'PIXME+ widens how you express yourself. Likes, connections and chats stay free for everyone, subscription or not. Anyone can send two waves a day; PIXME+ raises that to five.',
  },

  share: {
    cta: 'Share',
    unavailable: 'No app available to share to.',
  },

  gate: {
    title: 'Make a PIXME first.',
    body: 'You need at least one character to use the square and chats.\nOne photo from today is enough.',
    cta: 'Make a PIXME',
  },

  safety: {
    report: 'Report',
    block: 'Block',
    unblock: 'Unblock',
    blockTitle: 'Block this person?',
    blockBody:
      "Once blocked, neither of you will see the other's PIXME, and your chat ends here.",
    blockedTitle: 'Blocked.',
    reportTitle: 'What went wrong?',
    reportDetailPlaceholder: 'Any details help us look into it. (Optional)',
    reportAlsoBlock: 'Block this person too',
    reportSubmit: 'Send report',
    reportDone: "Report received. We'll look into it and take action.",
    reportReasons: {
      INAPPROPRIATE_CONTENT: {
        label: 'Inappropriate content',
        hint: "A photo or a post that doesn't belong here.",
      },
      HARASSMENT: {
        label: 'Harassment',
        hint: 'They were upsetting or threatening.',
      },
      IMPERSONATION: {
        label: 'Impersonation',
        hint: "They're pretending to be someone else.",
      },
      SPAM: { label: 'Ads / spam', hint: 'Promotion or repeated messages.' },
      SEXUAL_CONTENT: {
        label: 'Sexual content',
        hint: "There's sexual content in it.",
      },
      HATE_SPEECH: {
        label: 'Hate speech',
        hint: 'They put down a group of people.',
      },
      OTHER: {
        label: 'Something else',
        hint: "A reason that isn't listed above.",
      },
    },
    reportNote:
      "Our team reviews every report and, where needed, removes the post or limits the account. We'll let you know the outcome in a notification.",
    blockedAt: (when: string) => `Blocked ${when}`,
    blockedNote:
      "Unblock and you may see each other's PIXMEs again. Your old chat doesn't come back.",
    unblockTitle: (nickname: string) => `Unblock ${nickname}?`,
    unblockBody:
      "Once unblocked, you may see each other's PIXME for today again.",
    unblocked: 'Unblocked.',
    emptyBlockedTitle: "You haven't blocked anyone.",
  },

  settings: {
    title: 'Settings',
    account: 'Account',
    notifications: 'Notifications',
    blocked: 'Blocked people',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    plus: 'PIXME+',
    restore: 'Restore purchases',
    theme: 'Appearance',
    logout: 'Log out',
    logoutConfirm: 'Log out?',
    deleteAccount: 'Delete account',
    version: 'App version',
    keepOriginal: 'Keep original photos',
    keepOriginalHint:
      "Turn this off and the original photo is deleted as soon as your PIXME is made. You won't be able to see it again in your record.",
    deleteTitle: 'Delete your account for good?',
    deleteBody:
      'Your profile, every PIXME you have made, your connections and your chats are all deleted. This cannot be undone.',
    deleteConfirmHint: 'Type "DELETE" to confirm.',
    deleteConfirmWord: 'DELETE',
    deleteCta: 'Delete account',
    privacySection: 'Privacy',
    termsSection: 'Legal',
    displaySection: 'Display',
    photosSection: 'Photos',
    support: 'Contact us',
    plusActive: 'Active',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    squareVisible: 'Show me in the Square today',
    squareVisibleHint:
      "Leave this on and your Current PIXME shows up in the Square whenever you're around today. Turn it off and the app works just as usual — you only stop appearing there.",
    squareVisibleOn: "You'll show up in the Square when you're around today.",
    squareVisibleOff: "You won't show up in the Square anymore.",
    keepOriginalOn: "We'll keep your original photos.",
    keepOriginalOff:
      'From now on, the original photo is deleted as soon as your PIXME is made.',
    photoPolicyTitle: 'How PIXME handles your photos',
    photoPolicyPrivate:
      'Original photos go to private storage and are never visible to other people, under any circumstances.',
    photoPolicyScope:
      'We use them only as far as making your character needs, and photo metadata like location is stripped before upload.',
    photoPolicyDelete:
      'You can delete any original from your record one by one, and deleting your account deletes them all.',
    pushTypesSection: 'Notification types',
    pushDeniedBanner:
      'PIXME notifications are off in your device settings. The switches below apply once you turn them back on.',
    pushNote:
      "PIXME keeps notifications sparse. Likes come bundled, the daily nudge arrives at most once a day, and it doesn't come at all once you've posted today's PIXME.",
    pushHeart: '♡ Likes',
    pushHeartHint: 'When someone likes your PIXME',
    pushConnected: '✨ New connection',
    pushConnectedHint: 'When you and someone else connect',
    pushMessage: '💬 New message',
    pushMessageHint: "When someone you're connected to sends a message",
    pushDaily: "Today's PIXME nudge",
    pushDailyHint: "Once a day, and only if you haven't posted today",
    deleteItemsTitle: 'What gets deleted',
    deleteItems: [
      'Your profile and nickname',
      'Every PIXME you have made, and the original photos',
      'The likes you received and your connection history',
      'All of your chats',
    ],
    deleteRetention:
      'The moment you ask, you disappear from every public screen, and your personal data is permanently deleted per our policy — except payment records the law requires us to keep. If you have a subscription, cancel it separately in the store.',
    deleteReasonTitle: "Mind telling us why you're leaving? (Optional)",
    deleteReasons: [
      "I don't really use it",
      'Posting photos feels like a lot',
      'Not enough people here',
      'Too many notifications',
      'Something else',
    ],
    deleted: 'Your account is deleted. Thank you for spending this time with us.',
  },

  /** PIXME Collection — the kept characters, and what can be done to one. */
  collection: {
    current: 'Your Current PIXME',
    currentShort: 'Current',
    tapToSwitch: 'Tap to switch',
    switchCta: 'Use this one',
    switched: "Today's PIXME is switched.",
    createCta: 'Make a new PIXME',
    deleteOriginal: 'Delete original photo',
    deleteOriginalTitle: 'Delete the original photo?',
    deleteOriginalBody:
      'Your PIXME and your record stay exactly as they are. Only the original photo is deleted, for good.',
    originalDeleted: 'Original photo deleted.',
    deletePixel: 'Delete this PIXME',
    deletePixelTitle: 'Delete this PIXME?',
    deletePixelBody:
      "It disappears from your Collection. The days you've already recorded keep it.",
    pixelDeleted: 'PIXME deleted.',
  },

  /** My pixel record — the grid/calendar of past days. */
  historyView: {
    calendarView: 'Calendar view',
    gridView: 'Grid view',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },

  /** Decorations — the picker, and buying from inside it. */
  decorations: {
    emptyTitle: 'Nothing to decorate with yet.',
    emptyBody: 'Pick up a background or a frame in the store.',
    emptyCta: 'Open the store',
    note: 'What you apply is visible to others on your card and profile.\nIn the square, everyone stands the same.',
    moreInStore: 'See more in the store',
    active: 'Applied',
    nicknameSample: 'Name',
    buyTitle: (name: string) => `Get ${name}?`,
    buyBody: (description: string, price: string) =>
      `${description}\n\n${price} · Buy it once and it stays yours.\n\nAfter purchase, Korean e-commerce law allows a refund only within 7 days and only before the item has been used.`,
    buyCta: (price: string) => `Pay ${price}`,
    boughtTitle: (name: string) => `${name} is yours!`,
    boughtBody: 'Apply it now?',
    boughtApply: 'Apply now',
    boughtLater: 'Later',
    viewInStore: 'View in the store',
    slots: {
      BACKGROUND: 'Card background',
      FRAME: 'Card border',
      NICKNAME: 'Nickname',
      PARTICLE: 'Effect',
      POSE: 'Pose',
      EMOTION: 'Expression',
    },
  },

  /**
   * The daily "Say hi" allowance running out. Deliberately soft — this is a
   * dialog, not a paywall.
   */
  quota: {
    title: "That's it for today",
    body: "You've said hi as many times as you can today. It fills back up at midnight.",
    bodyUpsell:
      "You've said hi as many times as you can today. It fills back up at midnight.\n\nPIXME+ gets you 5 a day.",
    plusCta: 'See PIXME+',
  },

  /**
   * Screen-reader labels and hints. They never appear on screen, but they are
   * read aloud, so they are copy like everything else.
   */
  a11y: {
    pixelCharacter: 'PIXME character',
    back: 'Back',
    more: 'More',
    send: 'Send',
    newActivity: 'New activity',
    badgeCount: (n: number) => `${n}`,
    myCurrentPixel: 'My Current PIXME',
    todayCurrentPixel: "Today's Current PIXME",
    userCurrentPixel: (nickname: string) => `${nickname}'s Current PIXME`,
    userPixel: (nickname: string) => `${nickname}'s PIXME`,
    userPixelOpen: (nickname: string) => `View ${nickname}'s PIXME`,
    userTodayPixel: (nickname: string) => `${nickname}'s PIXME for today`,
    openProfile: (nickname: string) => `Open ${nickname}'s profile`,
    conversationWith: (nickname: string) => `Chat with ${nickname}`,
    startChatWith: (nickname: string) => `Start a chat with ${nickname}`,
    mood: (label: string) => `Mood: ${label}`,
    dayPixel: (date: string) => `PIXME from ${date}`,
    thisDayPixel: "This day's PIXME",
    freshPixel: 'The PIXME you just made',
    myPixel: 'My PIXME',
    originalPhoto: 'Original photo',
    selectedPhoto: 'Selected photo',
    guideSelfie: 'Example selfie with the face clearly visible',
    guideOotd: 'Example full-body photo, head to shoes',
    buyCredits: 'Buy credits',
    squareGround: 'Tap an empty spot to move your character',
    collectionSwitch: 'Switch to this PIXME',
    collectionHint: 'Press and hold for the original photo and delete',
    decorationTile: (name: string, active: boolean) =>
      active ? `${name}, applied` : name,
  },

  errors: {
    generic: 'Something went wrong for a moment.',
    feedLoad: "Couldn't load PIXMEs just now.",
    network: 'Check your internet connection.',
    retry: 'Try again',
    sessionExpired: 'Please sign in again.',
    notFound: "We couldn't find that.",
    rateLimited: 'Please try again in a moment.',
    serverMaintenance: 'PIXME is under maintenance. Hang tight for a bit.',
    updateRequired: 'Update to the latest version to keep going.',
    update: 'Update',
  },

  common: {
    confirm: 'OK',
    cancel: 'Cancel',
    next: 'Next',
    done: 'Done',
    save: 'Save',
    close: 'Close',
    delete: 'Delete',
    loading: 'Loading…',
  },

  moods: {
    HAPPY: 'Good',
    LOVELY: 'Fluttery',
    SLEEPY: 'Sleepy',
    BLANK: 'Just okay',
    MELTED: 'Melted',
    TEARY: 'Even so',
    COOL: 'Not bad',
    CHAOS: 'Hectic',
  },

  interests: {
    MUSIC: 'Music',
    CAFE: 'Cafés',
    MOVIE: 'Film',
    TRAVEL: 'Travel',
    WORKOUT: 'Working out',
    WALK: 'Walks',
    GAME: 'Games',
    FASHION: 'Fashion',
    FOOD: 'Food',
    PHOTO: 'Photography',
    EXHIBITION: 'Exhibitions',
    READING: 'Reading',
  },

  suggestedTags: [
    'cafe', 'walk', 'commute', 'workout', 'travel', 'date', 'effortless',
    'allblack', 'home', 'nightowl', 'offwork', 'weekend', 'rainyday',
    'uniform', 'oversized',
  ],
};
