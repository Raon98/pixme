import { useQuery } from '@tanstack/react-query';

import { qk, systemApi, type AppConfigResponse } from '@/api';
import { config } from '@/lib/config';

/**
 * Remote app config: minimum supported version, maintenance switch and
 * feature flags. Fetched once at bootstrap and kept for the session — these
 * are operational levers, not per-screen data.
 */
export function useAppConfig() {
  return useQuery({
    queryKey: qk.system.config(),
    queryFn: () => systemApi.config(),
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

/** Semver-ish compare over `a.b.c`. */
export function isVersionBelow(current: string, minimum: string): boolean {
  const parse = (value: string) =>
    value.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(current);
  const b = parse(minimum);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left !== right) return left < right;
  }
  return false;
}

export function resolveGate(data: AppConfigResponse | undefined) {
  if (!data) return { gate: 'none' as const };
  if (data.maintenance.active) {
    return { gate: 'maintenance' as const, message: data.maintenance.message };
  }
  if (isVersionBelow(config.appVersion, data.minimumSupportedVersion)) {
    return { gate: 'update' as const };
  }
  return { gate: 'none' as const };
}
