package app.pixme.pixel.domain;

import java.time.Instant;
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
 * The single pointer to "who this user is right now".
 *
 * <p>Repointing this is free when it points at an existing
 * {@link PixelCharacter} the user already owns, and is the paid path's final
 * step when it points at a newly-kept one. The distinction lives entirely in
 * the caller ({@code PixelCharacterService}), not here — this entity is just
 * "one row, one pointer, always present once a user has made their first
 * character".
 */
@Entity
@Table(name = "user_current_pixel")
@Getter
@Setter
@NoArgsConstructor
public class UserCurrentPixel {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "pixel_character_id", nullable = false)
    private UUID pixelCharacterId;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static UserCurrentPixel of(UUID userId, UUID pixelCharacterId) {
        UserCurrentPixel current = new UserCurrentPixel();
        current.userId = userId;
        current.pixelCharacterId = pixelCharacterId;
        current.updatedAt = Instant.now();
        return current;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public void repoint(UUID pixelCharacterId) {
        this.pixelCharacterId = pixelCharacterId;
    }
}
