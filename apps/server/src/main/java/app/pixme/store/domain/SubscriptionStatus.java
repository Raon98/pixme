package app.pixme.store.domain;

public enum SubscriptionStatus {
    ACTIVE,
    /** Payment failed but access continues while the store retries. */
    GRACE_PERIOD,
    EXPIRED,
    CANCELLED,
    BILLING_RETRY;

    public boolean grantsAccess() {
        return this == ACTIVE || this == GRACE_PERIOD;
    }
}
