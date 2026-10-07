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
            where e.key.viewerId = :viewerId and e.statusDate = :statusDate
            group by e.authorId
            """)
    List<Object[]> countByAuthorForDay(
            @Param("viewerId") UUID viewerId, @Param("statusDate") LocalDate statusDate);

    @Query("""
            select e.key.dailyStatusId from FeedExposure e
            where e.key.viewerId = :viewerId and e.statusDate = :statusDate
            """)
    List<UUID> findSeenDailyStatusIds(
            @Param("viewerId") UUID viewerId, @Param("statusDate") LocalDate statusDate);

    @Modifying
    @Query("delete from FeedExposure e where e.statusDate < :threshold")
    int deleteOlderThan(@Param("threshold") LocalDate threshold);
}
