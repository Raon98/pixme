package app.pixme.feed;

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
 * Record that a viewer was shown a specific {@code DailyStatus} card.
 *
 * <p>This is what makes "don't show me the same person over and over" and
 * "don't show me the same card twice today" enforceable per viewer rather than
 * globally. It is append-only and pruned by day.
 */
@Entity
@Table(name = "feed_exposures")
@Getter
@NoArgsConstructor
public class FeedExposure {

    @EmbeddedId
    private Key key;

    @Column(name = "author_id", nullable = false)
    private UUID authorId;

    @Column(name = "status_date", nullable = false)
    private LocalDate statusDate;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public FeedExposure(UUID viewerId, UUID dailyStatusId, UUID authorId, LocalDate statusDate) {
        this.key = new Key(viewerId, dailyStatusId);
        this.authorId = authorId;
        this.statusDate = statusDate;
        this.createdAt = Instant.now();
    }

    @Embeddable
    @Getter
    @NoArgsConstructor
    public static class Key implements Serializable {

        @Column(name = "viewer_id", nullable = false)
        private UUID viewerId;

        @Column(name = "daily_status_id", nullable = false)
        private UUID dailyStatusId;

        public Key(UUID viewerId, UUID dailyStatusId) {
            this.viewerId = viewerId;
            this.dailyStatusId = dailyStatusId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Key key)) {
                return false;
            }
            return Objects.equals(viewerId, key.viewerId) && Objects.equals(dailyStatusId, key.dailyStatusId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(viewerId, dailyStatusId);
        }
    }
}
