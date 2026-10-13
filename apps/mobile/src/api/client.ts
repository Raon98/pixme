import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { config } from '@/lib/config';
import { logger } from '@/lib/logger';

import { ApiError, ApiErrorCode, toApiError } from './errors';
import type { AuthTokens } from './types';

const log = logger('http');

/* ------------------------------------------------------------ token store */

/**
 * The HTTP layer owns no state of its own — the auth store injects callbacks
 * at bootstrap. This keeps `client.ts` importable from anywhere without a
 * circular dependency on the Zustand store.
 */
interface AuthBridge {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokensRefreshed: (tokens: AuthTokens) => void | Promise<void>;
  onSessionExpired: () => void | Promise<void>;
}

let bridge: AuthBridge = {
  getAccessToken: () => null,
  getRefreshToken: () => null,
  onTokensRefreshed: () => undefined,
  onSessionExpired: () => undefined,
};

export function configureAuthBridge(next: AuthBridge) {
  bridge = next;
}

/* ---------------------------------------------------------------- instance */

type RetriableConfig = InternalAxiosRequestConfig & {
  _retryCount?: number;
  _refreshAttempted?: boolean;
  /** Set per-request to opt out of the automatic 401 refresh (auth calls). */
  skipAuthRefresh?: boolean;
};

export const http: AxiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: config.http.timeoutMs,
  headers: {
    'Content-Type': 'application/json',
    'X-Pixme-Client': 'mobile',
    'X-Pixme-App-Version': config.appVersion,
    'X-Pixme-Build': config.buildNumber,
  },
});

http.interceptors.request.use((request) => {
  const token = bridge.getAccessToken();
  if (token && !request.headers.Authorization) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  return request;
});

/* ------------------------------------------- single-flight token refresh */

let refreshPromise: Promise<AuthTokens | null> | null = null;

async function refreshTokens(): Promise<AuthTokens | null> {
  const refreshToken = bridge.getRefreshToken();
  if (!refreshToken) return null;

  refreshPromise ??= (async () => {
    try {
      const response = await axios.post<AuthTokens>(
        `${config.apiBaseUrl}/auth/refresh`,
        { refreshToken },
        { timeout: config.http.timeoutMs },
      );
      await bridge.onTokensRefreshed(response.data);
      return response.data;
    } catch (error) {
      log.warn('token refresh failed', toApiError(error).code);
      await bridge.onSessionExpired();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function backoffDelay(attempt: number): number {
  // 300ms, 900ms with jitter — enough to ride out a transient 502.
  return 300 * 3 ** attempt + Math.random() * 200;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

http.interceptors.response.use(
  (response) => response,
  async (rawError: unknown) => {
    const apiError = toApiError(rawError);
    const requestConfig = (rawError as { config?: RetriableConfig }).config;

    if (!requestConfig) throw apiError;

    /* 401 → refresh once, then replay the original request. */
    const isAuthFailure =
      apiError.status === 401 || apiError.code === ApiErrorCode.TokenExpired;

    if (
      isAuthFailure &&
      !requestConfig._refreshAttempted &&
      !requestConfig.skipAuthRefresh
    ) {
      requestConfig._refreshAttempted = true;
      const tokens = await refreshTokens();
      if (tokens) {
        requestConfig.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return http.request(requestConfig);
      }
      throw apiError;
    }

    /* Transient failures → bounded retry for idempotent verbs. */
    const method = (requestConfig.method ?? 'get').toLowerCase();
    const idempotent = method === 'get' || method === 'head';
    const attempt = requestConfig._retryCount ?? 0;

    if (apiError.isRetryable && idempotent && attempt < config.http.retryCount) {
      requestConfig._retryCount = attempt + 1;
      await sleep(backoffDelay(attempt));
      return http.request(requestConfig);
    }

    throw apiError;
  },
);

/* ------------------------------------------------------------- helpers */

export interface RequestOptions extends AxiosRequestConfig {
  skipAuthRefresh?: boolean;
}

export async function get<T>(url: string, options?: RequestOptions): Promise<T> {
  const response = await http.get<T>(url, options);
  return response.data;
}

export async function post<T>(
  url: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const response = await http.post<T>(url, body, options);
  return response.data;
}

export async function patch<T>(
  url: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const response = await http.patch<T>(url, body, options);
  return response.data;
}

export async function put<T>(
  url: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const response = await http.put<T>(url, body, options);
  return response.data;
}

export async function del<T>(
  url: string,
  options?: RequestOptions,
): Promise<T> {
  const response = await http.delete<T>(url, options);
  return response.data;
}

/**
 * Uploads a local file to a pre-signed URL. Deliberately uses a bare `fetch`
 * rather than the authenticated axios instance so that our bearer token is
 * never sent to the storage host.
 */
export async function uploadToPresignedUrl(params: {
  uploadUrl: string;
  headers: Record<string, string>;
  fileUri: string;
  mimeType: string;
}): Promise<void> {
  const blob = await (await fetch(params.fileUri)).blob();
  const response = await fetch(params.uploadUrl, {
    method: 'PUT',
    headers: { ...params.headers, 'Content-Type': params.mimeType },
    body: blob,
  });

  if (!response.ok) {
    // TEMP debug: include status + body so the failed screen shows the real
    // reason instead of a generic message. Revert once root-caused.
    const bodyText = await response.text().catch(() => '');
    throw new ApiError({
      code: 'UPLOAD_FAILED',
      message: `[${response.status}] ${bodyText.slice(0, 300) || '사진을 올리지 못했어요.'}`,
      status: response.status,
    });
  }
}
