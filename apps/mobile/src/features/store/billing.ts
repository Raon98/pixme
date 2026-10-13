import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';

import { logger } from '@/lib/logger';

const log = logger('billing');

/**
 * Thin adapter over the store billing client.
 *
 * Everything platform-specific is confined to this file; the rest of the app
 * talks in terms of `StorePrice` and `BillingPurchase`. Two rules this module
 * enforces:
 *
 *  1. A purchase is only *finished* after our server has validated the
 *     receipt. Finishing early would hand the store a completed transaction
 *     for an entitlement we never granted.
 *  2. Prices are always the store's localised strings. The server's
 *     `fallbackPriceKrw` is display-only, for the moment before the store
 *     responds (or when it is unreachable).
 */

export type BillingPlatform = 'IOS' | 'ANDROID';

export const billingPlatform: BillingPlatform =
  Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

export interface StorePrice {
  storeProductId: string;
  /** Localised, currency-formatted string straight from the store. */
  displayPrice: string;
  currency: string;
  amount: number | null;
}

export interface BillingPurchase {
  storeProductId: string;
  transactionId: string;
  /** iOS: signed JWS transaction. Android: Play purchase token. */
  receipt: string;
  raw: Purchase;
}

export type BillingError =
  | { kind: 'cancelled' }
  | { kind: 'unavailable' }
  | { kind: 'already-owned' }
  /**
   * The store never called back. Indistinguishable from `already-owned` from
   * here — StoreKit's usual answer to "sell me a non-consumable this Apple ID
   * already owns" is silence, not an error — so callers treat both the same.
   */
  | { kind: 'timeout' }
  | { kind: 'failed'; message: string };

let connected = false;

/**
 * Every SKU the store has confirmed it sells, accumulated by `loadPrices`.
 * Read by `purchase` so it can refuse a SKU the store doesn't know without
 * asking the store again mid-tap.
 */
const loadedSkus = new Set<string>();

export async function connect(): Promise<boolean> {
  if (connected) return true;
  try {
    await initConnection();
    connected = true;
    return true;
  } catch (error) {
    log.warn('initConnection failed', error);
    return false;
  }
}

export async function disconnect(): Promise<void> {
  if (!connected) return;
  try {
    await endConnection();
  } catch {
    /* non-fatal */
  }
  connected = false;
}

/** Looks up localised prices. Unknown SKUs are simply absent from the result. */
export async function loadPrices(params: {
  consumableIds: string[];
  subscriptionIds: string[];
}): Promise<Record<string, StorePrice>> {
  if (!(await connect())) return {};

  const prices: Record<string, StorePrice> = {};

  const collect = (items: unknown) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const product = item as {
        id?: string;
        displayPrice?: string;
        currency?: string;
        price?: number | null;
      };
      if (!product.id || !product.displayPrice) continue;
      loadedSkus.add(product.id);
      prices[product.id] = {
        storeProductId: product.id,
        displayPrice: product.displayPrice,
        currency: product.currency ?? 'KRW',
        amount: product.price ?? null,
      };
    }
  };

  try {
    if (params.consumableIds.length > 0) {
      collect(
        await fetchProducts({ skus: params.consumableIds, type: 'in-app' }),
      );
    }
    if (params.subscriptionIds.length > 0) {
      collect(
        await fetchProducts({ skus: params.subscriptionIds, type: 'subs' }),
      );
    }
  } catch (error) {
    log.warn('fetchProducts failed', error);
  }

  return prices;
}

function toBillingPurchase(purchase: Purchase): BillingPurchase | null {
  const receipt = purchase.purchaseToken ?? null;
  if (!receipt) return null;
  return {
    storeProductId: purchase.productId,
    transactionId: purchase.id,
    receipt,
    raw: purchase,
  };
}

function classify(error: PurchaseError): BillingError {
  const code = String(error.code ?? '').toLowerCase();
  if (code.includes('cancel')) return { kind: 'cancelled' };
  if (code.includes('already')) return { kind: 'already-owned' };
  if (code.includes('unavailable') || code.includes('not-prepared')) {
    return { kind: 'unavailable' };
  }
  return { kind: 'failed', message: error.message ?? 'purchase failed' };
}

