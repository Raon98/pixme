package app.pixme.connection.domain;

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
 * A "👋 친해지고 싶어요" from one person to another.
 *
 * <p>Directional and unique per ordered pair, so A→B and B→A are two rows. That
 * is deliberate: the mutual case is detected by looking for the opposite row,
 * and until it exists neither side learns anything about the other's intent.
 */
@Entity
@Table(name = "connection_requests")
@Getter
@Setter
@NoArgsConstructor
public class ConnectionRequest {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "from_user_id", nullable = false)
    private UUID fromUserId;

    @Column(name = "to_user_id", nullable = false)
    private UUID toUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ConnectionRequestStatus status = ConnectionRequestStatus.REQUESTED;

    /** The PIXME that prompted the wave, for "오늘의 PIXME를 계기로" context. */
    @Column(name = "source_post_id")
    private UUID sourcePostId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static ConnectionRequest create(UUID fromUserId, UUID toUserId, UUID sourcePostId) {
        ConnectionRequest request = new ConnectionRequest();
        request.id = UUID.randomUUID();
        request.fromUserId = fromUserId;
        request.toUserId = toUserId;
        request.sourcePostId = sourcePostId;
        request.status = ConnectionRequestStatus.REQUESTED;
        Instant now = Instant.now();
        request.createdAt = now;
        request.updatedAt = now;
        return request;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public boolean isPending() {
        return status == ConnectionRequestStatus.REQUESTED;
    }
}
