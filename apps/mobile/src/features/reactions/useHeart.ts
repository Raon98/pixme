import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  qk,
  reactionsApi,
  type HeartResponse,
  type Page,
  type PixelPost,
} from '@/api';
import { analytics } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';

/**
 * Hearting is the lightest possible gesture in PIXME, so it must feel
 * instant: we patch every cache that can show this post optimistically and
 * roll back on failure. The server is idempotent, so a double-tap can never
 * produce two hearts.
 */
function patchCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  update: (post: PixelPost) => PixelPost,
) {
  queryClient.setQueriesData<{ pages: Page<PixelPost>[]; pageParams: unknown[] }>(
    { queryKey: qk.feed.today() },
    (data) => {
      if (!data) return data;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === postId ? update(item) : item,
          ),
        })),
      };
    },
  );

  queryClient.setQueryData<PixelPost>(qk.pixels.detail(postId), (post) =>
    post ? update(post) : post,
  );
}

export function useHeart() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ postId, next }: { postId: string; next: boolean }) =>
      next ? reactionsApi.sendHeart(postId) : reactionsApi.removeHeart(postId),

    onMutate: async ({ postId, next }) => {
      const snapshot = queryClient.getQueryData<PixelPost>(
        qk.pixels.detail(postId),
      );

      patchCaches(queryClient, postId, (post) => ({
        ...post,
        heartedByMe: next,
        heartCount: Math.max(0, post.heartCount + (next ? 1 : -1)),
      }));

      return { snapshot, postId, next };
    },

    onError: (_error, variables, context) => {
      // Roll back to the pre-tap values.
      patchCaches(queryClient, variables.postId, (post) => ({
        ...post,
        heartedByMe: !variables.next,
        heartCount: Math.max(0, post.heartCount + (variables.next ? -1 : 1)),
        ...(context?.snapshot
          ? {
              heartedByMe: context.snapshot.heartedByMe,
              heartCount: context.snapshot.heartCount,
            }
          : {}),
      }));
    },

    onSuccess: (response: HeartResponse, variables) => {
      // Trust the server count (other people are hearting concurrently).
      patchCaches(queryClient, variables.postId, (post) => ({
        ...post,
        heartedByMe: response.heartedByMe,
        heartCount: response.heartCount,
      }));

      analytics.track(variables.next ? 'HEART_SENT' : 'HEART_REMOVED', {
        postId: variables.postId,
      });
    },
  });

  return {
    toggleHeart: (post: PixelPost) => {
      const next = !post.heartedByMe;
      if (next) haptics.heart();
      else haptics.tap();
      mutation.mutate({ postId: post.id, next });
      return next;
    },
    isPending: mutation.isPending,
  };
}
