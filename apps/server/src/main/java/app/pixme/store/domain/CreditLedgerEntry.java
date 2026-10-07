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

/**
 * Append-only credit history.
 *
 * <p>This is the audit trail behind "생성에 실패하면 생성권은 사용되지 않아요":
 * every debit and every refund is a row, so a user who believes they lost a
 * paid generation can be answered from data. A partial unique index on
 * {@code (reference_id, GENERATION_REFUND)} makes double-refunding impossible.
 */
@Entity
@Table(name = "credit_ledger")
@Getter
@NoArgsConstructor
public class CreditLedgerEntry {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "delta", nullable = false)
    private int delta;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false, length = 32)
    private CreditReason reason;

    @Column(name = "balance_after", nullable = false)
    private int balanceAfter;

    @Column(name = "reference_id")
    private UUID referenceId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static CreditLedgerEntry of(
            UUID userId, int delta, CreditReason reason, int balanceAfter, UUID referenceId) {
        CreditLedgerEntry entry = new CreditLedgerEntry();
        entry.id = UUID.randomUUID();
        entry.userId = userId;
        entry.delta = delta;
        entry.reason = reason;
        entry.balanceAfter = balanceAfter;
        entry.referenceId = referenceId;
        entry.createdAt = Instant.now();
        return entry;
    }
}
