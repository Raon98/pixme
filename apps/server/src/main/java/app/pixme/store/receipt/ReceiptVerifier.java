package app.pixme.store.receipt;

import java.time.Instant;

import app.pixme.store.domain.StorePlatform;

/**
 * Store receipt validation.
 *
 * <p>Validation happens here and nowhere else, and entitlements are granted
 * only from its result. The client is never trusted with "I bought this" —
 * it only forwards the store's signed artefact.
 */
public interface ReceiptVerifier {

    StorePlatform platform();

    record VerifiedPurchase(
            boolean valid,
            String transactionId,
            String originalTransactionId,
            String storeProductId,
            /** True when the store has not settled payment yet. */
            boolean pending,
            /** Subscriptions only. */
            Instant expiresAt,
            boolean autoRenewing,
            boolean sandbox,
            String failureReason) {

        public static VerifiedPurchase invalid(String reason) {
            return new VerifiedPurchase(false, null, null, null, false, null, false, false, reason);
        }
    }

    VerifiedPurchase verify(String receipt, String expectedStoreProductId);
}
