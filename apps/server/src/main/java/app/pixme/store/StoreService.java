package app.pixme.store;

import java.time.Instant;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.store.domain.CreditReason;
import app.pixme.store.domain.Product;
import app.pixme.store.domain.ProductKind;
import app.pixme.store.domain.Purchase;
import app.pixme.store.domain.StorePlatform;
import app.pixme.store.domain.Subscription;
import app.pixme.store.domain.SubscriptionStatus;
import app.pixme.store.domain.UserUnlock;
import app.pixme.store.receipt.ReceiptVerifier;
import app.pixme.store.repository.ProductRepository;
import app.pixme.store.repository.PurchaseRepository;
import app.pixme.store.repository.SubscriptionRepository;
import app.pixme.store.repository.UserUnlockRepository;
import app.pixme.user.MasterAccountService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Catalog, purchase validation and entitlements.
 *
 * <p>The monetisation principle is enforced by what this service is capable of
 * selling: extra generations, styles and decorations. There is no product kind
 * that gates a heart, a wave, a connection, a conversation, the feed or the
 * square — relationships are free, and that is a structural property here, not
 * a policy someone has to remember.
 *
 * <p>Granting is idempotent on the store transaction id, so a retried verify, a
 * restore, and a store webhook for the same purchase all converge on one grant.
 */
@Service
public class StoreService {

    private static final Logger log = LoggerFactory.getLogger(StoreService.class);

    private final ProductRepository productRepository;
    private final PurchaseRepository purchaseRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final UserUnlockRepository unlockRepository;
    private final CreditService creditService;
    private final MasterAccountService masterAccountService;
    private final Map<StorePlatform, ReceiptVerifier> verifiers = new EnumMap<>(StorePlatform.class);

    public StoreService(
            ProductRepository productRepository,
            PurchaseRepository purchaseRepository,
            SubscriptionRepository subscriptionRepository,
            UserUnlockRepository unlockRepository,
            CreditService creditService,
            MasterAccountService masterAccountService,
            List<ReceiptVerifier> receiptVerifiers) {
        this.productRepository = productRepository;
        this.purchaseRepository = purchaseRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.unlockRepository = unlockRepository;
        this.creditService = creditService;
        this.masterAccountService = masterAccountService;
        receiptVerifiers.forEach(verifier -> verifiers.put(verifier.platform(), verifier));
    }

    /* ------------------------------------------------------------ catalog */

    public record Catalog(
            List<Product> creditPacks,
            List<Product> styles,
            List<Product> decorations,
            List<Product> subscriptions,
            Set<String> ownedUnlockCodes,
            boolean plusActive) {}

    @Transactional(readOnly = true)
    public Catalog catalog(UUID userId) {
        Set<String> owned = Set.copyOf(unlockRepository.findCodesByUserId(userId));
        boolean plusActive = isPlusActive(userId);

        return new Catalog(
                productRepository.findByKindAndActiveTrueOrderBySortOrderAsc(ProductKind.CREDIT_PACK),
                productRepository.findByKindAndActiveTrueOrderBySortOrderAsc(ProductKind.STYLE),
                productRepository.findByKindAndActiveTrueOrderBySortOrderAsc(ProductKind.DECORATION),
                productRepository.findByKindAndActiveTrueOrderBySortOrderAsc(ProductKind.SUBSCRIPTION),
                owned,
                plusActive);
    }

    /* ------------------------------------------------------------ verify */

    public enum GrantResult {
        GRANTED,
        ALREADY_GRANTED,
        /**
         * The store sold this to the underlying Apple/Play account, but a
         * *different* PIXME account already holds the grant. One purchase, one
         * entitlement — so this is not a restore, and it is not a failure
         * either; it is the only outcome the user can actually act on (sign in
         * as the other account), which is why it is distinguishable.
         */
        OWNED_BY_ANOTHER_ACCOUNT,
        PENDING,
        INVALID
    }

    public record VerifyCommand(
            StorePlatform platform,
            String productCode,
            String storeProductId,
            String receipt,
            String transactionId) {}

