package app.pixme.reaction.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.reaction.domain.Reaction;
import app.pixme.reaction.domain.ReactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReactionRepository extends JpaRepository<Reaction, UUID> {

    Optional<Reaction> findByFromUserIdAndDailyStatusIdAndType(
            UUID fromUserId, UUID dailyStatusId, ReactionType type);

    boolean existsByFromUserIdAndDailyStatusIdAndType(
            UUID fromUserId, UUID dailyStatusId, ReactionType type);

    /**
     * Which of these DailyStatus entries the viewer has already hearted. One
     * query for a whole feed page, so rendering N cards doesn't cost N round
     * trips.
     */
    @Query("""
            select r.dailyStatusId from Reaction r
            where r.fromUserId = :viewerId and r.dailyStatusId in :dailyStatusIds
            """)
    List<UUID> findHeartedDailyStatusIds(
            @Param("viewerId") UUID viewerId, @Param("dailyStatusIds") Collection<UUID> dailyStatusIds);

    void deleteByFromUserIdAndDailyStatusIdAndType(
            UUID fromUserId, UUID dailyStatusId, ReactionType type);

    /**
     * Inserts a heart, doing nothing if one already exists.
     *
     * <p>Native {@code ON CONFLICT DO NOTHING} rather than "try the insert and
     * catch the violation": in Postgres a constraint violation aborts the whole
     * transaction, so catching the exception leaves every later statement
     * failing with "current transaction is aborted". This keeps the double-tap
     * case race-free <em>and</em> transaction-safe.
     *
     * @return 1 when a heart was created, 0 when one already existed
     */
    @Modifying
    @Query(
            value = """
                    insert into reactions (id, from_user_id, daily_status_id, type, created_at)
                    values (:id, :fromUserId, :dailyStatusId, 'HEART', now())
                    on conflict (from_user_id, daily_status_id, type) do nothing
                    """,
            nativeQuery = true)
    int insertHeartIfAbsent(
            @Param("id") UUID id,
            @Param("fromUserId") UUID fromUserId,
            @Param("dailyStatusId") UUID dailyStatusId);

    long countByDailyStatusId(UUID dailyStatusId);

    /** Everyone who hearted an entry, newest first — used for notification grouping. */
    @Query("""
            select r.fromUserId from Reaction r
            where r.dailyStatusId = :dailyStatusId
            order by r.createdAt desc
            """)
    List<UUID> findRecentReactorIds(@Param("dailyStatusId") UUID dailyStatusId);
}
