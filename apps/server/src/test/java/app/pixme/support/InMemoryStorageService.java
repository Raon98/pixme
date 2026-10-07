package app.pixme.support;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.storage.StorageService;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * In-memory object storage for tests.
 *
 * <p>This is the payoff of having {@link StorageService} as an interface: the
 * whole create pipeline — pre-signed upload, read-back for the AI provider,
 * character write, original deletion — is exercisable with no S3, no MinIO and
 * no network, which also makes it work in CI.
 *
 * <p>It is a faithful double, not a no-op: it tracks objects per bucket, so a
 * test can assert that an original really was deleted and that the character
 * really was written.
 */
public class InMemoryStorageService implements StorageService {

    private final Map<String, byte[]> originals = new ConcurrentHashMap<>();
    private final Map<String, byte[]> characters = new ConcurrentHashMap<>();

    @Override
    public PresignedUpload presignOriginalUpload(UUID userId, String mimeType, Duration ttl) {
        String objectKey = "originals/test/" + userId + "/" + UUID.randomUUID() + ".jpg";
        // Nothing listens on this URL; tests call `putOriginal` directly to
        // simulate the client's PUT.
        return new PresignedUpload(
                objectKey,
                "http://in-memory/" + objectKey,
                Map.of("Content-Type", mimeType));
    }

    @Override
    public String presignOriginalDownload(String objectKey, Duration ttl) {
        if (!originals.containsKey(objectKey)) {
            throw new ApiException(ErrorCode.ORIGINAL_NOT_AVAILABLE);
        }
        return "http://in-memory/" + objectKey + "?signed=true";
    }

    @Override
    public String putCharacter(String objectKey, byte[] content, String mimeType) {
        characters.put(objectKey, content);
        return objectKey;
    }

    @Override
    public byte[] getOriginal(String objectKey) {
        byte[] content = originals.get(objectKey);
        if (content == null) {
            throw new ApiException(ErrorCode.UPLOAD_NOT_FOUND);
        }
        return content;
    }

    @Override
    public String characterUrl(String objectKey) {
        return objectKey == null ? null : "https://cdn.test/" + objectKey;
    }

    @Override
    public void deleteOriginal(String objectKey) {
        if (objectKey != null) {
            originals.remove(objectKey);
        }
    }

    @Override
    public void deleteCharacter(String objectKey) {
        if (objectKey != null) {
            characters.remove(objectKey);
        }
    }

    @Override
    public boolean originalExists(String objectKey) {
        return objectKey != null && originals.containsKey(objectKey);
    }

    /* ----------------------------------------------------------- test hooks */

    /** Stands in for the client's PUT to the pre-signed URL. */
    public void putOriginal(String objectKey, byte[] content) {
        originals.put(objectKey, content);
    }

    public boolean hasCharacter(String objectKey) {
        return characters.containsKey(objectKey);
    }

    /** Lets a test assert on the bytes that were actually stored. */
    public byte[] character(String objectKey) {
        return characters.get(objectKey);
    }

    public int originalCount() {
        return originals.size();
    }

    @TestConfiguration
    public static class Config {

        @Bean
        @Primary
        public StorageService inMemoryStorageService() {
            return new InMemoryStorageService();
        }
    }
}
