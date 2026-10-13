package app.pixme.user.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * "When this email signs up, give them X" — recorded before the person has
 * ever signed in, applied the moment they do. See {@code ReservedSignupService}.
 *
 * <p>{@code email} is the primary key, matched case-insensitively (OAuth
 * providers don't guarantee casing). {@code appliedAt} makes applying this
 * idempotent: a retried or re-triggered sign-up never double-grants.
 */
@Entity
@Table(name = "reserved_signup_assignments")
@Getter
@NoArgsConstructor
public class ReservedSignupAssignment {

    @Id
    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "character_asset_key", length = 64)
    private String characterAssetKey;

    @Column(name = "grant_plus_forever", nullable = false)
    private boolean grantPlusForever;

    @Column(name = "applied_at")
    private Instant appliedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public boolean isApplied() {
        return appliedAt != null;
    }

    public void markApplied() {
        this.appliedAt = Instant.now();
    }
}
