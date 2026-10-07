package app.pixme.notification.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A device push token.
 *
 * <p>Keyed by the token itself, so re-registering the same device simply
 * re-points it at the current user — which is what must happen when two people
 * share a phone, and what prevents one person's notifications from leaking to
 * another's session.
 */
@Entity
@Table(name = "push_tokens")
@Getter
@Setter
@NoArgsConstructor
public class PushToken {

    @Id
    @Column(name = "token", nullable = false, length = 255)
    private String token;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 16)
    private PushPlatform platform;

    @Column(name = "app_version", length = 24)
    private String appVersion;

    /** Set when the push service reports the token as dead. */
    @Column(name = "invalid_at")
    private Instant invalidAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static PushToken create(
            String token, UUID userId, PushPlatform platform, String appVersion) {
        PushToken pushToken = new PushToken();
        pushToken.token = token;
        pushToken.userId = userId;
        pushToken.platform = platform;
        pushToken.appVersion = appVersion;
        Instant now = Instant.now();
        pushToken.createdAt = now;
        pushToken.updatedAt = now;
        return pushToken;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public void reassign(UUID userId, String appVersion) {
        this.userId = userId;
        this.appVersion = appVersion;
        this.invalidAt = null;
    }

    public void markInvalid() {
        this.invalidAt = Instant.now();
    }
}
