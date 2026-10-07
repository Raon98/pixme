package app.pixme.store.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * PIXME+ state, keyed by the store's original transaction id so renewals,
 * cancellations and re-subscriptions all land on the same row.
 */
@Entity
@Table(name = "subscriptions")
@Getter
@Setter
@NoArgsConstructor
public class Subscription {

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

    @Column(name = "original_transaction_id", nullable = false, length = 191)
    private String originalTransactionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private SubscriptionStatus status;

    @Column(name = "current_period_end", nullable = false)
    private Instant currentPeriodEnd;

    @Column(name = "auto_renewing", nullable = false)
    private boolean autoRenewing = true;

    /**
     * The period whose monthly credit grant has already been paid out. Compared
     * against {@code currentPeriodEnd} so a renewal grants exactly once, even
     * if the store notifies us several times.
     */
    @Column(name = "last_grant_period_end")
    private Instant lastGrantPeriodEnd;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static Subscription create(
            UUID userId,
            String productCode,
            StorePlatform platform,
            String originalTransactionId,
            SubscriptionStatus status,
            Instant currentPeriodEnd) {
        Subscription subscription = new Subscription();
        subscription.id = UUID.randomUUID();
        subscription.userId = userId;
        subscription.productCode = productCode;
        subscription.platform = platform;
        subscription.originalTransactionId = originalTransactionId;
        subscription.status = status;
        subscription.currentPeriodEnd = currentPeriodEnd;
        Instant now = Instant.now();
        subscription.createdAt = now;
        subscription.updatedAt = now;
        return subscription;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public boolean isActiveAt(Instant moment) {
        return status.grantsAccess() && currentPeriodEnd.isAfter(moment);
    }

    /** True when this period's credit grant has not been paid out yet. */
    public boolean needsGrant() {
        return lastGrantPeriodEnd == null || lastGrantPeriodEnd.isBefore(currentPeriodEnd);
    }
}
