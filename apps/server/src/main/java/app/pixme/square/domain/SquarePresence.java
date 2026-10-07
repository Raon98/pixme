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
import lombok.Setter;

/**
 * Whether a user is standing in today's square.
 *
 * <p>Not a live position and not a game session — see {@code PRODUCT.md} §
 * "광장과 수익화의 관계" and the original product brief: no realtime
 * coordinates, no movement, no collision. A row here just means "this user was
 * active today while {@code user_settings.square_visible} was on", which is
 * enough to drive the "🟢 지금 있어요 / ✨ 방금 도착했어요" copy from
 * {@code enteredAt} / {@code lastActiveAt} alone.
 *
 * <p>Created lazily, from two triggers only — opening the Square tab oneself,
 * or touching {@code DailyStatus} — both gated on {@code square_visible} so a
 * user is never surfaced without having opted in. See
 * {@code SquareService#recordPresenceIfVisible}.
 */
@Entity
@Table(name = "square_presence")
@Getter
@Setter
@NoArgsConstructor
public class SquarePresence {

    @EmbeddedId
    private Key key;

    @Column(name = "entered_at", nullable = false)
    private Instant enteredAt = Instant.now();

    @Column(name = "last_active_at", nullable = false)
    private Instant lastActiveAt = Instant.now();

    /** A per-day override — hide today without changing the persistent setting. */
    @Column(name = "visible", nullable = false)
    private boolean visible = true;

    public SquarePresence(UUID userId, LocalDate presenceDate) {
        this.key = new Key(userId, presenceDate);
        Instant now = Instant.now();
        this.enteredAt = now;
        this.lastActiveAt = now;
    }

    public UUID getUserId() {
        return key.getUserId();
    }

    public LocalDate getPresenceDate() {
        return key.getPresenceDate();
    }

    public void touch() {
        this.lastActiveAt = Instant.now();
    }

    @Embeddable
    @Getter
    @NoArgsConstructor
    public static class Key implements Serializable {

        @Column(name = "user_id", nullable = false)
        private UUID userId;

        @Column(name = "presence_date", nullable = false)
        private LocalDate presenceDate;

        public Key(UUID userId, LocalDate presenceDate) {
            this.userId = userId;
            this.presenceDate = presenceDate;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Key key)) {
                return false;
            }
            return Objects.equals(userId, key.userId) && Objects.equals(presenceDate, key.presenceDate);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, presenceDate);
        }
    }
}
