package app.pixme.connection.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.connection.domain.ConnectionRequest;
import app.pixme.connection.domain.ConnectionRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    /**
     * How many waves this user has sent since {@code since} — the daily quota
     * check. Counts every row {@code createdAt} in the window regardless of
     * current status: a wave that was later cancelled, or that completed a
     * mutual match, still used up that day's allowance at the moment it was
     * sent.
     */
    long countByFromUserIdAndCreatedAtAfter(UUID fromUserId, Instant since);

    /**
     * Who this user has waved at today, regardless of outcome.
     *
     * <p>Feeds the feed/square exclusion that keeps a just-waved-at card off
     * the sender's screen for the rest of today — distinct from
     * {@link #findOutgoingPendingTargets}, which never expires and is used
     * for the client's relation-status lookup, not for this feed filter. A
     * wave that didn't lead to a match is meant to be forgettable, not a
     * permanent block: a different character tomorrow can still land.
     */
    @Query("""
            select r.toUserId from ConnectionRequest r
            where r.fromUserId = :userId and r.createdAt >= :since
            """)
    List<UUID> findTargetsWavedSince(@Param("userId") UUID userId, @Param("since") Instant since);

    /**
     * Gives up on waves nobody ever answered, so an unmatched wave from weeks
     * ago doesn't keep boosting its sender's card in the recipient's feed
     * forever (see {@code FeedRanker.Context#wavedAtMeUserIds}). Purely
     * hygiene — the sender already spent that day's quota when they sent it,
     * and this changes nothing about that.
     *
     * @return how many were cancelled, for the job's log line
     */
    @Modifying
    @Query("""
            update ConnectionRequest r set r.status = app.pixme.connection.domain.ConnectionRequestStatus.CANCELLED
            where r.status = app.pixme.connection.domain.ConnectionRequestStatus.REQUESTED
              and r.createdAt < :before
            """)
    int cancelStaleRequests(@Param("before") Instant before);
}
