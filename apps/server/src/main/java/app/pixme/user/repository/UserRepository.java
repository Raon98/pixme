package app.pixme.user.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.user.domain.AuthProvider;
import app.pixme.user.domain.User;
import app.pixme.user.domain.UserStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByProviderAndProviderUserId(AuthProvider provider, String providerUserId);

    @Query("select u from User u where lower(u.email) = lower(:email) and u.deletedAt is null")
    Optional<User> findByEmailIgnoreCase(@Param("email") String email);

    @Query("select u from User u where u.id = :id and u.deletedAt is null")
    Optional<User> findActiveById(@Param("id") UUID id);

    /**
     * Touches the activity timestamp without loading the entity. Called on
     * nearly every authenticated request, so it must not trigger a full
     * entity load + dirty check.
     */
    @Modifying
    @Query("update User u set u.lastActiveAt = :now where u.id = :id")
    void markActive(@Param("id") UUID id, @Param("now") Instant now);

    @Query("""
            select u.id from User u
            where u.status = :status
              and u.lastActiveAt >= :since
            """)
    List<UUID> findActiveSince(
            @Param("status") UserStatus status, @Param("since") Instant since);

    /**
     * Recently joined accounts among a candidate set. One query, because the
     * feed ranker needs this for every candidate page and the alternative is a
     * per-author lookup.
     */
    @Query("""
            select u.id from User u
            where u.id in :userIds and u.createdAt >= :since
            """)
    List<UUID> findRecentlyJoinedAmong(
            @Param("userIds") Collection<UUID> userIds, @Param("since") Instant since);

    /** Accounts past the deletion grace period, ready for the hard purge. */
    @Query("select u from User u where u.deletedAt is not null and u.deletedAt < :threshold")
    List<User> findPurgeable(@Param("threshold") Instant threshold);
}
