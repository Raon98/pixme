package app.pixme.dailystatus.domain;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;

/** Tags as rows, so tag-based discovery is an index lookup, not a scan. */
@Entity
@Table(name = "daily_status_tags")
@Getter
@NoArgsConstructor
public class DailyStatusTag {

    @EmbeddedId
    private Key key;

    public DailyStatusTag(UUID dailyStatusId, String tag) {
        this.key = new Key(dailyStatusId, tag);
    }

    public UUID getDailyStatusId() {
        return key.getDailyStatusId();
    }

    public String getTag() {
        return key.getTag();
    }

    @Embeddable
    @Getter
    @NoArgsConstructor
    public static class Key implements Serializable {

        @Column(name = "daily_status_id", nullable = false)
        private UUID dailyStatusId;

        @Column(name = "tag", nullable = false, length = 12)
        private String tag;

        public Key(UUID dailyStatusId, String tag) {
            this.dailyStatusId = dailyStatusId;
            this.tag = tag;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Key key)) {
                return false;
            }
            return Objects.equals(dailyStatusId, key.dailyStatusId) && Objects.equals(tag, key.tag);
        }

        @Override
        public int hashCode() {
            return Objects.hash(dailyStatusId, tag);
        }
    }
}
