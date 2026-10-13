package app.pixme.store;

import java.util.List;
import java.util.UUID;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.config.PixmeProperties;
import app.pixme.store.domain.CreditLedgerEntry;
import app.pixme.store.domain.CreditReason;
import app.pixme.store.domain.GenerationCredit;
import app.pixme.store.domain.SpendKind;
import app.pixme.store.repository.CreditLedgerRepository;
import app.pixme.store.repository.GenerationCreditRepository;
import app.pixme.user.MasterAccountService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The generation allowance — the money path.
 *
 * <p>Free generation is an onboarding grant, not a daily allowance:
 *
 * <pre>
 *   1st generation            free   (once per account)
 *   retry of that 1st result  free   (once, only inside the first flow)
 *   bonus free credit         free   (one, usable any time afterwards)
 *   everything after that     paid
 * </pre>
 *
 * <p>Rules enforced here and nowhere else:
 * <ul>
 *   <li>Free chances are spent before paid credits, in the order above.
 *   <li>Spending takes a row lock, so two concurrent requests can't both spend
 *       the last credit.
 *   <li>A refund gives back <em>exactly</em> the currency that was spent — which
 *       is why {@link SpendKind} is recorded on the generation rather than a
 *       bare "was it free?" boolean.
 * </ul>
 */
@Service
public class CreditService {

    private static final Logger log = LoggerFactory.getLogger(CreditService.class);

    private final GenerationCreditRepository creditRepository;
    private final CreditLedgerRepository ledgerRepository;
    private final PixmeProperties properties;
    private final MasterAccountService masterAccountService;

    public CreditService(
            GenerationCreditRepository creditRepository,
            CreditLedgerRepository ledgerRepository,
            PixmeProperties properties,
            MasterAccountService masterAccountService) {
        this.creditRepository = creditRepository;
        this.ledgerRepository = ledgerRepository;
        this.properties = properties;
        this.masterAccountService = masterAccountService;
    }

    /**
     * What the user can do right now.
     *
     * @param firstGenerationAvailable the very first PIXME is still free
     * @param firstRetryAvailable the one free retry of the first result
     * @param bonusFreeCredits non-expiring free credits from sign-up
     * @param creditBalance purchased credits
     */
    public record Allowance(
            boolean firstGenerationAvailable,
            boolean firstRetryAvailable,
            int bonusFreeCredits,
            int creditBalance) {

        /** Can a *new* generation be started (retry excluded — it is scoped). */
        public boolean canGenerate() {
            return firstGenerationAvailable || bonusFreeCredits > 0 || creditBalance > 0;
        }

        /** True when the next new generation costs nothing. */
        public boolean nextGenerationIsFree() {
            return firstGenerationAvailable || bonusFreeCredits > 0;
        }

        public int freeRemaining() {
            return (firstGenerationAvailable ? 1 : 0)
                    + (firstRetryAvailable ? 1 : 0)
                    + bonusFreeCredits;
        }
    }

    /** Comfortably more than anyone will spend testing in a review pass. */
    private static final int MASTER_CREDIT_BALANCE = 999_999;

    @Transactional(readOnly = true)
    public Allowance allowance(UUID userId) {
        if (masterAccountService.isMaster(userId)) {
            return new Allowance(true, true, 0, MASTER_CREDIT_BALANCE);
        }
        return creditRepository
                .findById(userId)
                .map(this::toAllowance)
                .orElseGet(() -> new Allowance(
                        true, false, properties.generation().onboardingBonusCredits(), 0));
    }

    private Allowance toAllowance(GenerationCredit credit) {
        return new Allowance(
                credit.isFirstGenerationAvailable(),
                credit.isFirstRetryAvailable(),
                credit.getBonusFreeCreditCount(),
                credit.getCreditCount());
    }

    /** Creates the row with the onboarding grant. Called once, at sign-up. */
    @Transactional
    public GenerationCredit initialize(UUID userId) {
        return creditRepository
                .findById(userId)
                .orElseGet(() -> creditRepository.save(GenerationCredit.createFor(
                        userId, properties.generation().onboardingBonusCredits())));
    }

    /**
     * Same as {@link #initialize}, but for an account whose social identity
     * has deleted and re-signed up before — see
     * {@link app.pixme.job.AccountPurgeJob}. The onboarding entitlements are
     * created already spent, rather than withheld by some other means, so
     * every other code path (free-generation checks, "N회 남았어요" copy) stays
     * exactly as it is for a genuinely new account.
     */
    public GenerationCredit initializeAsReturning(UUID userId) {
        return creditRepository.findById(userId).orElseGet(() -> {
            GenerationCredit credit = GenerationCredit.createFor(userId, 0);
            credit.consumeFirstGeneration();
            credit.consumeFirstRetry();
            return creditRepository.save(credit);
        });
    }

    /* ------------------------------------------------------------- spend */

