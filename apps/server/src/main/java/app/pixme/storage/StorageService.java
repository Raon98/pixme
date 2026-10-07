package app.pixme.storage;

import java.time.Duration;
import java.util.Map;

/**
 * Object storage abstraction.
 *
 * <p>Two buckets with deliberately different access models:
 * <ul>
 *   <li><b>originals</b> — private. The client PUTs straight to a pre-signed
 *       URL (the API never receives the image bytes) and reads only via
 *       short-lived signed GET URLs, owner-only.
 *   <li><b>characters</b> — served from a CDN. Generated characters are public
 *       content by design; they are what the feed and square render.
 * </ul>
 *
 * <p>The interface is S3-shaped because S3, Cloudflare R2 and MinIO all speak
 * it, so switching provider is configuration.
 */
public interface StorageService {

    record PresignedUpload(String objectKey, String url, Map<String, String> headers) {}

    /** Pre-signed PUT into the private originals bucket. */
    PresignedUpload presignOriginalUpload(
            java.util.UUID userId, String mimeType, Duration ttl);

    /** Short-lived signed GET for an original. Owner-only, never cached client-side. */
    String presignOriginalDownload(String objectKey, Duration ttl);

    /** Stores a generated character and returns its object key. */
    String putCharacter(String objectKey, byte[] content, String mimeType);

    /** Reads an original so it can be sent to the AI provider. */
    byte[] getOriginal(String objectKey);

    /** Public CDN URL for a character object. */
    String characterUrl(String objectKey);

    /** Irreversible. Used by the privacy opt-out and the retention job. */
    void deleteOriginal(String objectKey);

    void deleteCharacter(String objectKey);

    boolean originalExists(String objectKey);
}
