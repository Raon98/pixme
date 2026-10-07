package app.pixme.user.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Denormalised counters shown on nearly every screen.
 *
 * <p>Maintained in the same transaction as the event that changes them. Counts
 * here are display values, not accounting records — the authoritative history
 * is {@code reactions}, {@code connections}, {@code daily_status} and
 * {@code pixel_characters}, so a reconciliation job can always rebuild this
 * table.
 *
 * <p>{@code pixelCount} and the streak measure two deliberately different
 * things: the Collection's size (how many characters the user has ever kept —
 * tied to paid generation) versus daily engagement (free, and the thing a
 * streak should reward so it never pressures anyone to pay to keep a streak
 * alive).
 */
@Entity
@Table(name = "user_stats")
@Getter
@Setter
@NoArgsConstructor
public class UserStats {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "received_heart_count", nullable = false)
    private int receivedHeartCount;

    @Column(name = "connection_count", nullable = false)
    private int connectionCount;

    /** Size of the PixelCharacter Collection. */
    @Column(name = "pixel_count", nullable = false)
    private int pixelCount;

    /** Consecutive days with a {@code DailyStatus} row — free daily engagement. */
    @Column(name = "streak_days", nullable = false)
    private int streakDays;

    @Column(name = "last_status_date")
    private LocalDate lastStatusDate;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static UserStats createFor(UUID userId) {
        UserStats stats = new UserStats();
        stats.userId = userId;
        stats.updatedAt = Instant.now();
        return stats;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public void addHearts(int delta) {
        this.receivedHeartCount = Math.max(0, this.receivedHeartCount + delta);
    }

    public void addConnections(int delta) {
        this.connectionCount = Math.max(0, this.connectionCount + delta);
    }

    /** A new PixelCharacter was kept — always paid, never day-gated. */
    public void incrementPixelCount() {
        this.pixelCount += 1;
    }

    /**
     * Records today's free activity and maintains the streak.
     *
     * <p>Touching status twice in the same day must not double-count, and a
     * gap of more than one day resets the streak rather than continuing it.
     */
    public void recordStatus(LocalDate statusDate) {
        if (lastStatusDate != null && !statusDate.isAfter(lastStatusDate)) {
            return;
        }
        this.streakDays = (lastStatusDate != null && statusDate.minusDays(1).equals(lastStatusDate))
                ? this.streakDays + 1
                : 1;
        this.lastStatusDate = statusDate;
    }
}
