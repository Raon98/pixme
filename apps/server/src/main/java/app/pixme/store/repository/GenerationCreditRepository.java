package app.pixme.store.repository;

import java.util.Optional;
import java.util.UUID;

import app.pixme.store.domain.GenerationCredit;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GenerationCreditRepository extends JpaRepository<GenerationCredit, UUID> {

    /**
     * Row-level lock for the spend path.
     *
     * <p>Two concurrent generate requests must not both see "1 credit" and both
     * proceed. The lock is held for the few statements that debit and insert
     * the ledger entry, which is short enough not to matter and is the only
     * correct way to make the balance authoritative.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from GenerationCredit c where c.userId = :userId")
    Optional<GenerationCredit> findForUpdate(@Param("userId") UUID userId);
}
