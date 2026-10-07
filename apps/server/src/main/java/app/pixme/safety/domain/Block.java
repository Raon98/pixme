package app.pixme.safety.domain;

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

/**
 * A one-directional block record whose <em>effect</em> is symmetric: if either
 * side has blocked the other, neither sees the other anywhere. Storing it
 * directionally keeps "who blocked whom" auditable for moderation while the
 * query layer always checks both directions.
 */
@Entity
@Table(name = "blocks")
@Getter
@NoArgsConstructor
public class Block {

    @EmbeddedId
    private Key key;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Block(UUID blockerId, UUID blockedId) {
        this.key = new Key(blockerId, blockedId);
        this.createdAt = Instant.now();
    }

    public UUID getBlockerId() {
        return key.getBlockerId();
    }

    public UUID getBlockedId() {
        return key.getBlockedId();
    }

    @Embeddable
    @Getter
    @NoArgsConstructor
    public static class Key implements Serializable {

        @Column(name = "blocker_id", nullable = false)
        private UUID blockerId;

        @Column(name = "blocked_id", nullable = false)
        private UUID blockedId;

        public Key(UUID blockerId, UUID blockedId) {
            this.blockerId = blockerId;
            this.blockedId = blockedId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Key key)) {
                return false;
            }
            return Objects.equals(blockerId, key.blockerId)
                    && Objects.equals(blockedId, key.blockedId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(blockerId, blockedId);
        }
    }
}
