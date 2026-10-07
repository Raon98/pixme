package app.pixme.notification.domain;

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
import lombok.Setter;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
public class Notification {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private NotificationType type;

    @Column(name = "title", nullable = false, length = 120)
    private String title;

    @Column(name = "body", nullable = false, length = 255)
    private String body;

    @Column(name = "image_object_key", length = 512)
    private String imageObjectKey;

    @Column(name = "deep_link", length = 255)
    private String deepLink;

    /**
     * Collapse key, unique per user. Hearts on the same post share one, so ten
     * hearts become one updated "10명이 하트를 보냈어요" row instead of ten rows
     * and ten pushes.
     */
    @Column(name = "group_key", length = 120)
    private String groupKey;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static Notification create(
            UUID userId,
            NotificationType type,
            String title,
            String body,
            String imageObjectKey,
            String deepLink,
            String groupKey) {
        Notification notification = new Notification();
        notification.id = UUID.randomUUID();
        notification.userId = userId;
        notification.type = type;
        notification.title = title;
        notification.body = body;
        notification.imageObjectKey = imageObjectKey;
        notification.deepLink = deepLink;
        notification.groupKey = groupKey;
        notification.createdAt = Instant.now();
        return notification;
    }

    public void markRead() {
        if (this.readAt == null) {
            this.readAt = Instant.now();
        }
    }

    /** Re-surfaces a grouped notification with an updated message. */
    public void refresh(String title, String body) {
        this.title = title;
        this.body = body;
        this.readAt = null;
        this.createdAt = Instant.now();
    }
}
