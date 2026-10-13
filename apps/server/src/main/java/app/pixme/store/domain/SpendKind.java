package app.pixme.store.domain;

/**
 * Which allowance a generation consumed.
 *
 * <p>Recorded on the generation rather than inferred from a boolean, because a
 * refund has to give back the same currency: returning a paid credit for a
 * failed free retry would quietly hand out money, and returning the free retry
 * for a failed paid generation would quietly take it.
 */
public enum SpendKind {
    /** The one free first generation. */
    FREE_FIRST,
    /** The one free retry of that first result. */
    FREE_FIRST_RETRY,
    /** A non-expiring free credit granted at sign-up. */
    FREE_BONUS,
    PAID_CREDIT,
    /** A master account — see {@link app.pixme.user.MasterAccountService}. Nothing is ever debited or refunded. */
    MASTER;

    public boolean isFree() {
        return this != PAID_CREDIT;
    }
}
