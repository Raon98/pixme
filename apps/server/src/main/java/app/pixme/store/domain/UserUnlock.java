package app.pixme.store.domain;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;

/** A non-consumable the user owns: a style or a decoration. */
@Entity
@Table(name = "user_unlocks")
@Getter
@NoArgsConstructor
public class UserUnlock {

    @EmbeddedId
    private Key key;

    @Column(name = "kind", nullable = false, length = 24)
    private String kind;

    @Column(name = "source", nullable = false, length = 24)
    private String source = "PURCHASE";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UserUnlock(UUID userId, String unlockCode, String kind, String source) {
        this.key = new Key(userId, unlockCode);
        this.kind = kind;
        this.source = source;
        this.createdAt = Instant.now();
    }

    public String getUnlockCode() {
        return key.getUnlockCode();
    }

    @Embeddable
    @Getter
    @NoArgsConstructor
    public static class Key implements Serializable {

        @Column(name = "user_id", nullable = false)
        private UUID userId;

        @Column(name = "unlock_code", nullable = false, length = 48)
        private String unlockCode;

        public Key(UUID userId, String unlockCode) {
            this.userId = userId;
            this.unlockCode = unlockCode;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Key key)) {
                return false;
            }
            return Objects.equals(userId, key.userId)
                    && Objects.equals(unlockCode, key.unlockCode);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, unlockCode);
        }
    }
}
