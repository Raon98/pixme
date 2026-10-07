package app.pixme.connection.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.connection.domain.Connection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConnectionRepository extends JpaRepository<Connection, UUID> {

    /** Pair lookup; callers pass the ids in canonical order. */
    Optional<Connection> findByUserAIdAndUserBId(UUID userAId, UUID userBId);

    @Query("""
            select c from Connection c
            where (c.userAId = :userId or c.userBId = :userId) and c.endedAt is null
            order by c.connectedAt desc
            """)
    List<Connection> findActiveFor(@Param("userId") UUID userId);

    @Query("""
            select case when c.userAId = :userId then c.userBId else c.userAId end
            from Connection c
            where (c.userAId = :userId or c.userBId = :userId) and c.endedAt is null
            """)
    List<UUID> findPeerIds(@Param("userId") UUID userId);

    @Query("""
            select c from Connection c
            where (c.userAId = :userId or c.userBId = :userId)
              and (c.userAId in :peerIds or c.userBId in :peerIds)
              and c.endedAt is null
            """)
    List<Connection> findBetween(
            @Param("userId") UUID userId, @Param("peerIds") Collection<UUID> peerIds);

    List<Connection> findByUserAIdOrUserBId(UUID userAId, UUID userBId);
}
