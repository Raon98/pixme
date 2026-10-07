package app.pixme.pixel.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import app.pixme.ai.PixelStyle;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A published PIXME — one person's "today".
 *
 * <p>The product's central constraint is that each user has at most one
 * <em>representative</em> post per calendar day; that is enforced by a partial
 * unique index in the database rather than by application discipline alone,
 * because it is what keeps the feed and the square one-card-per-person.
 * Replaced posts stay in the owner's history with
 * {@code isRepresentative = false}.
 */
@Entity
@Table(name = "pixel_posts")
@Getter
@Setter
@NoArgsConstructor
public class PixelPost {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "generation_id", nullable = false)
    private UUID generationId;

    @Column(name = "character_object_key", nullable = false, length = 512)
    private String characterObjectKey;

    /**
     * Null once the original is gone — either because the user opted out of
     * retention, deleted it explicitly, or the retention window elapsed. The
     * character and the record are unaffected.
     */
    @Column(name = "original_object_key", length = 512)
    private String originalObjectKey;

    @Column(name = "caption", length = 60)
    private String caption;

    @Column(name = "mood", length = 16)
    private String mood;

    @Enumerated(EnumType.STRING)
    @Column(name = "style", nullable = false, length = 32)
    private PixelStyle style = PixelStyle.PIXME_BASIC;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", nullable = false, length = 16)
    private PixelVisibility visibility = PixelVisibility.PUBLIC;

    @Column(name = "heart_count", nullable = false)
    private int heartCount;

    /**
     * Impressions. Ranking uses hearts <em>per view</em> rather than raw hearts,
     * which is what prevents already-popular accounts from permanently owning
     * the curation rails.
     */
    @Column(name = "view_count", nullable = false)
    private int viewCount;

    @Column(name = "post_date", nullable = false)
    private LocalDate postDate;

    @Column(name = "is_representative", nullable = false)
    private boolean representative;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public static PixelPost publish(
            UUID userId,
            PixelGeneration generation,
            String caption,
            String mood,
            LocalDate postDate,
            boolean keepOriginal) {
        PixelPost post = new PixelPost();
        post.id = UUID.randomUUID();
        post.userId = userId;
        post.generationId = generation.getId();
        post.characterObjectKey = generation.getGeneratedObjectKey();
        post.originalObjectKey = keepOriginal ? generation.getOriginalObjectKey() : null;
        post.caption = caption;
        post.mood = mood;
        post.style = generation.getStyle();
        post.visibility = PixelVisibility.PUBLIC;
        post.postDate = postDate;
        post.representative = true;
        Instant now = Instant.now();
        post.publishedAt = now;
        post.createdAt = now;
        post.updatedAt = now;
        return post;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    /** Demotes a previous post when a new representative replaces it. */
    public void demote() {
        this.representative = false;
        this.visibility = PixelVisibility.PRIVATE;
    }

    public void unpublish() {
        this.visibility = PixelVisibility.PRIVATE;
        this.representative = false;
    }

    public void softDelete() {
        this.deletedAt = Instant.now();
        this.visibility = PixelVisibility.PRIVATE;
        this.representative = false;
    }

    public void forgetOriginal() {
        this.originalObjectKey = null;
    }

    public boolean isVisibleToOthers() {
        return deletedAt == null && visibility == PixelVisibility.PUBLIC;
    }

    public boolean hasOriginal() {
        return originalObjectKey != null;
    }

    public void addHearts(int delta) {
        this.heartCount = Math.max(0, this.heartCount + delta);
    }
}
