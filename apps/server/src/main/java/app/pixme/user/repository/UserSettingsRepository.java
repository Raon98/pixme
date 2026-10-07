package app.pixme.user.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import app.pixme.user.domain.UserSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserSettingsRepository extends JpaRepository<UserSettings, UUID> {

    List<UserSettings> findByUserIdIn(Collection<UUID> userIds);
}
