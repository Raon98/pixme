package app.pixme.notification.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.notification.domain.Notification;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Optional<Notification> findByUserIdAndGroupKey(UUID userId, String groupKey);

    @Query("""
            select n from Notification n
            where n.userId = :userId
              and (n.createdAt < :cursorCreatedAt
                   or (n.createdAt = :cursorCreatedAt and n.id < :cursorId))
            order by n.createdAt desc, n.id desc
            """)
    List<Notification> findPage(
            @Param("userId") UUID userId,
            @Param("cursorCreatedAt") Instant cursorCreatedAt,
            @Param("cursorId") UUID cursorId,
            Pageable pageable);

    long countByUserIdAndReadAtIsNull(UUID userId);

    @Modifying
    @Query("""
            update Notification n set n.readAt = :now
            where n.userId = :userId and n.readAt is null
            """)
    int markAllRead(@Param("userId") UUID userId, @Param("now") Instant now);

    @Modifying
    @Query("delete from Notification n where n.createdAt < :threshold")
    int deleteOlderThan(@Param("threshold") Instant threshold);
}
