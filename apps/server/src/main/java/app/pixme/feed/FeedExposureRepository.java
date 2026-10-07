package app.pixme.feed;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FeedExposureRepository extends JpaRepository<FeedExposure, FeedExposure.Key> {

    /** How many times each author has already been shown to this viewer today. */
    @Query("""
            select e.authorId, count(e) from FeedExposure e
            where e.key.viewerId = :viewerId and e.postDate = :postDate
            group by e.authorId
            """)
    List<Object[]> countByAuthorForDay(
            @Param("viewerId") UUID viewerId, @Param("postDate") LocalDate postDate);

    @Query("""
            select e.key.postId from FeedExposure e
            where e.key.viewerId = :viewerId and e.postDate = :postDate
            """)
    List<UUID> findSeenPostIds(
            @Param("viewerId") UUID viewerId, @Param("postDate") LocalDate postDate);

    @Modifying
    @Query("delete from FeedExposure e where e.postDate < :threshold")
    int deleteOlderThan(@Param("threshold") LocalDate threshold);
}
