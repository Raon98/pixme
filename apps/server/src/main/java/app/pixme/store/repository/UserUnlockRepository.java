package app.pixme.store.repository;

import java.util.List;
import java.util.UUID;

import app.pixme.store.domain.UserUnlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserUnlockRepository extends JpaRepository<UserUnlock, UserUnlock.Key> {

    @Query("select u.key.unlockCode from UserUnlock u where u.key.userId = :userId")
    List<String> findCodesByUserId(@Param("userId") UUID userId);

    @Query("""
            select u.key.unlockCode from UserUnlock u
            where u.key.userId = :userId and u.kind = :kind
            """)
    List<String> findCodesByUserIdAndKind(
            @Param("userId") UUID userId, @Param("kind") String kind);

    boolean existsByKey(UserUnlock.Key key);
}
