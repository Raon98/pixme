import { del, get, post } from '../client';
import type {
  KeepGenerationRequest,
  PixelCharacter,
  PixelGeneration,
  RetryGenerationRequest,
  StartGenerationRequest,
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
  retryGeneration: (body: RetryGenerationRequest) =>
    post<PixelGeneration>('/pixels/generate/retry', body),

  /**
   * A generation and its retries, so the first-character result screen can let
   * the user choose between the two candidates.
   */
  candidates: (generationId: string) =>
    get<PixelGeneration[]>(`/pixels/generations/${generationId}/candidates`),

  /** Step 3 — poll until COMPLETED / FAILED / REJECTED_UNSAFE. */
  generation: (generationId: string) =>
    get<PixelGeneration>(`/pixels/generations/${generationId}`),

  /**
   * Step 4 — confirms a candidate as an owned character. The AI call was
   * already paid for regardless of this call's outcome; this only decides
   * whether it joins the Collection and becomes the Current PIXME.
   */
  keep: (generationId: string, body: KeepGenerationRequest) =>
    post<PixelCharacter>(`/pixels/generations/${generationId}/keep`, body),

  /** The PIXME Collection — every confirmed character, newest first. */
  collection: () => get<PixelCharacter[]>('/pixels/characters'),

  /** Free — never calls a provider. Switches among owned characters. */
  setCurrent: (characterId: string) =>
    post<PixelCharacter>(`/pixels/characters/${characterId}/set-current`),

  deleteCharacter: (characterId: string) =>
    del<void>(`/pixels/characters/${characterId}`),

  /** Short-lived signed URL. Owner only; never cached to disk. */
  originalUrl: (characterId: string) =>
    get<{ url: string; expiresAt: string }>(`/pixels/characters/${characterId}/original`),

  /** Deletes the stored original but keeps the character. */
  deleteOriginal: (characterId: string) =>
    del<void>(`/pixels/characters/${characterId}/original`),
};
