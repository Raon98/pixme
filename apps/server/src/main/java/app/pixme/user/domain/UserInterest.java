package app.pixme.user.domain;

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
import lombok.Setter;

@Entity
@Table(name = "user_interests")
@Getter
@Setter
@NoArgsConstructor
public class UserInterest {

    @EmbeddedId
    private Key key;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UserInterest(UUID userId, String interestCode) {
        this.key = new Key(userId, interestCode);
        this.createdAt = Instant.now();
    }

    public UUID getUserId() {
        return key.getUserId();
    }

    public String getInterestCode() {
        return key.getInterestCode();
    }

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    public static class Key implements Serializable {

        @Column(name = "user_id", nullable = false)
        private UUID userId;

        @Column(name = "interest_code", nullable = false, length = 32)
        private String interestCode;

        public Key(UUID userId, String interestCode) {
            this.userId = userId;
            this.interestCode = interestCode;
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
                    && Objects.equals(interestCode, key.interestCode);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, interestCode);
        }
    }
}
