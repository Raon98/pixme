package app.pixme.safety.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import app.pixme.safety.domain.Block;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BlockRepository extends JpaRepository<Block, Block.Key> {

    /**
     * Every user id that must be hidden from {@code userId}: people they
     * blocked and people who blocked them. One query, because this set is
     * needed by the feed, the square, profiles, chat and recommendations, and
     * is small enough to hold in memory per request.
     */
    @Query(
            value = """
                    select blocked_id from blocks where blocker_id = :userId
                    union
                    select blocker_id from blocks where blocked_id = :userId
                    """,
            nativeQuery = true)
    List<UUID> findAllRelatedUserIds(@Param("userId") UUID userId);

    @Query("""
            select count(b) > 0 from Block b
            where (b.key.blockerId = :a and b.key.blockedId = :b)
               or (b.key.blockerId = :b and b.key.blockedId = :a)
            """)
    boolean existsBetween(@Param("a") UUID a, @Param("b") UUID b);

    @Query("""
            select b from Block b
            where b.key.blockerId = :blockerId
            order by b.createdAt desc
            """)
    List<Block> findByBlockerId(@Param("blockerId") UUID blockerId);

    @Query("""
            select b.key.blockedId from Block b
            where b.key.blockerId = :userId and b.key.blockedId in :candidateIds
            """)
    List<UUID> findBlockedAmong(
            @Param("userId") UUID userId, @Param("candidateIds") Collection<UUID> candidateIds);

    @org.springframework.data.jpa.repository.Modifying
    @Query("delete from Block b where b.key.blockerId = :blockerId and b.key.blockedId = :blockedId")
    void deleteByPair(@Param("blockerId") UUID blockerId, @Param("blockedId") UUID blockedId);
}
