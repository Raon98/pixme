import { get, put } from '../client';
import type { DecorationSlot, DecorationsResponse } from '../types';

export const decorationsApi = {
  /** The decoration catalog plus what this user owns and has applied. */
  list: () => get<DecorationsResponse>('/decorations'),

  /**
   * Applies an item to a slot, or clears the slot when `unlockCode` is null.
   * Returns the whole view back so ownership and the other slots stay in sync
   * after a change.
   */
  apply: (slot: DecorationSlot, unlockCode: string | null) =>
    put<DecorationsResponse>(`/decorations/${slot}`, { unlockCode }),
};
