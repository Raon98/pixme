package app.pixme.user.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import app.pixme.user.domain.UserStats;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserStatsRepository extends JpaRepository<UserStats, UUID> {

    List<UserStats> findByUserIdIn(Collection<UUID> userIds);
}
