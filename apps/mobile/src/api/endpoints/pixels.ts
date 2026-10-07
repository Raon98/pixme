import { del, get, post } from '../client';
import type {
  MyPixelPost,
  Page,
  PixelGeneration,
  PixelPost,
  PixelPostSummary,
  PublishPixelRequest,
  PixelStyle,
  StartGenerationRequest,
  TodayStatus,
  UploadTicket,
} from '../types';

export const pixelsApi = {
  /** Step 1 — ask the server for a pre-signed PUT into the private bucket. */
  createUploadTicket: (body: { mimeType: string; byteSize: number }) =>
    post<UploadTicket>('/pixels/uploads', body),

  /** Step 2 — kick off generation against the uploaded original. */
  startGeneration: (body: StartGenerationRequest) =>
    post<PixelGeneration>('/pixels/generate', body),

  /**
   * "다시 만들어보기" — re-renders the stored analysis of a previous
   * generation. An upload can only be generated from once, so a retry must go
   * through this endpoint rather than replaying `startGeneration`. It is also
   * cheaper and keeps the outfit identical while the rendering varies.
   */
  retryGeneration: (body: { generationId: string; style: PixelStyle }) =>
    post<PixelGeneration>('/pixels/generate/retry', body),

  /** Step 3 — poll until COMPLETED / FAILED / REJECTED_UNSAFE. */
  generation: (generationId: string) =>
    get<PixelGeneration>(`/pixels/generations/${generationId}`),

  /** Step 4 — publish the chosen candidate as today's representative post. */
  publish: (generationId: string, body: PublishPixelRequest) =>
    post<PixelPost>(`/pixels/${generationId}/publish`, body),

  /** What the user still needs to do today — drives the create-button badge. */
  todayStatus: () => get<TodayStatus>('/pixels/today-status'),

  /** The vertical "오늘" feed. Cursor-paginated and server-ranked. */
  todayFeed: (cursor?: string | null, limit = 10) =>
    get<Page<PixelPost>>('/pixels/today', {
      params: { cursor: cursor ?? undefined, limit },
    }),

  /** Owner's own history (includes the private original reference). */
  myPixels: (cursor?: string | null, limit = 30) =>
    get<Page<MyPixelPost>>('/pixels/me', {
      params: { cursor: cursor ?? undefined, limit },
    }),

  detail: (postId: string) => get<PixelPost>(`/pixels/${postId}`),

  myDetail: (postId: string) => get<MyPixelPost>(`/pixels/me/${postId}`),

  /** Short-lived signed URL. Owner only; never cached to disk. */
  originalUrl: (postId: string) =>
    get<{ url: string; expiresAt: string }>(`/pixels/${postId}/original`),

  /** Deletes the stored original but keeps the character + post. */
  deleteOriginal: (postId: string) => del<void>(`/pixels/${postId}/original`),

  /** Removes a post from the public feed; stays in the owner's history. */
  unpublish: (postId: string) => post<PixelPost>(`/pixels/${postId}/unpublish`),

  deletePost: (postId: string) => del<void>(`/pixels/${postId}`),

  userPixels: (userId: string, cursor?: string | null, limit = 30) =>
    get<Page<PixelPostSummary>>(`/users/${userId}/pixels`, {
      params: { cursor: cursor ?? undefined, limit },
    }),
};
