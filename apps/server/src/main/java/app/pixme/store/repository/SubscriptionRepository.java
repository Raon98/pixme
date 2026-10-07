package app.pixme.store.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.store.domain.StorePlatform;
import app.pixme.store.domain.Subscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {

    Optional<Subscription> findByPlatformAndOriginalTransactionId(
            StorePlatform platform, String originalTransactionId);

    @Query("""
            select s from Subscription s
            where s.userId = :userId
              and s.status in ('ACTIVE', 'GRACE_PERIOD')
              and s.currentPeriodEnd > :now
            order by s.currentPeriodEnd desc
            """)
    List<Subscription> findActive(@Param("userId") UUID userId, @Param("now") Instant now);

    /** Renewals whose monthly credit grant is still outstanding. */
    @Query("""
            select s from Subscription s
            where s.status in ('ACTIVE', 'GRACE_PERIOD')
              and s.currentPeriodEnd > :now
              and (s.lastGrantPeriodEnd is null or s.lastGrantPeriodEnd < s.currentPeriodEnd)
            """)
    List<Subscription> findPendingGrants(@Param("now") Instant now);

    /** Subscriptions whose period has lapsed and that need status reconciliation. */
    @Query("""
            select s from Subscription s
            where s.status in ('ACTIVE', 'GRACE_PERIOD') and s.currentPeriodEnd <= :now
            """)
    List<Subscription> findLapsed(@Param("now") Instant now);
}
