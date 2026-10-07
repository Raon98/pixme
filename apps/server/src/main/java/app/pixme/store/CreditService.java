package app.pixme.store;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.common.ServiceClock;
import app.pixme.config.PixmeProperties;
import app.pixme.store.domain.CreditLedgerEntry;
import app.pixme.store.domain.CreditReason;
import app.pixme.store.domain.GenerationCredit;
import app.pixme.store.repository.CreditLedgerRepository;
import app.pixme.store.repository.GenerationCreditRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The generation allowance.
 *
 * <p>This is the money path, so a few rules are enforced here and nowhere else:
 * <ul>
 *   <li>The free daily slot is spent before any paid credit. A user who has
 *       bought credits still gets their free generation every day.
 *   <li>Spending takes a row lock, so two concurrent requests can't both spend
 *       the last credit.
 *   <li>Every movement writes a ledger row, and a refund is keyed to the
 *       generation that failed so it can only ever happen once.
 * </ul>
 */
@Service
public class CreditService {

    private static final Logger log = LoggerFactory.getLogger(CreditService.class);

    private final GenerationCreditRepository creditRepository;
    private final CreditLedgerRepository ledgerRepository;
    private final ServiceClock clock;
    private final PixmeProperties properties;

    public CreditService(
            GenerationCreditRepository creditRepository,
            CreditLedgerRepository ledgerRepository,
            ServiceClock clock,
            PixmeProperties properties) {
        this.creditRepository = creditRepository;
        this.ledgerRepository = ledgerRepository;
        this.clock = clock;
        this.properties = properties;
    }

    /** What was actually spent for a generation. Drives the refund decision. */
    public enum SpendKind {
        FREE_DAILY,
        PAID_CREDIT
    }

    public record Allowance(boolean freeAvailable, int creditBalance) {

        public boolean canGenerate() {
            return freeAvailable || creditBalance > 0;
        }
    }

    @Transactional(readOnly = true)
    public Allowance allowance(UUID userId) {
        GenerationCredit credit = creditRepository.findById(userId).orElse(null);
        if (credit == null) {
            return new Allowance(true, 0);
        }
        return new Allowance(
                credit.hasFreeGeneration(clock.today(), properties.generation().freePerDay()),
                credit.getCreditCount());
    }

    /** Ensures the row exists. Called once at sign-up. */
    @Transactional
    public GenerationCredit initialize(UUID userId) {
        return creditRepository
                .findById(userId)
                .orElseGet(() -> creditRepository.save(GenerationCredit.createFor(userId)));
    }

    /**
     * Spends the free slot if available, otherwise one paid credit.
     *
     * @throws ApiException {@code NO_GENERATION_AVAILABLE} when neither exists
     */
    @Transactional
    public SpendKind spendForGeneration(UUID userId, UUID generationId) {
        GenerationCredit credit = creditRepository
                .findForUpdate(userId)
                .orElseGet(() -> creditRepository.saveAndFlush(GenerationCredit.createFor(userId)));

        LocalDate today = clock.today();

        if (credit.hasFreeGeneration(today, properties.generation().freePerDay())) {
            credit.consumeFreeGeneration(today);
            creditRepository.save(credit);
            // The free slot is not a credit, so it produces no ledger entry —
            // the ledger tracks paid balance only.
            return SpendKind.FREE_DAILY;
        }

        if (credit.getCreditCount() <= 0) {
            throw new ApiException(ErrorCode.NO_GENERATION_AVAILABLE);
        }

        credit.consumeCredit();
        creditRepository.save(credit);
        ledgerRepository.save(CreditLedgerEntry.of(
                userId, -1, CreditReason.GENERATION, credit.getCreditCount(), generationId));

        return SpendKind.PAID_CREDIT;
    }

    /**
     * Returns the credit spent on a failed generation.
     *
     * <p>Runs in its own transaction so that a refund still lands even when the
     * surrounding generation transaction is rolling back — the whole point is
     * that a server-side failure never costs the user money.
     *
     * @return true when a credit was actually returned
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean refundForGeneration(UUID userId, UUID generationId) {
        if (ledgerRepository.existsByReferenceIdAndReason(
                generationId, CreditReason.GENERATION_REFUND)) {
            return false;
        }

        GenerationCredit credit = creditRepository
                .findForUpdate(userId)
                .orElseGet(() -> creditRepository.saveAndFlush(GenerationCredit.createFor(userId)));

        credit.addCredits(1);
        creditRepository.save(credit);
        ledgerRepository.save(CreditLedgerEntry.of(
                userId,
                1,
                CreditReason.GENERATION_REFUND,
                credit.getCreditCount(),
                generationId));

        log.info("refunded 1 credit to user={} for failed generation={}", userId, generationId);
        return true;
    }

    /**
     * Returns the free daily slot for a failed generation.
     *
     * <p>Symmetrical with the credit refund: a free generation that failed on
     * our side must not consume the user's one chance for the day.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void restoreFreeGeneration(UUID userId) {
        creditRepository.findForUpdate(userId).ifPresent(credit -> {
            if (credit.getFreeUsedToday() > 0
                    && clock.today().equals(credit.getLastFreeGenerationDate())) {
                credit.setFreeUsedToday((short) (credit.getFreeUsedToday() - 1));
                creditRepository.save(credit);
            }
        });
    }

    @Transactional
    public int grant(UUID userId, int amount, CreditReason reason, UUID referenceId) {
        if (amount <= 0) {
            return allowance(userId).creditBalance();
        }

        GenerationCredit credit = creditRepository
                .findForUpdate(userId)
                .orElseGet(() -> creditRepository.saveAndFlush(GenerationCredit.createFor(userId)));

        credit.addCredits(amount);
        creditRepository.save(credit);
        ledgerRepository.save(CreditLedgerEntry.of(
                userId, amount, reason, credit.getCreditCount(), referenceId));

        return credit.getCreditCount();
    }

    @Transactional(readOnly = true)
    public List<CreditLedgerEntry> history(UUID userId, int limit) {
        return ledgerRepository.findByUserIdOrderByCreatedAtDesc(
                userId, PageRequest.of(0, limit));
    }

    /** How many generations the user has made today, for the hard daily cap. */
    @Transactional(readOnly = true)
    public boolean freeAvailable(UUID userId) {
        return allowance(userId).freeAvailable();
    }
}