    @Transactional
    public GrantResult verifyAndGrant(UUID userId, VerifyCommand command) {
        Product product = resolveProduct(command);

        ReceiptVerifier verifier = verifiers.get(command.platform());
        if (verifier == null) {
            throw new ApiException(ErrorCode.RECEIPT_INVALID, "지원하지 않는 결제 수단이에요.");
        }

        String expectedStoreProductId = product.storeProductId(command.platform());
        ReceiptVerifier.VerifiedPurchase verified =
                verifier.verify(command.receipt(), expectedStoreProductId);

        if (!verified.valid()) {
            log.warn(
                    "rejected receipt user={} product={} reason={}",
                    userId,
                    product.getCode(),
                    verified.failureReason());
            return GrantResult.INVALID;
        }

        // Idempotency anchor: the store's transaction id.
        Optional<Purchase> existing = purchaseRepository.findByPlatformAndTransactionId(
                command.platform(), verified.transactionId());

        if (existing.isPresent()) {
            Purchase purchase = existing.get();
            if (purchase.getStatus() == app.pixme.store.domain.PurchaseStatus.GRANTED) {
                if (purchase.getUserId().equals(userId)) {
                    return GrantResult.ALREADY_GRANTED;
                }
                return transferTo(userId, purchase, product, verified);
            }
            if (verified.pending()) {
                return GrantResult.PENDING;
            }
            // Previously pending, now settled.
            applyEntitlement(purchase.getUserId(), product, verified, purchase.getId(), command.platform());
            purchase.markGranted();
            purchaseRepository.save(purchase);
            return GrantResult.GRANTED;
        }

        Purchase purchase = Purchase.create(
                userId,
                product.getCode(),
                command.platform(),
                expectedStoreProductId,
                verified.transactionId(),
                verified.originalTransactionId(),
                command.receipt());

        if (verified.pending()) {
            purchaseRepository.save(purchase);
            log.info("purchase pending user={} product={}", userId, product.getCode());
            return GrantResult.PENDING;
        }

        purchaseRepository.saveAndFlush(purchase);
        applyEntitlement(userId, product, verified, purchase.getId(), command.platform());
        purchase.markGranted();
        purchaseRepository.save(purchase);

        log.info("granted product={} to user={}", product.getCode(), userId);
        return GrantResult.GRANTED;
    }

    /**
     * Re-validates everything the store still holds for this account.
     *
     * <p>The client sends SKUs without our internal codes (it only has what the
     * store told it), so products are resolved by store id here.
     */
    /** What a restore found, beyond how much of it was newly granted. */
    public record RestoreOutcome(int restored, int ownedByAnotherAccount) {}

    @Transactional
    public RestoreOutcome restoreWithOutcome(UUID userId, List<VerifyCommand> commands) {
        int restored = 0;
        int ownedElsewhere = 0;
        for (VerifyCommand command : commands) {
            try {
                GrantResult result = verifyAndGrant(userId, command);
                if (result == GrantResult.GRANTED) {
                    restored++;
                } else if (result == GrantResult.OWNED_BY_ANOTHER_ACCOUNT) {
                    ownedElsewhere++;
                }
            } catch (ApiException exception) {
                // One bad receipt must not abort the whole restore.
                log.debug("skipping unrestorable receipt: {}", exception.getMessage());
            }
        }
        return new RestoreOutcome(restored, ownedElsewhere);
    }

    /* ------------------------------------------------------- entitlements */

    /**
     * Everything the client needs to describe what a generation will cost.
     *
     * <p>The three free fields are separate rather than a single count because
     * they behave differently: the first retry is only reachable from the first
     * result screen, while the bonus credit can be spent any time.
     */
    public record Entitlements(
            boolean plusActive,
            Instant plusExpiresAt,
            int creditBalance,
            boolean firstGenerationAvailable,
            boolean firstRetryAvailable,
            int bonusFreeCredits,
            Set<String> unlockedStyles,
            Set<String> unlockedDecorations) {

        /** True when starting a new PIXME right now costs nothing. */
        public boolean nextGenerationIsFree() {
            return firstGenerationAvailable || bonusFreeCredits > 0;
        }
    }

