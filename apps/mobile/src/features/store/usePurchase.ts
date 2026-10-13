import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { qk, storeApi, type StoreProduct } from '@/api';
import { copy } from '@/constants/copy';
import { analytics } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';
import { logger } from '@/lib/logger';

import { useAuthStore } from '../auth/authStore';
import {
  billingPlatform,
  complete,
  listRestorable,
  purchase as startPurchase,
} from './billing';

const log = logger('purchase');

export type PurchaseOutcome =
  | { status: 'granted' }
  | { status: 'pending' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/**
 * Purchase flow.
 *
 * Order of operations is deliberate and matters for correctness:
 *   store purchase → server receipt validation → entitlement → finish txn.
 * If validation fails we leave the transaction unfinished so the store will
 * re-deliver it (and "구매 복원" can pick it up) rather than silently losing
 * a paid purchase.
 */
export function usePurchase() {
  const queryClient = useQueryClient();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const [pendingProductCode, setPendingProductCode] = useState<string | null>(
    null,
  );

  /**
   * Hands the store's purchase history to the server for the *current* PIXME
   * account. Entitlements are per PIXME account, but a non-consumable belongs
   * to the Apple/Play account — so the same device signed into a second PIXME
   * account owns nothing here while the store refuses to sell it again. This
   * is the bridge between those two models, and the reason "already owned" is
   * a restore rather than an error.
   */
  const restoreFromStore = useCallback(async (): Promise<{
    restored: number;
    ownedByAnotherAccount: number;
  }> => {
    const purchases = await listRestorable();
    if (purchases.length === 0) return { restored: 0, ownedByAnotherAccount: 0 };

    const response = await storeApi.restorePurchases(
      purchases.map((item) => ({
        platform: billingPlatform,
        // The server resolves the internal product code from the SKU.
        productCode: '',
        storeProductId: item.storeProductId,
        receipt: item.receipt,
        transactionId: item.transactionId,
      })),
    );

    await Promise.all([
      refreshUser(),
      queryClient.invalidateQueries({ queryKey: qk.store.catalog() }),
      queryClient.invalidateQueries({ queryKey: qk.me.credits() }),
    ]);

    return {
      restored: response.restoredCount,
      ownedByAnotherAccount: response.ownedByAnotherAccountCount,
    };
  }, [queryClient, refreshUser]);

  const buy = useCallback(
    async (product: StoreProduct): Promise<PurchaseOutcome> => {
      // A non-consumable the store already granted will not sell again —
      // StoreKit can leave the request hanging rather than erroring, so this
      // is checked before ever calling out, not just relied on to disable
      // the button (a stale catalog cache would otherwise hang silently).
      if (product.owned && product.kind !== 'SUBSCRIPTION') {
        return { status: 'error', message: copy.store.nothingToRestore };
      }

      setPendingProductCode(product.code);
      analytics.track('STORE_OPENED', { productCode: product.code });

      try {
        const isSubscription = product.kind === 'SUBSCRIPTION';

        // Nothing is asked of the store before `startPurchase`: every round
        // trip here is time the user spends staring at a spinner before
        // Apple's sheet even appears. The "store already owns this" case is
        // handled on the way out instead, where it costs nothing until it
        // actually happens.
        const result = await startPurchase({
          storeProductId: product.storeProductId,
          kind: isSubscription ? 'subscription' : 'consumable',
        });

        if (result.status === 'error') {
          if (result.error.kind === 'cancelled') {
            return { status: 'cancelled' };
          }

          // The store already sold this to the underlying Apple/Play account
          // — it will not charge twice, so the only thing missing is the
          // grant on *this* PIXME account. Do the restore here instead of
          // telling someone to go and find the button themselves.
          if (result.error.kind === 'unavailable') {
            return { status: 'error', message: copy.store.notAvailable };
          }

          // `timeout` is lumped in with `already-owned` on purpose: silence is
          // how StoreKit declines to re-sell something, so the recovery is
          // the same — see `BillingError`.
          if (
            result.error.kind === 'already-owned' ||
            result.error.kind === 'timeout'
          ) {
            const outcome = await restoreFromStore();
            if (outcome.restored > 0) {
              haptics.celebrate();
              return { status: 'granted' };
            }
            if (outcome.ownedByAnotherAccount > 0) {
              return {
                status: 'error',
                message: copy.store.ownedByAnotherAccount,
              };
            }
          }

          analytics.track('PURCHASE_FAILED', {
            productCode: product.code,
            reason: result.error.kind,
          });
          return { status: 'error', message: copy.store.purchaseFailed };
        }

        const verification = await storeApi.verifyPurchase({
          platform: billingPlatform,
          productCode: product.code,
          storeProductId: product.storeProductId,
          receipt: result.purchase.receipt,
          transactionId: result.purchase.transactionId,
        });

        if (verification.status === 'INVALID') {
          analytics.track('PURCHASE_FAILED', {
            productCode: product.code,
            reason: 'INVALID_RECEIPT',
          });
          return { status: 'error', message: copy.store.purchaseFailed };
        }

        if (verification.status === 'PENDING') {
          // Deferred payment (e.g. Play's slow payment methods). Leave the
          // transaction open; the server grants on the store's webhook.
          return { status: 'pending' };
        }

        // Granted — safe to finish. Credit packs are consumables so the user
        // can buy the same pack again.
        await complete(result.purchase, product.kind === 'CREDIT_PACK');

        haptics.celebrate();
        analytics.track(
          isSubscription ? 'SUBSCRIPTION_STARTED' : 'CREDIT_PURCHASED',
          {
            productCode: product.code,
            creditAmount: product.creditAmount ?? 0,
          },
        );

        await Promise.all([
          refreshUser(),
          queryClient.invalidateQueries({ queryKey: qk.store.catalog() }),
          queryClient.invalidateQueries({ queryKey: qk.me.credits() }),
          queryClient.invalidateQueries({ queryKey: qk.feed.status() }),
        ]);

        return { status: 'granted' };
      } catch (error) {
        log.warn('purchase failed', error);
        analytics.track('PURCHASE_FAILED', {
          productCode: product.code,
          reason: 'EXCEPTION',
        });
        return { status: 'error', message: copy.store.purchaseFailed };
      } finally {
        setPendingProductCode(null);
      }
    },
    [queryClient, refreshUser, restoreFromStore],
  );

  const restore = useCallback(async (): Promise<
    | { status: 'restored'; count: number }
    | { status: 'owned-elsewhere' }
    | { status: 'empty' }
    | { status: 'error' }
  > => {
    try {
      const outcome = await restoreFromStore();
      if (outcome.restored > 0) {
        return { status: 'restored', count: outcome.restored };
      }
      if (outcome.ownedByAnotherAccount > 0) {
        return { status: 'owned-elsewhere' };
      }
      return { status: 'empty' };
    } catch (error) {
      log.warn('restore failed', error);
      return { status: 'error' };
    }
  }, [restoreFromStore]);

  return { buy, restore, pendingProductCode };
}
