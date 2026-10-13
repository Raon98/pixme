/**
 * Web stub for the store billing adapter.
 *
 * `react-native-iap` has no web build — importing it at all (not just calling
 * it) crashes the bundle, because the module reaches into native internals
 * the moment it loads. Metro resolves `.web.ts` over `.ts` automatically for
 * web builds, so this file stands in for `billing.ts` there: no in-app
 * purchases exist on web, so every call reports "unavailable" rather than
 * touching a store SDK that isn't there.
 */
import { logger } from '@/lib/logger';

const log = logger('billing');

export type BillingPlatform = 'IOS' | 'ANDROID';

/** Web has no store identity; IOS is just a harmless, unused default. */
export const billingPlatform: BillingPlatform = 'IOS';

export interface StorePrice {
  storeProductId: string;
  displayPrice: string;
  currency: string;
  amount: number | null;
}

export interface BillingPurchase {
  storeProductId: string;
  transactionId: string;
  receipt: string;
  raw: unknown;
}

export type BillingError =
  | { kind: 'cancelled' }
  | { kind: 'unavailable' }
  | { kind: 'already-owned' }
  | { kind: 'timeout' }
  | { kind: 'failed'; message: string };

export async function connect(): Promise<boolean> {
  return false;
}

export async function disconnect(): Promise<void> {
  // Nothing to disconnect — connect() never succeeds on web.
}

export async function loadPrices(): Promise<Record<string, StorePrice>> {
  return {};
}

export function purchase(): Promise<
  { status: 'success'; purchase: BillingPurchase } | { status: 'error'; error: BillingError }
> {
  log.warn('purchase attempted on web; no store is available here');
  return Promise.resolve({ status: 'error', error: { kind: 'unavailable' } });
}

export async function complete(): Promise<void> {
  // No-op: nothing was ever purchased on web.
}

export async function listRestorable(): Promise<BillingPurchase[]> {
  return [];
}
