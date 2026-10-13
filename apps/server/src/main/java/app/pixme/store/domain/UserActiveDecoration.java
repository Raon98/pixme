package app.pixme.store.domain;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * The decoration a user has chosen for one slot.
 *
 * <p>Holds the choice only, never the right to use it. Access is re-checked
 * on every read against (owned outright) OR (PIXME+ active), so a lapsed
 * subscription stops rendering the item without anything having to delete
 * these rows — and re-subscribing brings the old choice straight back.
 */
@Entity
@Table(name = "user_active_decorations")
@Getter
@NoArgsConstructor
public class UserActiveDecoration {

    @EmbeddedId
    private Key key;

    @Column(name = "unlock_code", nullable = false, length = 48)
    private String unlockCode;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UserActiveDecoration(UUID userId, DecorationSlot slot, String unlockCode) {
        this.key = new Key(userId, slot);
        this.unlockCode = unlockCode;
        this.updatedAt = Instant.now();
    }

    public DecorationSlot getSlot() {
        return key.getSlot();
    }

    public void reassign(String code) {
        this.unlockCode = code;
        this.updatedAt = Instant.now();
    }

    @Embeddable
    @Getter
    @NoArgsConstructor
    public static class Key implements Serializable {

        @Column(name = "user_id", nullable = false)
        private UUID userId;

        @Enumerated(EnumType.STRING)
        @Column(name = "slot", nullable = false, length = 24)
        private DecorationSlot slot;

        public Key(UUID userId, DecorationSlot slot) {
            this.userId = userId;
            this.slot = slot;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Key key)) {
                return false;
            }
            return Objects.equals(userId, key.userId) && slot == key.slot;
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, slot);
        }
    }
}
