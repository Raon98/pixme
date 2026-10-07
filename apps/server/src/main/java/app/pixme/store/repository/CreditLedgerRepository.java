package app.pixme.store.repository;

import java.util.List;
import java.util.UUID;

import app.pixme.store.domain.CreditLedgerEntry;
import app.pixme.store.domain.CreditReason;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CreditLedgerRepository extends JpaRepository<CreditLedgerEntry, UUID> {

    List<CreditLedgerEntry> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    /** Guards the refund path against double-crediting a failed generation. */
    boolean existsByReferenceIdAndReason(UUID referenceId, CreditReason reason);
}
