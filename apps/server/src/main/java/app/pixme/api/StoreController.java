package app.pixme.api;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import app.pixme.api.dto.EntitlementsResponse;
import app.pixme.api.dto.StoreDtos;
import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.common.ServiceClock;
import app.pixme.security.AuthPrincipal;
import app.pixme.security.CurrentUser;
import app.pixme.store.CreditService;
import app.pixme.store.StoreService;
import app.pixme.store.domain.Product;
import app.pixme.store.domain.StorePlatform;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class StoreController {

    /**
     * PIXME+ benefits.
     *
     * <p>Copy lives here rather than in the client so the offer can change
     * without a release. Note what is absent: nothing in this list touches
     * hearts, waves, connections or chat — the subscription buys
     * self-expression, never access to other people.
     */
    private static final List<StoreDtos.PlusBenefitResponse> PLUS_BENEFITS = List.of(
            new StoreDtos.PlusBenefitResponse(
                    "MONTHLY_CREDITS", "매달 생성권 10개", "마음에 드는 모습이 나올 때까지.", "✨"),
            new StoreDtos.PlusBenefitResponse(
                    "PREMIUM_STYLES", "특별 스타일", "구독 기간 동안 프리미엄 픽셀 스타일을 쓸 수 있어요.", "🎨"),
            new StoreDtos.PlusBenefitResponse(
                    "PREMIUM_BACKGROUNDS", "프리미엄 배경", "카드 배경과 프레임을 더 자유롭게.", "🖼"),
            new StoreDtos.PlusBenefitResponse(
                    "PROFILE_THEME", "프로필 테마", "내 공간을 내 취향대로.", "🌈"),
            new StoreDtos.PlusBenefitResponse(
                    "EXTENDED_HISTORY", "기록 확장", "지난 PIXME를 더 오래, 더 자세히 볼 수 있어요.", "📚"),
            new StoreDtos.PlusBenefitResponse(
                    "NO_ADS", "광고 없음", "조용한 PIXME를 그대로.", "🔇"));

    private final StoreService storeService;
    private final CreditService creditService;
    private final ResponseAssembler assembler;
    private final ServiceClock clock;

    public StoreController(
            StoreService storeService,
            CreditService creditService,
            ResponseAssembler assembler,
            ServiceClock clock) {
        this.storeService = storeService;
        this.creditService = creditService;
        this.assembler = assembler;
        this.clock = clock;
    }

    @GetMapping("/store/products")
    public StoreDtos.CatalogResponse products(@CurrentUser AuthPrincipal principal) {
        StoreService.Catalog catalog = storeService.catalog(principal.userId());

        return new StoreDtos.CatalogResponse(
                map(catalog.creditPacks(), catalog.ownedUnlockCodes(), false),
                map(catalog.styles(), catalog.ownedUnlockCodes(), false),
                map(catalog.decorations(), catalog.ownedUnlockCodes(), false),
                map(catalog.subscriptions(), catalog.ownedUnlockCodes(), catalog.plusActive()),
                PLUS_BENEFITS);
    }

    @PostMapping("/purchases/verify")
    public StoreDtos.VerifyPurchaseResponse verify(
            @CurrentUser AuthPrincipal principal,
            @Valid @RequestBody StoreDtos.VerifyPurchaseRequest request) {

        StoreService.GrantResult result = storeService.verifyAndGrant(
                principal.userId(),
                new StoreService.VerifyCommand(
                        parsePlatform(request.platform()),
                        request.productCode(),
                        request.storeProductId(),
                        request.receipt(),
                        request.transactionId()));

        return new StoreDtos.VerifyPurchaseResponse(
                result.name(), entitlements(principal));
    }

    @PostMapping("/purchases/restore")
    public StoreDtos.RestoreResponse restore(
            @CurrentUser AuthPrincipal principal,
            @RequestBody StoreDtos.RestoreRequest request) {

        List<StoreService.VerifyCommand> commands = new ArrayList<>();
        if (request.receipts() != null) {
            request.receipts().forEach(receipt -> commands.add(new StoreService.VerifyCommand(
                    parsePlatform(receipt.platform()),
                    receipt.productCode(),
                    receipt.storeProductId(),
                    receipt.receipt(),
                    receipt.transactionId())));
        }

        int restored = storeService.restore(principal.userId(), commands);
        return new StoreDtos.RestoreResponse(entitlements(principal), restored);
    }

    @GetMapping("/entitlements")
    public EntitlementsResponse entitlements(@CurrentUser AuthPrincipal principal) {
        return assembler.entitlements(storeService.entitlements(principal.userId()));
    }

    @GetMapping("/credits")
    public StoreDtos.CreditSummaryResponse credits(@CurrentUser AuthPrincipal principal) {
        CreditService.Allowance allowance = creditService.allowance(principal.userId());

        List<StoreDtos.CreditLedgerResponse> history = new ArrayList<>();
        creditService.history(principal.userId(), 30).forEach(entry -> history.add(
                new StoreDtos.CreditLedgerResponse(
                        entry.getId().toString(),
                        entry.getDelta(),
                        entry.getReason().name(),
                        entry.getBalanceAfter(),
                        entry.getCreatedAt())));

        return new StoreDtos.CreditSummaryResponse(
                allowance.creditBalance(),
                allowance.freeAvailable(),
                clock.nextDayStart(),
                history);
    }

    /* ------------------------------------------------------------ helpers */

    private List<StoreDtos.ProductResponse> map(
            List<Product> products, Set<String> ownedCodes, boolean subscriptionActive) {

        List<StoreDtos.ProductResponse> responses = new ArrayList<>(products.size());
        for (Product product : products) {
            boolean owned = switch (product.getKind()) {
                case STYLE, DECORATION ->
                        product.getUnlockCode() != null
                                && ownedCodes.contains(product.getUnlockCode());
                case SUBSCRIPTION -> subscriptionActive;
                // Credit packs are consumable: never "owned".
                case CREDIT_PACK -> false;
            };

            responses.add(new StoreDtos.ProductResponse(
                    product.getCode(),
                    product.getKind().name(),
                    // Both ids are returned; the client picks its platform's.
                    product.getIosProductId() == null
                            ? product.getAndroidProductId()
                            : product.getIosProductId(),
                    product.getName(),
                    product.getDescription(),
                    product.getFallbackPriceKrw(),
                    product.getCreditAmount(),
                    product.getUnlockCode(),
                    product.getBadge(),
                    product.getSortOrder(),
                    null,
                    owned));
        }
        return responses;
    }

    private StorePlatform parsePlatform(String value) {
        try {
            return StorePlatform.valueOf(value.toUpperCase());
        } catch (RuntimeException exception) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "알 수 없는 결제 플랫폼이에요.");
        }
    }
}
