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

      await queryClient.invalidateQueries({ queryKey: qk.pixels.collection() });
    },
  });
}
