package app.pixme.api.dto;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.NotBlank;

public final class StoreDtos {

    private StoreDtos() {}

    public record CatalogResponse(
            List<ProductResponse> creditPacks,
            List<ProductResponse> styles,
            List<ProductResponse> decorations,
            List<ProductResponse> subscriptions,
            List<PlusBenefitResponse> plusBenefits) {}

    public record ProductResponse(
            String code,
            String kind,
            String storeProductId,
            String name,
            String description,
            int fallbackPriceKrw,
            Integer creditAmount,
            String unlockCode,
            String badge,
            int sortOrder,
            String previewImageUrl,
            boolean owned) {}

    public record PlusBenefitResponse(
            String code, String title, String description, String emoji) {}

    public record VerifyPurchaseRequest(
            @NotBlank String platform,
            String productCode,
            @NotBlank String storeProductId,
            @NotBlank String receipt,
            String transactionId) {}

    public record VerifyPurchaseResponse(String status, EntitlementsResponse entitlements) {}

    public record RestoreRequest(List<VerifyPurchaseRequest> receipts) {}

    public record RestoreResponse(EntitlementsResponse entitlements, int restoredCount) {}

    public record CreditSummaryResponse(
            int creditBalance,
            boolean freeGenerationAvailable,
            Instant freeGenerationResetsAt,
            List<CreditLedgerResponse> history) {}

    public record CreditLedgerResponse(
            String id, int delta, String reason, int balanceAfter, Instant createdAt) {}
}
