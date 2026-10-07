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

  const buy = useCallback(
    async (product: StoreProduct): Promise<PurchaseOutcome> => {
      setPendingProductCode(product.code);
      analytics.track('STORE_OPENED', { productCode: product.code });

      try {
        const isSubscription = product.kind === 'SUBSCRIPTION';
        const result = await startPurchase({
          storeProductId: product.storeProductId,
          kind: isSubscription ? 'subscription' : 'consumable',
        });

        if (result.status === 'error') {
          if (result.error.kind === 'cancelled') {
            return { status: 'cancelled' };
          }
          analytics.track('PURCHASE_FAILED', {
            productCode: product.code,
            reason: result.error.kind,
          });
          return {
            status: 'error',
            message:
              result.error.kind === 'unavailable'
                ? copy.store.purchaseFailed
                : result.error.kind === 'already-owned'
                  ? copy.store.nothingToRestore
                  : copy.store.purchaseFailed,
          };
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
    [queryClient, refreshUser],
  );

  const restore = useCallback(async (): Promise<
    { status: 'restored'; count: number } | { status: 'empty' } | { status: 'error' }
  > => {
    try {
      const purchases = await listRestorable();
      if (purchases.length === 0) return { status: 'empty' };

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
      ]);

      return response.restoredCount > 0
        ? { status: 'restored', count: response.restoredCount }
        : { status: 'empty' };
    } catch (error) {
      log.warn('restore failed', error);
      return { status: 'error' };
    }
  }, [queryClient, refreshUser]);

  return { buy, restore, pendingProductCode };
}
