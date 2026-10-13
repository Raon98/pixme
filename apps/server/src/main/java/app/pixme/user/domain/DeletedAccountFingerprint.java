package app.pixme.user.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A one-way marker that a social identity has signed up before and had its
 * account hard-deleted — see {@link app.pixme.job.AccountPurgeJob}.
 *
 * <p>Deliberately outlives the account it came from. It carries no personal
 * data (not even the provider's user id, only a hash of it), so keeping it
 * after a "delete my data" request does not re-identify anyone; its only job
 * is stopping the same identity from re-granting itself onboarding free
 * generations by deleting and re-signing up.
 */
@Entity
@Table(name = "deleted_account_fingerprints")
@Getter
@NoArgsConstructor
public class DeletedAccountFingerprint {

    @Id
    @Column(name = "identity_hash", nullable = false)
    private String identityHash;

    @Column(name = "provider", nullable = false)
    private String provider;

    @Column(name = "purged_at", nullable = false)
    private Instant purgedAt;

    public static DeletedAccountFingerprint of(String identityHash, String provider) {
        DeletedAccountFingerprint fingerprint = new DeletedAccountFingerprint();
        fingerprint.identityHash = identityHash;
        fingerprint.provider = provider;
        fingerprint.purgedAt = Instant.now();
        return fingerprint;
    }
}