    @Transactional(readOnly = true)
    public Entitlements entitlements(UUID userId) {
        CreditService.Allowance allowance = creditService.allowance(userId);
        List<Subscription> active = subscriptionRepository.findActive(userId, Instant.now());
        // Mirrors isPlusActive: a master account is PIXME+ without owning a
        // subscription row, and this is the value the client paywalls on.
        boolean plusActive = masterAccountService.isMaster(userId) || !active.isEmpty();

        Set<String> ownedDecorations =
                new HashSet<>(unlockRepository.findCodesByUserIdAndKind(userId, "DECORATION"));
        if (plusActive) {
            // PIXME+ includes the whole decoration catalog for the duration
            // of the subscription — granted live here, never written as a
            // UserUnlock row, so access disappears the moment the
            // subscription lapses rather than being kept forever like an
            // actual purchase. An item bought individually (e.g. by a user
            // who isn't subscribed) stays owned either way.
            ownedDecorations.addAll(
                    productRepository.findByKindAndActiveTrueOrderBySortOrderAsc(ProductKind.DECORATION)
                            .stream()
                            .map(Product::getUnlockCode)
                            .collect(Collectors.toSet()));
        }

        return new Entitlements(
                plusActive,
                active.isEmpty() ? null : active.get(0).getCurrentPeriodEnd(),
                allowance.creditBalance(),
                allowance.firstGenerationAvailable(),
                allowance.firstRetryAvailable(),
                allowance.bonusFreeCredits(),
                Set.copyOf(unlockRepository.findCodesByUserIdAndKind(userId, "STYLE")),
                Set.copyOf(ownedDecorations));
    }

    @Transactional(readOnly = true)
    public boolean isPlusActive(UUID userId) {
        if (masterAccountService.isMaster(userId)) {
            return true;
        }
        return !subscriptionRepository.findActive(userId, Instant.now()).isEmpty();
    }

    /* ------------------------------------------------------- subscriptions */

    /**
     * Pays out the monthly credit grant for renewed subscriptions.
     *
     * <p>Keyed on {@code lastGrantPeriodEnd} so a store that notifies us twice
     * about the same renewal grants once. Run on a schedule and also after a
     * webhook.
     */
    @Transactional
    public int grantPendingSubscriptionCredits() {
        List<Subscription> pending = subscriptionRepository.findPendingGrants(Instant.now());
        int granted = 0;

        for (Subscription subscription : pending) {
            Product product = productRepository.findById(subscription.getProductCode()).orElse(null);
            if (product == null || product.getCreditAmount() == null) {
                continue;
            }
            creditService.grant(
                    subscription.getUserId(),
                    product.getCreditAmount(),
                    CreditReason.SUBSCRIPTION_GRANT,
                    subscription.getId());
            subscription.setLastGrantPeriodEnd(subscription.getCurrentPeriodEnd());
            subscriptionRepository.save(subscription);
            granted++;
        }
        return granted;
    }

    /** Moves lapsed subscriptions to EXPIRED so entitlements stop. */
    @Transactional
    public int expireLapsedSubscriptions() {
        List<Subscription> lapsed = subscriptionRepository.findLapsed(Instant.now());
        lapsed.forEach(subscription -> {
            subscription.setStatus(SubscriptionStatus.EXPIRED);
            subscriptionRepository.save(subscription);
        });
        return lapsed.size();
    }

    /* ------------------------------------------------------------ helpers */

    private Product resolveProduct(VerifyCommand command) {
        if (command.productCode() != null && !command.productCode().isBlank()) {
            return productRepository
                    .findById(command.productCode())
                    .orElseThrow(() -> new ApiException(ErrorCode.PRODUCT_NOT_FOUND));
        }
        return productRepository
                .findByStoreProductId(command.storeProductId())
                .orElseThrow(() -> new ApiException(ErrorCode.PRODUCT_NOT_FOUND));
    }

    /**
     * Moves a non-consumable from the PIXME account that first redeemed it to
     * the one asking now.
     *
     * <p>Entitlements are per PIXME account, but the store sells to the
     * Apple/Play account — so signing into a second PIXME account on the same
     * device used to be a dead end: the store refuses to sell again ("already
     * purchased") and the server refused to grant ("someone else has it").
     * Moving it keeps the invariant that matters — one purchase is usable by
     * exactly one account at a time, so this cannot be farmed — while making
     * the thing someone paid for reachable from whichever account they are
     * actually signed into.
     *
     * <p>Credit packs are excluded: they are consumable and may already be
     * partly spent on the other account, so there is nothing coherent to move.
     */
    private GrantResult transferTo(
            UUID userId,
            Purchase purchase,
            Product product,
            ReceiptVerifier.VerifiedPurchase verified) {

        if (product.getKind() == ProductKind.CREDIT_PACK) {
            return GrantResult.OWNED_BY_ANOTHER_ACCOUNT;
        }

        UUID previousOwnerId = purchase.getUserId();

        if (product.getUnlockCode() != null) {
            unlockRepository.deleteByKey(
                    new UserUnlock.Key(previousOwnerId, product.getUnlockCode()));
        }

        purchase.setUserId(userId);
        purchaseRepository.save(purchase);
        applyEntitlement(userId, product, verified, purchase.getId(), purchase.getPlatform());

        log.info(
                "transferred product={} from user={} to user={}",
                product.getCode(),
                previousOwnerId,
                userId);
        return GrantResult.GRANTED;
    }

