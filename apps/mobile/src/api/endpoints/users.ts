import { del, get, patch, post } from '../client';
import type {
  BlockedUser,
  MeResponse,
  NicknameAvailability,
  PublicProfile,
  RegisterPushTokenRequest,
  UpdateMeRequest,
} from '../types';
import type { InterestOption } from '@/constants/interests';

export const usersApi = {
  me: () => get<MeResponse>('/users/me'),

  updateMe: (body: UpdateMeRequest) => patch<MeResponse>('/users/me', body),

  checkNickname: (nickname: string) =>
    get<NicknameAvailability>('/users/nickname-availability', {
      params: { nickname },
    }),

  profile: (userId: string) => get<PublicProfile>(`/users/${userId}`),

  interests: () => get<InterestOption[]>('/interests'),

  registerPushToken: (body: RegisterPushTokenRequest) =>
    post<void>('/users/me/push-tokens', body),

  removePushToken: (token: string) =>
    del<void>('/users/me/push-tokens', { params: { token } }),

  block: (userId: string) => post<void>(`/users/${userId}/block`),

  unblock: (userId: string) => del<void>(`/users/${userId}/block`),

  blockedUsers: () => get<BlockedUser[]>('/users/me/blocks'),

  /** Irreversible. The server anonymises then purges on a retention timer. */
  deleteAccount: (reason?: string) =>
    del<void>('/users/me', { params: reason ? { reason } : undefined }),
};
