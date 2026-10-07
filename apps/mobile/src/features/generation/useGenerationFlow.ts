import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { useQueryClient } from '@tanstack/react-query';

import {
  pixelsApi,
  qk,
  uploadToPresignedUrl,
  type PixelGeneration,
} from '@/api';
import { ApiErrorCode, toApiError } from '@/api/errors';
import { analytics } from '@/lib/analytics';
import { logger } from '@/lib/logger';

import { useAuthStore } from '../auth/authStore';
import { useGenerationStore } from './generationStore';

const log = logger('generation');

/** Server-reported progress is authoritative; these only smooth the gaps. */
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 120_000;

export type FlowPhase =
  | 'idle'
  | 'uploading'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'unsafe'
  | 'timeout';

export interface FlowState {
  phase: FlowPhase;
  /** 0–1, monotonic: the bar must never go backwards. */
  progress: number;
  generation: PixelGeneration | null;
  errorCode: string | null;
}

/**
 * Owns the upload → generate → poll loop.
 *
 * Credit safety: the server consumes the daily-free slot or a paid credit when
 * generation starts, and refunds automatically on FAILED/TIMEOUT. The client
 * never deducts anything locally — it just re-reads entitlements afterwards so
 * the UI matches the ledger.
 */
export function useGenerationFlow() {
  const queryClient = useQueryClient();
  const refreshUser = useAuthStore((state) => state.refreshUser);

  const draft = useGenerationStore((state) => state.draft);
  const setUploadId = useGenerationStore((state) => state.setUploadId);
  const setGeneration = useGenerationStore((state) => state.setGeneration);
  const incrementRetry = useGenerationStore((state) => state.incrementRetry);

  const [state, setState] = useState<FlowState>({
    phase: 'idle',
    progress: 0,
    generation: null,
    errorCode: null,
  });

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<number>(0);
  const cancelled = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      cancelled.current = true;
      stopPolling();
    },
    [stopPolling],
  );

  const applyProgress = useCallback((next: number) => {
    setState((previous) => ({
      ...previous,
      progress: Math.max(previous.progress, Math.min(0.99, next)),
    }));
  }, []);

  const finish = useCallback(
    async (generation: PixelGeneration) => {
      setGeneration(generation);
      await Promise.all([
        refreshUser(),
        queryClient.invalidateQueries({ queryKey: qk.me.credits() }),
        queryClient.invalidateQueries({ queryKey: qk.feed.status() }),
      ]);

      if (generation.status === 'COMPLETED') {
        analytics.track('PIXEL_GENERATION_COMPLETED', {
          generationId: generation.id,
          style: generation.style,
          usedCredit: generation.usedCredit,
        });
        setState({
          phase: 'completed',
          progress: 1,
          generation,
          errorCode: null,
        });
        return;
      }

      const unsafe = generation.failureReason === 'UNSAFE_IMAGE';
      analytics.track('PIXEL_GENERATION_FAILED', {
        generationId: generation.id,
        reason: generation.failureReason ?? 'UNKNOWN',
      });
      setState({
        phase: unsafe ? 'unsafe' : 'failed',
        progress: 1,
        generation,
        errorCode: generation.failureReason,
      });
    },
    [queryClient, refreshUser, setGeneration],
  );

  const poll = useCallback(
    (generationId: string) => {
      const tick = async () => {
        if (cancelled.current) return;

        if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
          setState((previous) => ({
            ...previous,
            phase: 'timeout',
            errorCode: 'TIMEOUT',
          }));
          return;
        }

        try {
          const generation = await pixelsApi.generation(generationId);
          setGeneration(generation);
          applyProgress(Math.max(0.1, generation.progress / 100));

          if (
            generation.status === 'COMPLETED' ||
            generation.status === 'FAILED' ||
            generation.status === 'REJECTED_UNSAFE'
          ) {
            await finish(generation);
            return;
          }
        } catch (error) {
          const apiError = toApiError(error);
          // A transient poll failure should not kill the flow; keep trying
          // until the hard timeout.
          log.warn('poll failed', apiError.code);
        }

        pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
      };

      pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
    },
    [applyProgress, finish, setGeneration],
  );

  /** Uploads the original (once) and starts a generation. */
  const start = useCallback(
    async (options?: { isRetry?: boolean }) => {
      const currentDraft = useGenerationStore.getState().draft;
      if (!currentDraft) return;

      cancelled.current = false;
      startedAt.current = Date.now();
      setState({
        phase: 'uploading',
        progress: 0.04,
        generation: null,
        errorCode: null,
      });

      try {
        let uploadId = currentDraft.uploadId;
        const isRetryOfExisting =
          !!options?.isRetry && !!currentDraft.generation?.id;

        if (!uploadId && !isRetryOfExisting) {
          const info = await FileSystem.getInfoAsync(currentDraft.source.uri);
          const byteSize = info.exists && 'size' in info ? info.size : 0;

          const ticket = await pixelsApi.createUploadTicket({
            mimeType: currentDraft.source.mimeType,
            byteSize,
          });

          applyProgress(0.12);

          await uploadToPresignedUrl({
            uploadUrl: ticket.uploadUrl,
            headers: ticket.headers,
            fileUri: currentDraft.source.uri,
            mimeType: currentDraft.source.mimeType,
          });

          uploadId = ticket.uploadId;
          setUploadId(uploadId);
        }

        if (!uploadId && !isRetryOfExisting) {
          throw new Error('missing upload');
        }

        applyProgress(0.2);

        analytics.track(
          options?.isRetry
            ? 'PIXEL_GENERATION_RETRY'
            : 'PIXEL_GENERATION_STARTED',
          { style: currentDraft.style, retryCount: currentDraft.retryCount },
        );
        if (options?.isRetry) incrementRetry();

        // An upload is single-use, so a retry re-renders the previous
        // generation's stored analysis instead of replaying the upload.
        const previousGenerationId = currentDraft.generation?.id ?? null;
        const generation =
          options?.isRetry && previousGenerationId
            ? await pixelsApi.retryGeneration({
                generationId: previousGenerationId,
                style: currentDraft.style,
              })
            : await pixelsApi.startGeneration({
                uploadId: uploadId as string,
                style: currentDraft.style,
              });

        setGeneration(generation);
        setState((previous) => ({
          ...previous,
          phase: 'generating',
          generation,
        }));
        applyProgress(Math.max(0.24, generation.progress / 100));

        if (
          generation.status === 'COMPLETED' ||
          generation.status === 'FAILED' ||
          generation.status === 'REJECTED_UNSAFE'
        ) {
          await finish(generation);
          return;
        }

        poll(generation.id);
      } catch (error) {
        const apiError = toApiError(error);
        log.warn('generation start failed', apiError.code);

        // The server rejects unsafe images up-front, before charging anything.
        const unsafe = apiError.code === ApiErrorCode.UnsafeImage;
        setState({
          phase: unsafe ? 'unsafe' : 'failed',
          progress: 1,
          generation: null,
          errorCode: apiError.code,
        });
        await refreshUser();
      }
    },
    [
      applyProgress,
      finish,
      incrementRetry,
      poll,
      refreshUser,
      setGeneration,
      setUploadId,
    ],
  );

  const reset = useCallback(() => {
    stopPolling();
    setState({
      phase: 'idle',
      progress: 0,
      generation: null,
      errorCode: null,
    });
  }, [stopPolling]);

  return { state, start, reset, draft };
}
