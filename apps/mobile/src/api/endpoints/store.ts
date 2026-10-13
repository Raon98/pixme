import { get, post } from '../client';
import type {
  CreditSummary,
  Entitlements,
  StoreCatalog,
  VerifyPurchaseRequest,
  VerifyPurchaseResponse,
} from '../types';

export const storeApi = {
  /**
   * Catalog comes from the server (prices, copy, sort order, ownership) so a
   * price change never requires an app release and nothing is hardcoded.
   */
  catalog: () => get<StoreCatalog>('/store/products'),

  /** Server-side receipt validation is the only thing that grants anything. */
  verifyPurchase: (body: VerifyPurchaseRequest) =>
    post<VerifyPurchaseResponse>('/purchases/verify', body),

  /** Re-validates all known receipts for this account. */
  restorePurchases: (receipts: VerifyPurchaseRequest[]) =>
    post<{
      entitlements: Entitlements;
      restoredCount: number;
      /** Sold to this device's Apple/Play account, but already granted elsewhere. */
      ownedByAnotherAccountCount: number;
    }>('/purchases/restore', { receipts }),

  credits: () => get<CreditSummary>('/credits'),

  entitlements: () => get<Entitlements>('/entitlements'),
};
