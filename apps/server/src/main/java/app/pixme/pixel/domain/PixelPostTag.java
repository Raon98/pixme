package app.pixme.pixel.domain;

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

/**
 * Tags as rows rather than an array column, so tag-based discovery
 * ("#꾸안꾸 today") is an index lookup instead of a scan.
 */
@Entity
@Table(name = "pixel_post_tags")
@Getter
@NoArgsConstructor
public class PixelPostTag {

    @EmbeddedId
    private Key key;

    public PixelPostTag(UUID postId, String tag) {
        this.key = new Key(postId, tag);
    }

    public UUID getPostId() {
        return key.getPostId();
    }

    public String getTag() {
        return key.getTag();
    }

    @Embeddable
    @Getter
    @NoArgsConstructor
    public static class Key implements Serializable {

        @Column(name = "post_id", nullable = false)
        private UUID postId;

        @Column(name = "tag", nullable = false, length = 12)
        private String tag;

        public Key(UUID postId, String tag) {
            this.postId = postId;
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
            return Objects.equals(postId, key.postId) && Objects.equals(tag, key.tag);
        }

        @Override
        public int hashCode() {
            return Objects.hash(postId, tag);
        }
    }
}
