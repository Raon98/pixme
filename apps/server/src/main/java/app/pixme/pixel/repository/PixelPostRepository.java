package app.pixme.pixel.repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.pixel.domain.PixelPost;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PixelPostRepository extends JpaRepository<PixelPost, UUID> {

    @Query("select p from PixelPost p where p.id = :id and p.deletedAt is null")
    Optional<PixelPost> findAlive(@Param("id") UUID id);

    Optional<PixelPost> findByIdAndUserId(UUID id, UUID userId);

    /** Today's representative post for one user, if they have published. */
    @Query("""
            select p from PixelPost p
            where p.userId = :userId
              and p.postDate = :postDate
              and p.representative = true
              and p.deletedAt is null
            """)
    Optional<PixelPost> findRepresentative(
            @Param("userId") UUID userId, @Param("postDate") LocalDate postDate);

    /**
     * Feed candidate pool for one day, excluding the viewer, anyone blocked in
     * either direction, and authors the viewer has already seen enough of.
     *
     * <p>Ordered newest-first and over-fetched, because the ranker reorders and
     * filters in memory — the ordering here is just a deterministic window.
     */
    @Query("""
            select p from PixelPost p
            where p.postDate = :postDate
              and p.representative = true
              and p.visibility = 'PUBLIC'
              and p.deletedAt is null
              and p.userId <> :viewerId
              and (:excludedIsEmpty = true or p.userId not in :excludedUserIds)
              and (p.publishedAt < :cursorAt
                   or (p.publishedAt = :cursorAt and p.id < :cursorId))
            order by p.publishedAt desc, p.id desc
            """)
    List<PixelPost> findFeedCandidates(
            @Param("postDate") LocalDate postDate,
            @Param("viewerId") UUID viewerId,
            @Param("excludedUserIds") Collection<UUID> excludedUserIds,
            @Param("excludedIsEmpty") boolean excludedIsEmpty,
            @Param("cursorAt") Instant cursorAt,
            @Param("cursorId") UUID cursorId,
            Pageable pageable);

    /**
     * Everyone standing in today's square.
     *
     * <p>Newest first, which matters once more people publish in a day than fit
     * on the canvas: with oldest-first, the square would freeze into whoever
     * posted at breakfast and someone who just published would never see
     * themselves there — the opposite of what the space is for.
     */
    @Query("""
            select p from PixelPost p
            where p.postDate = :postDate
              and p.representative = true
              and p.visibility = 'PUBLIC'
              and p.deletedAt is null
              and (:excludedIsEmpty = true or p.userId not in :excludedUserIds)
            order by p.publishedAt desc
            """)
    List<PixelPost> findSquareOccupants(
            @Param("postDate") LocalDate postDate,
            @Param("excludedUserIds") Collection<UUID> excludedUserIds,
            @Param("excludedIsEmpty") boolean excludedIsEmpty,
            Pageable pageable);

    /** Owner's history, keyset-paginated by (postDate, id). */
    @Query("""
            select p from PixelPost p
            where p.userId = :userId
              and p.deletedAt is null
              and (p.postDate < :cursorDate
                   or (p.postDate = :cursorDate and p.id < :cursorId))
            order by p.postDate desc, p.id desc
            """)
    List<PixelPost> findHistory(
            @Param("userId") UUID userId,
            @Param("cursorDate") LocalDate cursorDate,
            @Param("cursorId") UUID cursorId,
            Pageable pageable);

    /** Another user's record: representative posts only, public only. */
    @Query("""
            select p from PixelPost p
            where p.userId = :userId
              and p.representative = true
              and p.visibility = 'PUBLIC'
              and p.deletedAt is null
              and (p.postDate < :cursorDate
                   or (p.postDate = :cursorDate and p.id < :cursorId))
            order by p.postDate desc, p.id desc
            """)
    List<PixelPost> findPublicHistory(
            @Param("userId") UUID userId,
            @Param("cursorDate") LocalDate cursorDate,
            @Param("cursorId") UUID cursorId,
            Pageable pageable);

    List<PixelPost> findByIdIn(Collection<UUID> ids);

    /**
     * Heart count maintained with an atomic UPDATE rather than read-modify-write.
     * Concurrent hearts on a popular post would otherwise lose increments.
     */
    @Modifying
    @Query("update PixelPost p set p.heartCount = p.heartCount + :delta where p.id = :postId")
    void adjustHeartCount(@Param("postId") UUID postId, @Param("delta") int delta);

    @Modifying
    @Query("update PixelPost p set p.viewCount = p.viewCount + 1 where p.id in :postIds")
    void incrementViewCounts(@Param("postIds") Collection<UUID> postIds);

    /** Candidates for the "many hearts today" rail, before diversity mixing. */
    @Query("""
            select p from PixelPost p
            where p.postDate = :postDate
              and p.representative = true
              and p.visibility = 'PUBLIC'
              and p.deletedAt is null
              and p.heartCount > 0
              and (:excludedIsEmpty = true or p.userId not in :excludedUserIds)
            order by p.heartCount desc
            """)
    List<PixelPost> findTopHearted(
            @Param("postDate") LocalDate postDate,
            @Param("excludedUserIds") Collection<UUID> excludedUserIds,
            @Param("excludedIsEmpty") boolean excludedIsEmpty,
            Pageable pageable);

    /** Just-arrived rail. */
    @Query("""
            select p from PixelPost p
            where p.postDate = :postDate
              and p.representative = true
              and p.visibility = 'PUBLIC'
              and p.deletedAt is null
              and (:excludedIsEmpty = true or p.userId not in :excludedUserIds)
            order by p.publishedAt desc
            """)
    List<PixelPost> findFreshest(
            @Param("postDate") LocalDate postDate,
            @Param("excludedUserIds") Collection<UUID> excludedUserIds,
            @Param("excludedIsEmpty") boolean excludedIsEmpty,
            Pageable pageable);

    /** Originals past the retention window, for the privacy purge job. */
    @Query("""
            select p from PixelPost p
            where p.originalObjectKey is not null and p.createdAt < :threshold
            """)
    List<PixelPost> findWithExpiredOriginals(@Param("threshold") Instant threshold);

    List<PixelPost> findByUserId(UUID userId);

    long countByUserIdAndDeletedAtIsNull(UUID userId);
}
