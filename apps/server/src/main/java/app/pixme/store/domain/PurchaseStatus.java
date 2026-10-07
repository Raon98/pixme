package app.pixme.store.domain;

public enum PurchaseStatus {
    /** Receipt accepted by the store but payment not settled (deferred methods). */
    PENDING,
    GRANTED,
    REVOKED,
    INVALID
}
