/**
 * Centralised TanStack Query keys.
 *
 * Every key is a function so that invalidation is spelled the same way at
 * every call site: `queryClient.invalidateQueries({ queryKey: qk.feed.today() })`.
 */
export const qk = {
  system: {
    config: () => ['system', 'config'] as const,
  },
  me: {
    profile: () => ['me'] as const,
    credits: () => ['me', 'credits'] as const,
    entitlements: () => ['me', 'entitlements'] as const,
    settings: () => ['me', 'settings'] as const,
  },
  feed: {
    today: () => ['feed', 'today'] as const,
    status: () => ['feed', 'status'] as const,
  },
  square: {
    today: (scene?: string) => ['square', 'today', scene ?? 'auto'] as const,
  },
  pixels: {
    mine: () => ['pixels', 'mine'] as const,
    detail: (postId: string) => ['pixels', 'detail', postId] as const,
    original: (postId: string) => ['pixels', 'original', postId] as const,
    generation: (generationId: string) =>
      ['pixels', 'generation', generationId] as const,
    byUser: (userId: string) => ['pixels', 'user', userId] as const,
  },
  users: {
    profile: (userId: string) => ['users', 'profile', userId] as const,
    nickname: (nickname: string) => ['users', 'nickname', nickname] as const,
  },
  connections: {
    list: () => ['connections'] as const,
  },
  chat: {
    conversations: () => ['chat', 'conversations'] as const,
    messages: (conversationId: string) =>
      ['chat', 'messages', conversationId] as const,
  },
  notifications: {
    list: () => ['notifications'] as const,
    badge: () => ['notifications', 'badge'] as const,
  },
  store: {
    catalog: () => ['store', 'catalog'] as const,
  },
  safety: {
    blocked: () => ['safety', 'blocked'] as const,
  },
  interests: {
    list: () => ['interests'] as const,
  },
} as const;
