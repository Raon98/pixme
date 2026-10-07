package app.pixme.user.domain;

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

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 16)
    private AuthProvider provider;

    @Column(name = "provider_user_id", nullable = false, length = 191)
    private String providerUserId;

    @Column(name = "email", length = 255)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private UserStatus status = UserStatus.PENDING_PROFILE;

    @Column(name = "last_active_at")
    private Instant lastActiveAt;

    @Column(name = "suspended_until")
    private Instant suspendedUntil;

    @Column(name = "suspension_reason", length = 255)
    private String suspensionReason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public static User create(AuthProvider provider, String providerUserId, String email) {
        User user = new User();
        user.id = UUID.randomUUID();
        user.provider = provider;
        user.providerUserId = providerUserId;
        user.email = email;
        user.status = UserStatus.PENDING_PROFILE;
        Instant now = Instant.now();
        user.createdAt = now;
        user.updatedAt = now;
        return user;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public boolean isActive() {
        return status == UserStatus.ACTIVE && deletedAt == null;
    }

    /** A suspension can be time-boxed; this reflects whether it is still in force. */
    public boolean isSuspended(Instant now) {
        if (status != UserStatus.SUSPENDED) {
            return false;
        }
        return suspendedUntil == null || suspendedUntil.isAfter(now);
    }

    public boolean isDeleted() {
        return status == UserStatus.DELETED || deletedAt != null;
    }
}
