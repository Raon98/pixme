import { useMutation, useQueryClient } from '@tanstack/react-query';

import { pixelsApi, qk, type KeepGenerationRequest, type PixelCharacter } from '@/api';
import { analytics } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';

import { useGenerationStore } from './generationStore';

/**
 * Confirms a generation result as an owned character — the only moment one
 * joins the Collection. The AI call was already paid for regardless of this
 * call's outcome; this only decides whether it's kept and whether it becomes
 * the Current PIXME.
 */
export function useKeepGeneration() {
  const queryClient = useQueryClient();
  const clearDraft = useGenerationStore((state) => state.clearDraft);

  return useMutation<
    PixelCharacter,
    unknown,
    { generationId: string; body: KeepGenerationRequest }
  >({
    mutationFn: ({ generationId, body }) => pixelsApi.keep(generationId, body),

    onSuccess: async (character) => {
      haptics.celebrate();
      analytics.track('PIXEL_KEPT', {
        characterId: character.id,
        style: character.style,
        isCurrent: character.isCurrent,
      });

      clearDraft();

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.pixels.collection() }),
        // `representativeCharacterUrl` lives on `me` — without this, every
        // screen that gates on "does this account own a character yet"
        // (Today's empty-state CTA, the square/chat no-character gate) keeps
        // reading the pre-keep state and steers a first-time owner back into
        // generating again instead of the free status/share flow.
        character.isCurrent
          ? queryClient.invalidateQueries({ queryKey: qk.me.profile() })
          : Promise.resolve(),
      ]);
    },
  });
}