    /**
     * Spends the cheapest available allowance for a brand-new generation:
     * first-generation, then bonus free, then a paid credit.
     *
     * @throws ApiException {@code NO_GENERATION_AVAILABLE} when none remain
     */
    @Transactional
    public SpendKind spendForGeneration(UUID userId, UUID generationId) {
        if (masterAccountService.isMaster(userId)) {
            return SpendKind.MASTER;
        }

        GenerationCredit credit = lockOrCreate(userId);

        if (credit.isFirstGenerationAvailable()) {
            credit.consumeFirstGeneration();
            creditRepository.save(credit);
            return SpendKind.FREE_FIRST;
        }

        if (credit.hasBonusFreeCredit()) {
            credit.consumeBonusFreeCredit();
            creditRepository.save(credit);
            return SpendKind.FREE_BONUS;
        }

        if (!credit.hasPaidCredit()) {
            throw new ApiException(ErrorCode.NO_GENERATION_AVAILABLE);
        }

        credit.consumeCredit();
        creditRepository.save(credit);
        ledgerRepository.save(CreditLedgerEntry.of(
                userId, -1, CreditReason.GENERATION, credit.getCreditCount(), generationId));

        return SpendKind.PAID_CREDIT;
    }

    /**
     * Spends the first-character free retry if it is still available,
     * otherwise falls through to the normal order.
     *
     * <p>Kept separate from {@link #spendForGeneration} because the free retry
     * is scoped to one moment in the product — the first result screen — and
     * must not be reachable from the ordinary "make another PIXME" path.
     */
    @Transactional
    public SpendKind spendForFirstRetry(UUID userId, UUID generationId) {
        GenerationCredit credit = lockOrCreate(userId);

        if (credit.isFirstRetryAvailable()) {
            credit.consumeFirstRetry();
            creditRepository.save(credit);
            return SpendKind.FREE_FIRST_RETRY;
        }
        return spendForGeneration(userId, generationId);
    }

    /* ------------------------------------------------------------ refund */

    /**
     * Returns exactly what a failed generation consumed.
     *
     * <p>Runs in its own transaction so the refund still lands when the
     * surrounding generation transaction is rolling back — a server-side
     * failure must never cost the user anything.
     *
     * @return true when something was actually returned
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean refund(UUID userId, UUID generationId, SpendKind spendKind) {
        if (spendKind == SpendKind.MASTER) {
            // Nothing was ever debited, so there is nothing to give back.
            return true;
        }
        if (spendKind == SpendKind.PAID_CREDIT
                && ledgerRepository.existsByReferenceIdAndReason(
                        generationId, CreditReason.GENERATION_REFUND)) {
            return false;
        }

        GenerationCredit credit = lockOrCreate(userId);

        switch (spendKind) {
            case MASTER -> throw new IllegalStateException("handled above");
            case FREE_FIRST -> credit.restoreFirstGeneration();
            case FREE_FIRST_RETRY -> credit.restoreFirstRetry();
            case FREE_BONUS -> credit.restoreBonusFreeCredit();
            case PAID_CREDIT -> {
                credit.addCredits(1);
                ledgerRepository.save(CreditLedgerEntry.of(
                        userId,
                        1,
                        CreditReason.GENERATION_REFUND,
                        credit.getCreditCount(),
                        generationId));
            }
        }

        creditRepository.save(credit);
        log.info(
                "refunded {} to user={} for failed generation={}",
                spendKind,
                userId,
                generationId);
        return true;
    }

    /* ------------------------------------------------------------- grant */

    @Transactional
    public int grant(UUID userId, int amount, CreditReason reason, UUID referenceId) {
        if (amount <= 0) {
            return allowance(userId).creditBalance();
        }

        GenerationCredit credit = lockOrCreate(userId);
        credit.addCredits(amount);
        creditRepository.save(credit);
        ledgerRepository.save(CreditLedgerEntry.of(
                userId, amount, reason, credit.getCreditCount(), referenceId));

        return credit.getCreditCount();
    }

    @Transactional(readOnly = true)
    public List<CreditLedgerEntry> history(UUID userId, int limit) {
        return ledgerRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, limit));
    }

    /* --------------------------------------------------------- revocation */

    /**
     * Claws back credits a store purchase granted, because the store itself
     * revoked that purchase — a refund, a chargeback, family-sharing removal.
     *
     * <p>Idempotent on {@code (referenceId, REVOCATION)}, since every store
     * re-sends a webhook until it gets a 200 and the same revocation must not
     * be applied twice. Clamped at zero rather than going negative: if the
     * credits were already spent, there is nothing left to take back and the
     * loss is absorbed, the same way a refund on an already-spent purchase
     * would be at any digital goods store.
     *
     * <p>Runs in its own transaction, same as {@link #refund}, so it still
     * lands even if the surrounding webhook-handling transaction rolls back.
     *
     * @return true when this call actually reclaimed something (false if it
     *     was a duplicate notification already applied)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean reclaim(UUID userId, int amount, UUID referenceId) {
        if (amount <= 0) {
            return false;
        }
        if (ledgerRepository.existsByReferenceIdAndReason(referenceId, CreditReason.REVOCATION)) {
            return false;
        }

        GenerationCredit credit = lockOrCreate(userId);
        int before = credit.getCreditCount();
        credit.addCredits(-amount);
        creditRepository.save(credit);

        int actualDelta = credit.getCreditCount() - before;
        ledgerRepository.save(CreditLedgerEntry.of(
                userId, actualDelta, CreditReason.REVOCATION, credit.getCreditCount(), referenceId));

        log.info(
                "reclaimed {} (of {} requested) from user={} for revoked purchase={}",
                actualDelta,
                -amount,
                userId,
                referenceId);
        return true;
    }

    private GenerationCredit lockOrCreate(UUID userId) {
        return creditRepository
                .findForUpdate(userId)
                .orElseGet(() -> creditRepository.saveAndFlush(GenerationCredit.createFor(
                        userId, properties.generation().onboardingBonusCredits())));
    }
}
