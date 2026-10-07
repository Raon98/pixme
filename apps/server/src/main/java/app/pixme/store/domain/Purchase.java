package app.pixme.store.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A validated store transaction.
 *
 * <p>The unique index on {@code (platform, transaction_id)} is what makes
 * granting idempotent: a replayed receipt — from a retry, a restore, or a
 * malicious replay — finds the existing row and grants nothing new.
 */
@Entity
@Table(name = "purchases")
@Getter
@Setter
@NoArgsConstructor
public class Purchase {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "product_code", nullable = false, length = 48)
    private String productCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 16)
    private StorePlatform platform;

    @Column(name = "store_product_id", nullable = false, length = 128)
    private String storeProductId;

    @Column(name = "transaction_id", nullable = false, length = 191)
    private String transactionId;

    @Column(name = "original_transaction_id", length = 191)
    private String originalTransactionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private PurchaseStatus status = PurchaseStatus.PENDING;

    @Column(name = "granted_at")
    private Instant grantedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    /** Retained for dispute handling and for re-verification after an outage. */
    @Column(name = "raw_receipt")
    private String rawReceipt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static Purchase create(
            UUID userId,
            String productCode,
            StorePlatform platform,
            String storeProductId,
            String transactionId,
            String originalTransactionId,
            String rawReceipt) {
        Purchase purchase = new Purchase();
        purchase.id = UUID.randomUUID();
        purchase.userId = userId;
        purchase.productCode = productCode;
        purchase.platform = platform;
        purchase.storeProductId = storeProductId;
        purchase.transactionId = transactionId;
        purchase.originalTransactionId = originalTransactionId;
        purchase.rawReceipt = rawReceipt;
        purchase.status = PurchaseStatus.PENDING;
        purchase.createdAt = Instant.now();
        return purchase;
    }

    public void markGranted() {
        this.status = PurchaseStatus.GRANTED;
        this.grantedAt = Instant.now();
    }

    public void markInvalid() {
        this.status = PurchaseStatus.INVALID;
    }

    public void markRevoked() {
        this.status = PurchaseStatus.REVOKED;
        this.revokedAt = Instant.now();
    }
}
