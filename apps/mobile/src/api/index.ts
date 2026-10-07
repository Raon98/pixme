export * from './types';
export * from './errors';
export { qk } from './queryKeys';
export {
  http,
  configureAuthBridge,
  uploadToPresignedUrl,
} from './client';

import { MOCK_MODE } from '@/lib/mock';

import { authApi as realAuthApi } from './endpoints/auth';
import { usersApi as realUsersApi } from './endpoints/users';
import { pixelsApi as realPixelsApi } from './endpoints/pixels';
import { squareApi as realSquareApi } from './endpoints/square';
import { reactionsApi as realReactionsApi } from './endpoints/reactions';
import { connectionsApi as realConnectionsApi } from './endpoints/connections';
import { chatApi as realChatApi } from './endpoints/chat';
import { notificationsApi as realNotificationsApi } from './endpoints/notifications';
import { storeApi as realStoreApi } from './endpoints/store';
import { safetyApi as realSafetyApi } from './endpoints/safety';
import { systemApi as realSystemApi } from './endpoints/system';

import {
  mockAuthApi,
  mockUsersApi,
  mockPixelsApi,
  mockSquareApi,
  mockReactionsApi,
  mockConnectionsApi,
  mockChatApi,
  mockNotificationsApi,
  mockStoreApi,
  mockSafetyApi,
  mockSystemApi,
} from './mock';

/**
 * The single switch point between the real backend and the in-memory preview
 * data. Every hook and screen imports these names unchanged — only this file
 * knows `MOCK_MODE` exists. See `src/lib/mock.ts` and `src/api/mock.ts`.
 */
export const authApi = MOCK_MODE ? mockAuthApi : realAuthApi;
export const usersApi = MOCK_MODE ? mockUsersApi : realUsersApi;
export const pixelsApi = MOCK_MODE ? mockPixelsApi : realPixelsApi;
export const squareApi = MOCK_MODE ? mockSquareApi : realSquareApi;
export const reactionsApi = MOCK_MODE ? mockReactionsApi : realReactionsApi;
export const connectionsApi = MOCK_MODE ? mockConnectionsApi : realConnectionsApi;
export const chatApi = MOCK_MODE ? mockChatApi : realChatApi;
export const notificationsApi = MOCK_MODE ? mockNotificationsApi : realNotificationsApi;
export const storeApi = MOCK_MODE ? mockStoreApi : realStoreApi;
export const safetyApi = MOCK_MODE ? mockSafetyApi : realSafetyApi;
export const systemApi = MOCK_MODE ? mockSystemApi : realSystemApi;
