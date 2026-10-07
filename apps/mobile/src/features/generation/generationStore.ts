import { create } from 'zustand';

import type { PixelGeneration, PixelStyle } from '@/api';
import type { PickedImage } from '@/lib/image';

/**
 * The create flow spans four screens (preview → generating → result →
 * publish). Keeping its state in a store rather than route params means:
 *  - the chosen photo never ends up in a navigation URL,
 *  - a backgrounded app returns to the right step,
 *  - and "다시 만들어보기" can re-run from the same source image without
 *    asking the user to pick it again.
 */
export interface GenerationDraft {
  source: PickedImage;
  /** Set once the original has been uploaded; reused across retries. */
  uploadId: string | null;
  style: PixelStyle;
  /** The generation currently being watched. */
  generation: PixelGeneration | null;
  /** How many times the user has pressed "다시 만들어보기" in this session. */
  retryCount: number;
  /** Candidates produced in this session, newest last. */
  candidates: PixelGeneration[];
}

interface GenerationState {
  draft: GenerationDraft | null;

  startDraft: (source: PickedImage, style?: PixelStyle) => void;
  setUploadId: (uploadId: string) => void;
  setStyle: (style: PixelStyle) => void;
  setGeneration: (generation: PixelGeneration) => void;
  incrementRetry: () => void;
  /** Called after a successful publish or when the user leaves the flow. */
  clearDraft: () => void;

  /** Fields for the publish screen. */
  caption: string;
  mood: string | null;
  tags: string[];
  setCaption: (caption: string) => void;
  setMood: (mood: string | null) => void;
  toggleTag: (tag: string, max: number) => void;
  resetPublishFields: () => void;
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  draft: null,

  startDraft(source, style = 'PIXME_BASIC') {
    set({
      draft: {
        source,
        uploadId: null,
        style,
        generation: null,
        retryCount: 0,
        candidates: [],
      },
      caption: '',
      mood: null,
      tags: [],
    });
  },

  setUploadId(uploadId) {
    const draft = get().draft;
    if (!draft) return;
    set({ draft: { ...draft, uploadId } });
  },

  setStyle(style) {
    const draft = get().draft;
    if (!draft) return;
    set({ draft: { ...draft, style } });
  },

  setGeneration(generation) {
    const draft = get().draft;
    if (!draft) return;

    const candidates =
      generation.status === 'COMPLETED' &&
      !draft.candidates.some((candidate) => candidate.id === generation.id)
        ? [...draft.candidates, generation]
        : draft.candidates.map((candidate) =>
            candidate.id === generation.id ? generation : candidate,
          );

    set({ draft: { ...draft, generation, candidates } });
  },

  incrementRetry() {
    const draft = get().draft;
    if (!draft) return;
    set({ draft: { ...draft, retryCount: draft.retryCount + 1 } });
  },

  clearDraft() {
    set({ draft: null, caption: '', mood: null, tags: [] });
  },

  caption: '',
  mood: null,
  tags: [],

  setCaption: (caption) => set({ caption }),
  setMood: (mood) => set({ mood }),

  toggleTag(tag, max) {
    const current = get().tags;
    if (current.includes(tag)) {
      set({ tags: current.filter((item) => item !== tag) });
      return;
    }
    if (current.length >= max) return;
    set({ tags: [...current, tag] });
  },

  resetPublishFields: () => set({ caption: '', mood: null, tags: [] }),
}));
