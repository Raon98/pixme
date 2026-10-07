import { useMutation, useQueryClient } from '@tanstack/react-query';

import { pixelsApi, qk, type PixelPost, type PublishPixelRequest } from '@/api';
import { analytics } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';

import { useAuthStore } from '../auth/authStore';
import { useGenerationStore } from './generationStore';

/**
 * Publishes a completed generation as today's representative PIXME.
 *
 * Daily policy (chosen deliberately): a user may generate several candidates,
 * but exactly one is published per calendar day. Publishing again replaces the
 * representative post, and the previous one stays in the user's own history.
 * That keeps the feed and the square one-person-one-card, which is what makes
 * "today" legible.
 */
export function usePublishPixel() {
  const queryClient = useQueryClient();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const clearDraft = useGenerationStore((state) => state.clearDraft);

  return useMutation<
    PixelPost,
    unknown,
    { generationId: string; body: PublishPixelRequest }
  >({
    mutationFn: ({ generationId, body }) =>
      pixelsApi.publish(generationId, body),

    onSuccess: async (post) => {
      haptics.celebrate();
      analytics.track('PIXEL_PUBLISHED', {
        postId: post.id,
        style: post.style,
        hasCaption: !!post.caption,
        hasMood: !!post.mood,
        tagCount: post.tags.length,
      });

      clearDraft();

      await Promise.all([
        refreshUser(),
        queryClient.invalidateQueries({ queryKey: qk.feed.status() }),
        queryClient.invalidateQueries({ queryKey: qk.feed.today() }),
        queryClient.invalidateQueries({ queryKey: qk.square.today() }),
        queryClient.invalidateQueries({ queryKey: qk.pixels.mine() }),
        queryClient.invalidateQueries({ queryKey: qk.me.profile() }),
      ]);
    },
  });
}
