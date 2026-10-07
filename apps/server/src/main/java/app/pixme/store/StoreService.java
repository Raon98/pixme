package app.pixme.store;

import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

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
    private final Map<StorePlatform, ReceiptVerifier> verifiers = new EnumMap<>(StorePlatform.class);

    public StoreService(
            ProductRepository productRepository,
            PurchaseRepository purchaseRepository,
            SubscriptionRepository subscriptionRepository,
            UserUnlockRepository unlockRepository,
            CreditService creditService,
            List<ReceiptVerifier> receiptVerifiers) {
        this.productRepository = productRepository;
        this.purchaseRepository = purchaseRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.unlockRepository = unlockRepository;
        this.creditService = creditService;
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
                return GrantResult.ALREADY_GRANTED;
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
    @Transactional
    public int restore(UUID userId, List<VerifyCommand> commands) {
        int restored = 0;
        for (VerifyCommand command : commands) {
            try {
                GrantResult result = verifyAndGrant(userId, command);
                if (result == GrantResult.GRANTED) {
                    restored++;
                }
            } catch (ApiException exception) {
                // One bad receipt must not abort the whole restore.
                log.debug("skipping unrestorable receipt: {}", exception.getMessage());
            }
        }
        return restored;
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

        return new Entitlements(
                !active.isEmpty(),
                active.isEmpty() ? null : active.get(0).getCurrentPeriodEnd(),
                allowance.creditBalance(),
                allowance.firstGenerationAvailable(),
                allowance.firstRetryAvailable(),
                allowance.bonusFreeCredits(),
                Set.copyOf(unlockRepository.findCodesByUserIdAndKind(userId, "STYLE")),
                Set.copyOf(unlockRepository.findCodesByUserIdAndKind(userId, "DECORATION")));
    }

    @Transactional(readOnly = true)
    public boolean isPlusActive(UUID userId) {
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
}
