package app.pixme.dailystatus.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import app.pixme.dailystatus.domain.DailyStatusTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DailyStatusTagRepository extends JpaRepository<DailyStatusTag, DailyStatusTag.Key> {

    @Query("select t.key.tag from DailyStatusTag t where t.key.dailyStatusId = :id order by t.key.tag")
    List<String> findTagsByDailyStatusId(@Param("id") UUID id);

    /** Batch lookup so rendering N feed cards is one query, not N. */
    @Query("select t.key.dailyStatusId, t.key.tag from DailyStatusTag t where t.key.dailyStatusId in :ids")
    List<Object[]> findTagsByDailyStatusIds(@Param("ids") Collection<UUID> ids);

    @Modifying
    @Query("delete from DailyStatusTag t where t.key.dailyStatusId = :id")
    void deleteByDailyStatusId(@Param("id") UUID id);
}
