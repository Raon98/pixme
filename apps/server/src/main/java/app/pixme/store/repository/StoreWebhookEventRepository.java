package app.pixme.store.repository;

import java.util.UUID;

import app.pixme.store.domain.StorePlatform;
import app.pixme.store.domain.StoreWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoreWebhookEventRepository extends JpaRepository<StoreWebhookEvent, UUID> {

    boolean existsByPlatformAndNotificationId(StorePlatform platform, String notificationId);
}
