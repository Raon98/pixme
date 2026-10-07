import { AxiosError } from 'axios';

import { copy } from '@/constants/copy';

import type { ApiErrorBody } from './types';

/** Server error codes the client reacts to specifically. */
export const ApiErrorCode = {
  Unauthorized: 'UNAUTHORIZED',
  TokenExpired: 'TOKEN_EXPIRED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Validation: 'VALIDATION_FAILED',
  NicknameTaken: 'NICKNAME_TAKEN',
  RateLimited: 'RATE_LIMITED',
  Maintenance: 'MAINTENANCE',
  UpdateRequired: 'UPDATE_REQUIRED',
  NoGenerationAvailable: 'NO_GENERATION_AVAILABLE',
  UnsafeImage: 'UNSAFE_IMAGE',
  AlreadyPublishedToday: 'ALREADY_PUBLISHED_TODAY',
  BlockedByPeer: 'BLOCKED_BY_PEER',
  NotConnected: 'NOT_CONNECTED',
  AccountSuspended: 'ACCOUNT_SUSPENDED',
  Network: 'NETWORK_ERROR',
  Unknown: 'UNKNOWN',
} as const;

export type ApiErrorCodeValue =
  (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors: Record<string, string>;
  readonly traceId: string | undefined;

  constructor(params: {
    code: string;
    message: string;
    status: number;
    fieldErrors?: Record<string, string>;
    traceId?: string;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.fieldErrors = params.fieldErrors ?? {};
    this.traceId = params.traceId;
  }

  get isNetwork() {
    return this.code === ApiErrorCode.Network;
  }

  get isAuth() {
    return (
      this.code === ApiErrorCode.Unauthorized ||
      this.code === ApiErrorCode.TokenExpired
    );
  }

  get isRetryable() {
    return this.isNetwork || this.status >= 500 || this.status === 429;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    if (!error.response) {
      return new ApiError({
        code: ApiErrorCode.Network,
        message: copy.errors.network,
        status: 0,
      });
    }
    const body = error.response.data as ApiErrorBody | undefined;
    return new ApiError({
      code: body?.code ?? ApiErrorCode.Unknown,
      message: body?.message ?? copy.errors.generic,
      status: error.response.status,
      fieldErrors: body?.fieldErrors,
      traceId: body?.traceId,
    });
  }

  return new ApiError({
    code: ApiErrorCode.Unknown,
    message: error instanceof Error ? error.message : copy.errors.generic,
    status: 0,
  });
}

/**
 * Maps an error to copy a person can actually act on. Falls back to the
 * server's message (which is authored in Korean) before the generic string,
 * so new server-side cases don't surface as "문제가 생겼어요".
 */
export function errorMessage(error: unknown): string {
  const apiError = toApiError(error);
  switch (apiError.code) {
    case ApiErrorCode.Network:
      return copy.errors.network;
    case ApiErrorCode.RateLimited:
      return copy.errors.rateLimited;
    case ApiErrorCode.Maintenance:
      return copy.errors.serverMaintenance;
    case ApiErrorCode.UpdateRequired:
      return copy.errors.updateRequired;
    case ApiErrorCode.NotFound:
      return copy.errors.notFound;
    case ApiErrorCode.Unauthorized:
    case ApiErrorCode.TokenExpired:
      return copy.errors.sessionExpired;
    default:
      return apiError.message || copy.errors.generic;
  }
}
