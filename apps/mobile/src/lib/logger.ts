/* eslint-disable no-console */
import { config } from './config';

type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN: Level = config.isProduction ? 'warn' : 'debug';

function emit(level: Level, scope: string, message: string, meta?: unknown) {
  if (ORDER[level] < ORDER[MIN]) return;
  const prefix = `[PIXME:${scope}]`;
  const args = meta === undefined ? [prefix, message] : [prefix, message, meta];
  if (level === 'error') console.error(...args);
  else if (level === 'warn') console.warn(...args);
  else console.log(...args);
}

/** Scoped logger. `const log = logger('feed')`. */
export function logger(scope: string) {
  return {
    debug: (m: string, meta?: unknown) => emit('debug', scope, m, meta),
    info: (m: string, meta?: unknown) => emit('info', scope, m, meta),
    warn: (m: string, meta?: unknown) => emit('warn', scope, m, meta),
    error: (m: string, meta?: unknown) => emit('error', scope, m, meta),
  };
}
