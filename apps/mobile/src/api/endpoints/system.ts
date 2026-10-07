import { get } from '../client';
import type { AppConfigResponse } from '../types';

export const systemApi = {
  /**
   * Fetched once at bootstrap. Carries the minimum supported app version,
   * maintenance state and feature flags — the kill-switches we need to operate
   * the service without shipping a build.
   */
  config: () => get<AppConfigResponse>('/system/config'),
};
