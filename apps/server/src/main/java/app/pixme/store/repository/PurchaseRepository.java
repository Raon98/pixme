package app.pixme.store.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.store.domain.Purchase;
import app.pixme.store.domain.PurchaseStatus;
import app.pixme.store.domain.StorePlatform;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseRepository extends JpaRepository<Purchase, UUID> {

    Optional<Purchase> findByPlatformAndTransactionId(
            StorePlatform platform, String transactionId);

    List<Purchase> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<Purchase> findByUserIdAndStatus(UUID userId, PurchaseStatus status);
}
