package app.pixme.user.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import app.pixme.user.domain.UserInterest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserInterestRepository
        extends JpaRepository<UserInterest, UserInterest.Key> {

    @Query("select ui.key.interestCode from UserInterest ui where ui.key.userId = :userId")
    List<String> findCodesByUserId(@Param("userId") UUID userId);

    @Query("""
            select ui.key.userId, ui.key.interestCode from UserInterest ui
            where ui.key.userId in :userIds
            """)
    List<Object[]> findCodesByUserIds(@Param("userIds") Collection<UUID> userIds);

    @Modifying
    @Query("delete from UserInterest ui where ui.key.userId = :userId")
    void deleteAllByUserId(@Param("userId") UUID userId);

    /**
     * How many interests a candidate shares with the viewer. Feeds the
     * "interest overlap" term in feed ranking; done in SQL because the
     * alternative is loading every candidate's interests into memory.
     */
    @Query("""
            select ui.key.userId, count(ui)
            from UserInterest ui
            where ui.key.userId in :candidateIds
              and ui.key.interestCode in :interestCodes
            group by ui.key.userId
            """)
    List<Object[]> countSharedInterests(
            @Param("candidateIds") Collection<UUID> candidateIds,
            @Param("interestCodes") Collection<String> interestCodes);
}
