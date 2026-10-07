package app.pixme.square.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import app.pixme.square.domain.SquarePlacement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SquarePlacementRepository
        extends JpaRepository<SquarePlacement, SquarePlacement.Key> {

    List<SquarePlacement> findByKeyPostDateOrderByYAsc(LocalDate postDate);

    @Query("""
            select p from SquarePlacement p
            where p.key.postDate = :postDate and p.key.postId in :postIds
            """)
    List<SquarePlacement> findForPosts(
            @Param("postDate") LocalDate postDate, @Param("postIds") Collection<UUID> postIds);

    @Query("select p.userId from SquarePlacement p where p.key.postDate = :postDate")
    List<UUID> findPlacedUserIds(@Param("postDate") LocalDate postDate);

    @Modifying
    @Query("delete from SquarePlacement p where p.key.postDate < :threshold")
    int deleteOlderThan(@Param("threshold") LocalDate threshold);

    /** Replacing today's representative post must move the placement with it. */
    @Modifying
    @Query("delete from SquarePlacement p where p.key.postDate = :postDate and p.userId = :userId")
    void deleteForUserOnDate(
            @Param("postDate") LocalDate postDate, @Param("userId") UUID userId);
}
