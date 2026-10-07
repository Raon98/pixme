package app.pixme.pixel.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * An original photo the client has (or is about to) upload directly to private
 * storage via a pre-signed URL.
 *
 * <p>Tracked separately from the generation so that an abandoned upload — user
 * picked a photo, then backed out — is a row with {@code consumedAt = null} and
 * an expiry, trivially reapable by the retention job. The API itself never
 * handles the image bytes.
 */
@Entity
@Table(name = "pixel_uploads")
@Getter
@Setter
@NoArgsConstructor
public class PixelUpload {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "object_key", nullable = false, length = 512)
    private String objectKey;

    @Column(name = "mime_type", nullable = false, length = 64)
    private String mimeType;

    @Column(name = "byte_size", nullable = false)
    private long byteSize;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static PixelUpload create(
            UUID userId, String objectKey, String mimeType, long byteSize, Instant expiresAt) {
        PixelUpload upload = new PixelUpload();
        upload.id = UUID.randomUUID();
        upload.userId = userId;
        upload.objectKey = objectKey;
        upload.mimeType = mimeType;
        upload.byteSize = byteSize;
        upload.expiresAt = expiresAt;
        upload.createdAt = Instant.now();
        return upload;
    }

    public boolean isConsumed() {
        return consumedAt != null;
    }

    public void markConsumed() {
        this.consumedAt = Instant.now();
    }
}