    private void applyEntitlement(
            UUID userId,
            Product product,
            ReceiptVerifier.VerifiedPurchase verified,
            UUID purchaseId,
            StorePlatform platform) {

        switch (product.getKind()) {
            case CREDIT_PACK -> creditService.grant(
                    userId,
                    product.getCreditAmount() == null ? 0 : product.getCreditAmount(),
                    CreditReason.PURCHASE,
                    purchaseId);

            case STYLE, DECORATION -> {
                if (product.getUnlockCode() == null) {
                    break;
                }
                UserUnlock.Key key = new UserUnlock.Key(userId, product.getUnlockCode());
                if (!unlockRepository.existsByKey(key)) {
                    unlockRepository.save(new UserUnlock(
                            userId,
                            product.getUnlockCode(),
                            product.getKind().name(),
                            "PURCHASE"));
                }
            }

            case SUBSCRIPTION -> upsertSubscription(userId, product, verified, platform);
        }
    }

    private void upsertSubscription(
            UUID userId,
            Product product,
            ReceiptVerifier.VerifiedPurchase verified,
            StorePlatform platform) {

        Instant periodEnd = verified.expiresAt() == null
                // A subscription receipt without an expiry is unusable; a
                // conservative short window beats granting indefinite access.
                ? Instant.now().plus(java.time.Duration.ofDays(1))
                : verified.expiresAt();

        Subscription subscription = subscriptionRepository
                .findByPlatformAndOriginalTransactionId(
                        platform, verified.originalTransactionId())
                .orElse(null);

        if (subscription == null) {
            subscription = Subscription.create(
                    userId,
                    product.getCode(),
                    platform,
                    verified.originalTransactionId(),
                    SubscriptionStatus.ACTIVE,
                    periodEnd);
        } else {
            // Follows the store account, like every other non-consumable —
            // see `transferTo`. Without this a transferred PIXME+ would keep
            // billing the same Apple ID while only the old PIXME account
            // could actually use it. The period's credit grant does not
            // repeat: `needsGrant()` is already false for this period.
            subscription.setUserId(userId);
            subscription.setStatus(SubscriptionStatus.ACTIVE);
            subscription.setCurrentPeriodEnd(periodEnd);
            subscription.setAutoRenewing(verified.autoRenewing());
        }
        subscriptionRepository.save(subscription);

        if (subscription.needsGrant() && product.getCreditAmount() != null) {
            creditService.grant(
                    userId,
                    product.getCreditAmount(),
                    CreditReason.SUBSCRIPTION_GRANT,
                    subscription.getId());
            subscription.setLastGrantPeriodEnd(subscription.getCurrentPeriodEnd());
            subscriptionRepository.save(subscription);
        }
    }

