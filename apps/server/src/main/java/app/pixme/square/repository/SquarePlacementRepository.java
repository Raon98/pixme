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

public interface SquarePlacementRepository extends JpaRepository<SquarePlacement, SquarePlacement.Key> {

    List<SquarePlacement> findByKeyPresenceDateOrderByYAsc(LocalDate presenceDate);

    @Query("""
            select p from SquarePlacement p
            where p.key.presenceDate = :presenceDate and p.key.userId in :userIds
            """)
    List<SquarePlacement> findForUsers(
            @Param("presenceDate") LocalDate presenceDate, @Param("userIds") Collection<UUID> userIds);

    @Modifying
    @Query("delete from SquarePlacement p where p.key.presenceDate < :threshold")
    int deleteOlderThan(@Param("threshold") LocalDate threshold);
}
