package app.pixme.connection.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.connection.domain.ConnectionRequest;
import app.pixme.connection.domain.ConnectionRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConnectionRequestRepository extends JpaRepository<ConnectionRequest, UUID> {

    Optional<ConnectionRequest> findByFromUserIdAndToUserId(UUID fromUserId, UUID toUserId);

    @Query("""
            select r from ConnectionRequest r
            where r.toUserId = :userId and r.status = :status
            order by r.createdAt desc
            """)
    List<ConnectionRequest> findIncoming(
            @Param("userId") UUID userId, @Param("status") ConnectionRequestStatus status);

    @Query("""
            select r.toUserId from ConnectionRequest r
            where r.fromUserId = :userId and r.status = 'REQUESTED'
            """)
    List<UUID> findOutgoingPendingTargets(@Param("userId") UUID userId);

    List<ConnectionRequest> findByFromUserIdOrToUserId(UUID fromUserId, UUID toUserId);
}
