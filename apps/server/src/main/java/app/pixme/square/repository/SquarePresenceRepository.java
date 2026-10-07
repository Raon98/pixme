package app.pixme.square.repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.square.domain.SquarePresence;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SquarePresenceRepository extends JpaRepository<SquarePresence, SquarePresence.Key> {

    Optional<SquarePresence> findByKeyUserIdAndKeyPresenceDate(UUID userId, LocalDate presenceDate);

    @Query("""
            select p from SquarePresence p
            where p.key.presenceDate = :presenceDate
              and p.visible = true
              and (:excludedIsEmpty = true or p.key.userId not in :excludedUserIds)
            order by p.enteredAt asc
            """)
    List<SquarePresence> findOccupants(
            @Param("presenceDate") LocalDate presenceDate,
            @Param("excludedUserIds") Collection<UUID> excludedUserIds,
            @Param("excludedIsEmpty") boolean excludedIsEmpty,
            Pageable pageable);

    @Query("select p.key.userId from SquarePresence p where p.key.presenceDate = :presenceDate and p.visible = true")
    List<UUID> findVisibleUserIds(@Param("presenceDate") LocalDate presenceDate);

    @Modifying
    @Query("delete from SquarePresence p where p.key.presenceDate < :threshold")
    int deleteOlderThan(@Param("threshold") LocalDate threshold);

    /** "지금 활동 중" — presence rows touched within the active window. */
    @Query("""
            select p from SquarePresence p
            where p.key.presenceDate = :presenceDate
              and p.visible = true
              and p.lastActiveAt >= :activeSince
              and (:excludedIsEmpty = true or p.key.userId not in :excludedUserIds)
            order by p.lastActiveAt desc
            """)
    List<SquarePresence> findRecentlyActive(
            @Param("presenceDate") LocalDate presenceDate,
            @Param("activeSince") Instant activeSince,
            @Param("excludedUserIds") Collection<UUID> excludedUserIds,
            @Param("excludedIsEmpty") boolean excludedIsEmpty,
            Pageable pageable);
}
