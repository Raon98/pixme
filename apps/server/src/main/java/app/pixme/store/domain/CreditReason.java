package app.pixme.store.domain;

/**
 * Reasons a <em>paid</em> credit balance moved.
 *
 * <p>Free allowances (first generation, first retry, bonus credit) are not in
 * the ledger: mixing them in would make {@code balance_after} meaningless.
 * Which free currency a generation consumed is recorded on the generation
 * itself.
 */
public enum CreditReason {
    PURCHASE,
    GENERATION,
    /** Automatic return when a paid generation failed. */
    GENERATION_REFUND,
    SUBSCRIPTION_GRANT,
    PROMOTION,
    REWARD_AD,
    /** The store revoked a purchase after the fact — a refund, a chargeback, family-sharing removal. */
    REVOCATION
}
