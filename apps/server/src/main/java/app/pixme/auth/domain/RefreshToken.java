package app.pixme.auth.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A refresh token, stored as a SHA-256 hash.
 *
 * <p>Two properties worth stating plainly:
 * <ul>
 *   <li>The raw token is never persisted, so a database dump cannot be used to
 *       impersonate anyone.
 *   <li>Tokens <b>rotate</b> on every use and the old row records what it was
 *       exchanged for ({@code rotatedTo}). Presenting an already-rotated token
 *       therefore means someone is replaying a stolen one — which is detectable
 *       and triggers a full session revocation rather than a silent refresh.
 * </ul>
 */
@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor
public class RefreshToken {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "rotated_to")
    private UUID rotatedTo;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static RefreshToken issue(UUID userId, String tokenHash, Instant expiresAt) {
        RefreshToken token = new RefreshToken();
        token.id = UUID.randomUUID();
        token.userId = userId;
        token.tokenHash = tokenHash;
        token.expiresAt = expiresAt;
        token.createdAt = Instant.now();
        return token;
    }

    public boolean isUsable(Instant now) {
        return revokedAt == null && rotatedTo == null && expiresAt.isAfter(now);
    }

    /** True when this token has already been exchanged — i.e. a replay. */
    public boolean isReplayed() {
        return rotatedTo != null;
    }

    public void revoke() {
        if (this.revokedAt == null) {
            this.revokedAt = Instant.now();
        }
    }

    public void rotateTo(UUID successorId) {
        this.rotatedTo = successorId;
        this.revokedAt = Instant.now();
    }
}
