package app.pixme.pixel.domain;

import java.time.Instant;
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
 * A confirmed, owned character — one entry in the user's Collection.
 *
 * <p>Created exactly once, when the user keeps a generation result ("이걸로
 * 할래요" or "새 PIXME 선택"). A generation the user compares and then
 * discards (keeps their existing Current PIXME instead) never becomes a
 * {@code PixelCharacter} — the AI was still paid for, but nothing is added to
 * the Collection. That is the entire distinction between "trying a look" and
 * "owning a look", and it is what makes
 * {@link app.pixme.pixel.PixelCharacterService#setCurrent} free: switching
 * {@code UserCurrentPixel} among existing characters never calls a provider.
 *
 * <p>Deliberately not dated. The old {@code pixel_posts} row conflated "a
 * character" with "today's appearance" — this is the half of that split that
 * has no calendar meaning at all. {@link DailyStatus} is the dated half.
 */
@Entity
@Table(name = "pixel_characters")
@Getter
@Setter
@NoArgsConstructor
public class PixelCharacter {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "generation_id", nullable = false)
    private UUID generationId;

    @Column(name = "character_object_key", nullable = false, length = 512)
    private String characterObjectKey;

    /** Null once the original is gone — opted out, deleted, or past retention. */
    @Column(name = "original_object_key", length = 512)
    private String originalObjectKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "style", nullable = false, length = 32)
    private PixelStyle style = PixelStyle.PIXME_BASIC;

    /** Optional, user-given ("정장 PIXME"). Never required. */
    @Column(name = "label", length = 30)
    private String label;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public static PixelCharacter keep(UUID userId, PixelGeneration generation, boolean keepOriginal) {
        PixelCharacter character = new PixelCharacter();
        character.id = UUID.randomUUID();
        character.userId = userId;
        character.generationId = generation.getId();
        character.characterObjectKey = generation.getGeneratedObjectKey();
        character.originalObjectKey = keepOriginal ? generation.getOriginalObjectKey() : null;
        character.style = generation.getStyle();
        Instant now = Instant.now();
        character.createdAt = now;
        character.updatedAt = now;
        return character;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public boolean isAlive() {
        return deletedAt == null;
    }

    public boolean hasOriginal() {
        return originalObjectKey != null;
    }

    public void forgetOriginal() {
        this.originalObjectKey = null;
    }

    public void softDelete() {
        this.deletedAt = Instant.now();
    }
}