    @Transactional(readOnly = true)
    public List<Purchase> purchasesOf(UUID userId) {
        return purchaseRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    /* -------------------------------------------------------- revocation */

    /**
     * The store told us a purchase is gone — a refund, a chargeback, or
     * family-sharing removal. Claws back whatever it granted.
     *
     * <p>Every kind of product is revocable, which is a deliberate mirror of
     * {@link #applyEntitlement}: a non-consumable is removed, paid credits are
     * clawed back (clamped at zero — if they're already spent there is
     * nothing left to take), and a subscription stops granting access
     * immediately rather than waiting for its period to lapse naturally.
     *
     * <p>Idempotent: both stores resend a notification until it is
     * acknowledged, and {@link CreditService#reclaim} / the unconditional
     * {@code markRevoked()} calls below are each safe to repeat.
     */
    /**
     * Extends a subscription the store has renewed on its own.
     *
     * <p>A renewal transaction is minted by the store and never passes through
     * {@code verifyAndGrant}, so without this nothing ever moves
     * {@code currentPeriodEnd} forward: the scheduled sweeps can only expire a
     * subscription, never extend one. The subscriber would keep being billed
     * while silently losing PIXME+ and the monthly credits.
     */
    @Transactional
    public void renew(
            StorePlatform platform,
            String originalTransactionId,
            Instant expiresAt,
            boolean autoRenewing) {

        if (originalTransactionId == null || expiresAt == null) {
            log.warn(
                    "renewal missing identifiers platform={} originalTransactionId={} expiresAt={}",
                    platform,
                    originalTransactionId,
                    expiresAt);
            return;
        }

        Subscription subscription = subscriptionRepository
                .findByPlatformAndOriginalTransactionId(platform, originalTransactionId)
                .orElse(null);
        if (subscription == null) {
            // The first purchase is verified by the client; a renewal arriving
            // before that is nothing we can attribute to a user.
            log.warn(
                    "renewal for unknown subscription platform={} originalTransactionId={}",
                    platform,
                    originalTransactionId);
            return;
        }

        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setCurrentPeriodEnd(expiresAt);
        subscription.setAutoRenewing(autoRenewing);
        subscriptionRepository.save(subscription);

        // Same payout rule as a fresh purchase; `needsGrant` is what keeps a
        // redelivered notification from granting the month twice.
        if (subscription.needsGrant()) {
            productRepository
                    .findById(subscription.getProductCode())
                    .filter(product -> product.getCreditAmount() != null)
                    .ifPresent(product -> {
                        creditService.grant(
                                subscription.getUserId(),
                                product.getCreditAmount(),
                                CreditReason.SUBSCRIPTION_GRANT,
                                subscription.getId());
                        subscription.setLastGrantPeriodEnd(subscription.getCurrentPeriodEnd());
                        subscriptionRepository.save(subscription);
                    });
        }

        log.info(
                "renewed subscription user={} until={}",
                subscription.getUserId(),
                expiresAt);
    }

    @Transactional
    public void revoke(StorePlatform platform, String transactionId, String originalTransactionId) {
        Optional<Purchase> purchase = transactionId == null
                ? Optional.empty()
                : purchaseRepository.findByPlatformAndTransactionId(platform, transactionId);

        if (purchase.isPresent()) {
            revokePurchase(purchase.get());
            return;
        }

        // No matching Purchase row — most often a subscription renewal
        // transaction, which is minted by the store itself and never passes
        // through verifyAndGrant/client-side purchase. Fall back to the
        // subscription row, keyed by the original transaction id, which
        // every renewal shares.
        if (originalTransactionId != null) {
            subscriptionRepository
                    .findByPlatformAndOriginalTransactionId(platform, originalTransactionId)
                    .ifPresentOrElse(
                            this::revokeSubscription,
                            () -> log.warn(
                                    "revocation for unknown purchase platform={} transactionId={} "
                                            + "originalTransactionId={}",
                                    platform,
                                    transactionId,
                                    originalTransactionId));
        } else {
            log.warn(
                    "revocation for unknown purchase platform={} transactionId={}",
                    platform,
                    transactionId);
        }
    }

    private void revokePurchase(Purchase purchase) {
        if (purchase.getStatus() == app.pixme.store.domain.PurchaseStatus.REVOKED) {
            return; // already handled — a duplicate notification
        }

        Product product = productRepository.findById(purchase.getProductCode()).orElse(null);
        purchase.markRevoked();
        purchaseRepository.save(purchase);

        if (product == null) {
            log.warn("revoked purchase {} references unknown product {}",
                    purchase.getId(), purchase.getProductCode());
            return;
        }

        switch (product.getKind()) {
            case CREDIT_PACK -> {
                int amount = product.getCreditAmount() == null ? 0 : product.getCreditAmount();
                creditService.reclaim(purchase.getUserId(), amount, purchase.getId());
            }
            case STYLE, DECORATION -> {
                if (product.getUnlockCode() != null) {
                    unlockRepository.deleteByKey(
                            new UserUnlock.Key(purchase.getUserId(), product.getUnlockCode()));
                }
            }
            case SUBSCRIPTION -> subscriptionRepository
                    .findByPlatformAndOriginalTransactionId(
                            purchase.getPlatform(), purchase.getOriginalTransactionId())
                    .ifPresent(this::revokeSubscription);
        }

        log.info("revoked purchase={} user={} product={}",
                purchase.getId(), purchase.getUserId(), product.getCode());
    }

    private void revokeSubscription(Subscription subscription) {
        if (subscription.getStatus() == SubscriptionStatus.CANCELLED
                || subscription.getStatus() == SubscriptionStatus.EXPIRED) {
            return;
        }
        // Cuts PIXME+ off immediately — isPlusActive() only grants access for
        // ACTIVE/GRACE_PERIOD, so this takes effect on the very next request,
        // not at the end of the (now-refunded) billing period.
        subscription.setStatus(SubscriptionStatus.CANCELLED);
        subscriptionRepository.save(subscription);
        log.info("revoked subscription={} user={}", subscription.getId(), subscription.getUserId());
    }
}
