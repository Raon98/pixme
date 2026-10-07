package app.pixme.user.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Denormalised counters shown on nearly every screen.
 *
 * <p>Maintained in the same transaction as the event that changes them. Counts
 * here are display values, not accounting records — the authoritative history
 * is {@code reactions}, {@code connections} and {@code pixel_posts}, so a
 * reconciliation job can always rebuild this table.
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

    @Column(name = "pixel_count", nullable = false)
    private int pixelCount;

    /** Consecutive days with a published representative PIXME. */
    @Column(name = "streak_days", nullable = false)
    private int streakDays;

    @Column(name = "last_post_date")
    private LocalDate lastPostDate;

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

    /**
     * Records a published PIXME and maintains the streak.
     *
     * <p>Publishing twice on the same day must not extend the streak, and a
     * replaced representative post on the same day must not double-count — both
     * are handled by comparing against {@code lastPostDate}.
     */
    public void recordPost(LocalDate postDate) {
        if (lastPostDate != null && !postDate.isAfter(lastPostDate)) {
            return;
        }
        this.streakDays = (lastPostDate != null && postDate.minusDays(1).equals(lastPostDate))
                ? this.streakDays + 1
                : 1;
        this.lastPostDate = postDate;
        this.pixelCount += 1;
    }
}
