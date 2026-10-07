package app.pixme.store.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A user's generation allowance.
 *
 * <p>There is no daily free generation. Free generation is an onboarding grant,
 * and the three free chances are deliberately <em>different currencies</em>
 * rather than a single counter of three:
 *
 * <ol>
 *   <li><b>First generation</b> — once per account. Nobody should have to pay to
 *       find out what the product does.
 *   <li><b>First retry</b> — once, and only on the first character's result
 *       screen. Its job is to stop someone leaving because the very first AI
 *       result disappointed them, so it must not survive as a general credit to
 *       be spent days later.
 *   <li><b>Bonus free credit</b> — usable any time, so the user can discover
 *       that a different outfit produces a different PIXME.
 * </ol>
 *
 * <p>Collapsing these into one number would lose exactly the distinctions that
 * make them work, and would make a refund unable to give back the right thing.
 */
@Entity
@Table(name = "generation_credits")
@Getter
@Setter
@NoArgsConstructor
public class GenerationCredit {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** Paid credits. */
    @Column(name = "credit_count", nullable = false)
    private int creditCount;

    /** Set the first time this account generates. Null ⇒ the first one is free. */
    @Column(name = "first_generation_at")
    private Instant firstGenerationAt;

    @Column(name = "first_retry_used_at")
    private Instant firstRetryUsedAt;

    @Column(name = "bonus_free_credit_count", nullable = false)
    private short bonusFreeCreditCount;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static GenerationCredit createFor(UUID userId, int onboardingBonusCredits) {
        GenerationCredit credit = new GenerationCredit();
        credit.userId = userId;
        credit.creditCount = 0;
        credit.bonusFreeCreditCount = (short) Math.max(0, onboardingBonusCredits);
        credit.updatedAt = Instant.now();
        return credit;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    /* ----------------------------------------------------------- queries */

    public boolean isFirstGenerationAvailable() {
        return firstGenerationAt == null;
    }

    /**
     * The free retry only exists after a first generation and before it has
     * been used. Whether the retry actually targets that first character is
     * checked by the caller — this only owns the entitlement.
     */
    public boolean isFirstRetryAvailable() {
        return firstGenerationAt != null && firstRetryUsedAt == null;
    }

    public boolean hasBonusFreeCredit() {
        return bonusFreeCreditCount > 0;
    }

    public boolean hasPaidCredit() {
        return creditCount > 0;
    }

    /** Free chances still unused, for the "N회 남았어요" copy. */
    public int freeRemaining() {
        return (isFirstGenerationAvailable() ? 1 : 0)
                + (isFirstRetryAvailable() ? 1 : 0)
                + bonusFreeCreditCount;
    }

    /* ------------------------------------------------------------ spend */

    public void consumeFirstGeneration() {
        this.firstGenerationAt = Instant.now();
    }

    public void consumeFirstRetry() {
        this.firstRetryUsedAt = Instant.now();
    }

    public void consumeBonusFreeCredit() {
        if (bonusFreeCreditCount <= 0) {
            throw new IllegalStateException("no bonus free credit to consume");
        }
        this.bonusFreeCreditCount = (short) (this.bonusFreeCreditCount - 1);
    }

    public void consumeCredit() {
        if (creditCount <= 0) {
            throw new IllegalStateException("no credit to consume");
        }
        this.creditCount -= 1;
    }

    /* ----------------------------------------------------------- refund */

    /**
     * Returns the first-generation entitlement.
     *
     * <p>Note this restores the <em>entitlement</em>, not the timestamp's
     * meaning: a failed first generation must leave the account exactly as it
     * was, including the free retry still being unavailable.
     */
    public void restoreFirstGeneration() {
        this.firstGenerationAt = null;
    }

    public void restoreFirstRetry() {
        this.firstRetryUsedAt = null;
    }

    public void restoreBonusFreeCredit() {
        this.bonusFreeCreditCount = (short) (this.bonusFreeCreditCount + 1);
    }

    public void addCredits(int amount) {
        this.creditCount = Math.max(0, this.creditCount + amount);
    }
}