/**
 * Starts a purchase and resolves with the purchase to validate.
 *
 * The store API is event-based, so we bridge the `purchaseUpdated` /
 * `purchaseError` listeners into a single promise and always tear the
 * listeners down — leaking them would deliver a later purchase to a stale
 * handler.
 */
/**
 * How long to wait for the store to call back before giving up.
 *
 * Neither listener is guaranteed to fire: most visibly, re-requesting a
 * non-consumable the account already owns can leave both StoreKit callbacks
 * silent, which otherwise hung this promise — and the "구매" button — forever.
 */
const PURCHASE_TIMEOUT_MS = 30_000;

export function purchase(params: {
  storeProductId: string;
  kind: 'consumable' | 'subscription';
}): Promise<
  { status: 'success'; purchase: BillingPurchase } | { status: 'error'; error: BillingError }
> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (
      result:
        | { status: 'success'; purchase: BillingPurchase }
        | { status: 'error'; error: BillingError },
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      updateSubscription.remove();
      errorSubscription.remove();
      resolve(result);
    };

    const timeout = setTimeout(() => {
      log.warn('purchase timed out waiting for store callback', params.storeProductId);
      finish({ status: 'error', error: { kind: 'timeout' } });
    }, PURCHASE_TIMEOUT_MS);

    const updateSubscription = purchaseUpdatedListener((incoming) => {
      if (incoming.productId !== params.storeProductId) return;
      const mapped = toBillingPurchase(incoming);
      if (!mapped) {
        finish({
          status: 'error',
          error: { kind: 'failed', message: 'missing receipt' },
        });
        return;
      }
      finish({ status: 'success', purchase: mapped });
    });

    const errorSubscription = purchaseErrorListener((error) => {
      finish({ status: 'error', error: classify(error) });
    });

    void (async () => {
      if (!(await connect())) {
        finish({ status: 'error', error: { kind: 'unavailable' } });
        return;
      }

      // A SKU the store never loaded is the one case where `requestPurchase`
      // reliably goes quiet instead of throwing — a spinner with no end. The
      // answer is already cached from `loadPrices`, so this costs nothing and
      // adds no delay before Apple's sheet.
      if (loadedSkus.size > 0 && !loadedSkus.has(params.storeProductId)) {
        log.warn('store never loaded this sku', params.storeProductId);
        finish({ status: 'error', error: { kind: 'unavailable' } });
        return;
      }

      try {
        if (params.kind === 'subscription') {
          await requestPurchase({
            type: 'subs',
            request: {
              apple: { sku: params.storeProductId },
              google: { skus: [params.storeProductId] },
            },
          });
        } else {
          await requestPurchase({
            type: 'in-app',
            request: {
              apple: { sku: params.storeProductId, quantity: 1 },
              google: { skus: [params.storeProductId] },
            },
          });
        }
      } catch (error) {
        log.warn('requestPurchase threw', error);
        finish({
          status: 'error',
          error: {
            kind: 'failed',
            message: error instanceof Error ? error.message : 'purchase failed',
          },
        });
      }
    })();
  });
}

/**
 * Call only after the server has granted the entitlement. For credit packs
 * (consumables) this also consumes the purchase so the user can buy again.
 */
export async function complete(
  billingPurchase: BillingPurchase,
  isConsumable: boolean,
): Promise<void> {
  try {
    await finishTransaction({
      purchase: billingPurchase.raw,
      isConsumable,
    });
  } catch (error) {
    log.warn('finishTransaction failed', error);
  }
}

/** Unfinished / restorable purchases, used by "구매 복원". */
export async function listRestorable(): Promise<BillingPurchase[]> {
  if (!(await connect())) return [];
  try {
    const purchases = await getAvailablePurchases();
    if (!Array.isArray(purchases)) return [];
    return purchases
      .map(toBillingPurchase)
      .filter((item): item is BillingPurchase => item !== null);
  } catch (error) {
    log.warn('getAvailablePurchases failed', error);
    return [];
  }
}
