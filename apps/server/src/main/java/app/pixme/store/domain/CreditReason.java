package app.pixme.store.domain;

public enum CreditReason {
    PURCHASE,
    GENERATION,
    /** Automatic return when a paid generation failed. */
    GENERATION_REFUND,
    SUBSCRIPTION_GRANT,
    PROMOTION,
    REWARD_AD
}
