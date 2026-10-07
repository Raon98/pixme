package app.pixme.user.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.user.domain.UserProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserProfileRepository extends JpaRepository<UserProfile, UUID> {

    /** Case-insensitive, matching the unique index on {@code lower(nickname)}. */
    @Query("select p from UserProfile p where lower(p.nickname) = lower(:nickname)")
    Optional<UserProfile> findByNicknameIgnoreCase(@Param("nickname") String nickname);

    @Query("select count(p) > 0 from UserProfile p where lower(p.nickname) = lower(:nickname)")
    boolean existsByNicknameIgnoreCase(@Param("nickname") String nickname);

    List<UserProfile> findByUserIdIn(Collection<UUID> userIds);

    @Query("""
            select p from UserProfile p
            where lower(p.nickname) like lower(concat(:prefix, '%'))
            order by p.nickname asc
            """)
    List<UserProfile> searchByNicknamePrefix(@Param("prefix") String prefix);
}
