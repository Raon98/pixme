package app.pixme.square.domain;

import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
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
 * Where one person stands in today's square.
 *
 * <p>Persisted rather than computed per request so the square is <em>stable</em>:
 * pulling to refresh must not teleport everyone to new spots. It also means
 * every client sees the same arrangement, which is what makes it feel like a
 * shared place rather than a randomised list.
 *
 * <p>Keyed by {@code (presenceDate, userId)} — one person, one spot per day —
 * rather than by a post, since standing in the square no longer requires
 * having generated anything today. What renders there is always the user's
 * live {@code UserCurrentPixel}, resolved at read time.
 */
@Entity
@Table(name = "square_placements")
@Getter
@NoArgsConstructor
public class SquarePlacement {

    @EmbeddedId
    private Key key;

    @Column(name = "x", nullable = false)
    private int x;

    @Column(name = "y", nullable = false)
    private int y;

    /** 0 = front row. Higher renders smaller and slightly faded. */
    @Column(name = "depth", nullable = false)
    private short depth;

    /** Phase offset for the idle bob, so the crowd doesn't breathe in unison. */
    @Column(name = "idle_variant", nullable = false)
    private short idleVariant;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public SquarePlacement(LocalDate presenceDate, UUID userId, int x, int y, short depth, short idleVariant) {
        this.key = new Key(presenceDate, userId);
        this.x = x;
        this.y = y;
        this.depth = depth;
        this.idleVariant = idleVariant;
        this.createdAt = Instant.now();
    }

    public UUID getUserId() {
        return key.getUserId();
    }

    public LocalDate getPresenceDate() {
        return key.getPresenceDate();
    }

    @Embeddable
    @Getter
    @NoArgsConstructor
    public static class Key implements Serializable {

        @Column(name = "presence_date", nullable = false)
        private LocalDate presenceDate;

        @Column(name = "user_id", nullable = false)
        private UUID userId;

        public Key(LocalDate presenceDate, UUID userId) {
            this.presenceDate = presenceDate;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Key key)) {
                return false;
            }
            return Objects.equals(presenceDate, key.presenceDate) && Objects.equals(userId, key.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(presenceDate, userId);
        }
    }
}
