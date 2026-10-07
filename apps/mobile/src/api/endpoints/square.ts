import { get } from '../client';
import type { SquareResponse } from '../types';

export const squareApi = {
  /**
   * Today's square. The server owns placement (non-overlapping coordinates),
   * scene selection (time of day / season) and curation, so every client sees
   * a coherent space without doing layout maths or ranking locally.
   */
  today: (params?: { cursor?: string | null; limit?: number }) =>
    get<SquareResponse>('/square/today', {
      params: {
        cursor: params?.cursor ?? undefined,
        limit: params?.limit ?? 40,
      },
    }),
};
