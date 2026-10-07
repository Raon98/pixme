package app.pixme.notification.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import app.pixme.notification.domain.PushToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PushTokenRepository extends JpaRepository<PushToken, String> {

    @Query("select t from PushToken t where t.userId = :userId and t.invalidAt is null")
    List<PushToken> findActiveByUserId(@Param("userId") UUID userId);

    @Query("""
            select t from PushToken t
            where t.userId in :userIds and t.invalidAt is null
            """)
    List<PushToken> findActiveByUserIds(@Param("userIds") Collection<UUID> userIds);

    @Modifying
    @Query("delete from PushToken t where t.userId = :userId")
    void deleteByUserId(@Param("userId") UUID userId);
}
