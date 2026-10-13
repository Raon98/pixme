package app.pixme.store.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import app.pixme.store.domain.UserActiveDecoration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserActiveDecorationRepository
        extends JpaRepository<UserActiveDecoration, UserActiveDecoration.Key> {

    List<UserActiveDecoration> findByKeyUserId(UUID userId);

    /** Batched for the feed and square, which resolve many authors at once. */
    @Query("select d from UserActiveDecoration d where d.key.userId in :userIds")
    List<UserActiveDecoration> findByUserIds(@Param("userIds") Collection<UUID> userIds);
}
