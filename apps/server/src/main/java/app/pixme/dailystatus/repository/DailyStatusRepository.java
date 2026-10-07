package app.pixme.dailystatus.repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.dailystatus.domain.DailyStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DailyStatusRepository extends JpaRepository<DailyStatus, UUID> {

    Optional<DailyStatus> findByUserIdAndStatusDate(UUID userId, LocalDate statusDate);

    List<DailyStatus> findByUserIdInAndStatusDate(Collection<UUID> userIds, LocalDate statusDate);

    /**
     * Today Feed candidate pool for one viewer, newest-updated first.
     *
     * <p>Gating is deliberately just "a row exists for today" — having a
     * {@code DailyStatus} row, with or without mood/message/tags, is the whole
     * criterion. Whether a NEW character was generated today plays no part in
     * who is eligible; see {@code FeedRanker} for how it plays into ranking.
     */
    @Query("""
            select d from DailyStatus d
            where d.statusDate = :statusDate
              and d.userId <> :viewerId
              and (:excludedIsEmpty = true or d.userId not in :excludedUserIds)
              and (d.updatedAt < :cursorAt or (d.updatedAt = :cursorAt and d.id < :cursorId))
            order by d.updatedAt desc, d.id desc
            """)
    List<DailyStatus> findFeedCandidates(
            @Param("statusDate") LocalDate statusDate,
            @Param("viewerId") UUID viewerId,
            @Param("excludedUserIds") Collection<UUID> excludedUserIds,
            @Param("excludedIsEmpty") boolean excludedIsEmpty,
            @Param("cursorAt") Instant cursorAt,
            @Param("cursorId") UUID cursorId,
            Pageable pageable);

    /** Owner's own history, keyset-paginated by (date, id). */
    @Query("""
            select d from DailyStatus d
            where d.userId = :userId
              and (d.statusDate < :cursorDate or (d.statusDate = :cursorDate and d.id < :cursorId))
            order by d.statusDate desc, d.id desc
            """)
    List<DailyStatus> findHistory(
            @Param("userId") UUID userId,
            @Param("cursorDate") LocalDate cursorDate,
            @Param("cursorId") UUID cursorId,
            Pageable pageable);

    @Query("""
            select d from DailyStatus d
            where d.userId = :userId
              and (:excludedIsEmpty = true or d.userId not in :excludedUserIds)
              and (d.statusDate < :cursorDate or (d.statusDate = :cursorDate and d.id < :cursorId))
            order by d.statusDate desc, d.id desc
            """)
    List<DailyStatus> findPublicHistory(
            @Param("userId") UUID userId,
            @Param("excludedUserIds") Collection<UUID> excludedUserIds,
            @Param("excludedIsEmpty") boolean excludedIsEmpty,
            @Param("cursorDate") LocalDate cursorDate,
            @Param("cursorId") UUID cursorId,
            Pageable pageable);

    /**
     * Heart count maintained with an atomic UPDATE rather than read-modify-write
     * — concurrent hearts on a popular entry would otherwise lose increments.
     */
    @Modifying
    @Query("update DailyStatus d set d.heartCount = d.heartCount + :delta where d.id = :id")
    void adjustHeartCount(@Param("id") UUID id, @Param("delta") int delta);

    @Modifying
    @Query("update DailyStatus d set d.viewCount = d.viewCount + 1 where d.id in :ids")
    void incrementViewCounts(@Param("ids") Collection<UUID> ids);

    List<DailyStatus> findByIdIn(Collection<UUID> ids);

    List<DailyStatus> findByUserId(UUID userId);
}
