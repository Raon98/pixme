package app.pixme.store.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A raw store webhook delivery, kept for replay/debugging.
 *
 * <p>The unique index on {@code (platform, notificationId)} is the dedup key:
 * both Apple and Google re-send a notification until the endpoint returns a
 * 200, so the same event can — and will — arrive more than once. Recording it
 * here first and checking for an existing row is what makes handling a
 * notification safe to repeat.
 */
@Entity
@Table(name = "store_webhook_events")
@Getter
@NoArgsConstructor
public class StoreWebhookEvent {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 16)
    private StorePlatform platform;

    @Column(name = "notification_id", nullable = false, length = 191)
    private String notificationId;

    @Column(name = "notification_type", nullable = false, length = 64)
    private String notificationType;

    @Column(name = "payload")
    private String payload;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt = Instant.now();

    public static StoreWebhookEvent create(
            StorePlatform platform, String notificationId, String notificationType, String payload) {
        StoreWebhookEvent event = new StoreWebhookEvent();
        event.id = UUID.randomUUID();
        event.platform = platform;
        event.notificationId = notificationId;
        event.notificationType = notificationType;
        event.payload = payload;
        event.receivedAt = Instant.now();
        return event;
    }
}
