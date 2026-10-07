import { post } from '../client';
import type {
  AppleAuthRequest,
  AuthResponse,
  AuthTokens,
  KakaoAuthRequest,
} from '../types';

/**
 * Auth calls opt out of the 401-refresh interceptor: a failure here means
 * "sign in again", not "replay with a fresh token".
 */
const options = { skipAuthRefresh: true } as const;

export const authApi = {
  apple: (body: AppleAuthRequest) =>
    post<AuthResponse>('/auth/apple', body, options),

  kakao: (body: KakaoAuthRequest) =>
    post<AuthResponse>('/auth/kakao', body, options),

  refresh: (refreshToken: string) =>
    post<AuthTokens>('/auth/refresh', { refreshToken }, options),

  logout: (refreshToken: string) =>
    post<void>('/auth/logout', { refreshToken }, options),
};
