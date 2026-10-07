package app.pixme.storage;

import java.net.URI;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.config.PixmeProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

/** S3-API implementation, used for AWS S3, Cloudflare R2 and local MinIO alike. */
@Service
public class S3StorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(S3StorageService.class);

    private final PixmeProperties.Storage config;
    private final S3Client client;
    private final S3Presigner presigner;

    public S3StorageService(PixmeProperties properties) {
        this.config = properties.storage();

        var credentials = StaticCredentialsProvider.create(
                AwsBasicCredentials.create(config.accessKey(), config.secretKey()));
        var region = Region.of(config.region());

        var clientBuilder = S3Client.builder().region(region).credentialsProvider(credentials);
        var presignerBuilder =
                S3Presigner.builder().region(region).credentialsProvider(credentials);

        if (config.endpoint() != null && !config.endpoint().isBlank()) {
            // R2 / MinIO require a custom endpoint and path-style addressing.
            URI endpoint = URI.create(config.endpoint());
            clientBuilder
                    .endpointOverride(endpoint)
                    .serviceConfiguration(
                            S3Configuration.builder().pathStyleAccessEnabled(true).build());
            presignerBuilder.endpointOverride(endpoint);
        }

        this.client = clientBuilder.build();
        this.presigner = presignerBuilder.build();
    }

    @Override
    public PresignedUpload presignOriginalUpload(UUID userId, String mimeType, Duration ttl) {
        String objectKey = originalKey(userId, mimeType);

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(config.originalsBucket())
                .key(objectKey)
                .contentType(mimeType)
                // Belt and braces: even if a bucket policy were misconfigured,
                // the object itself is written private.
                .acl("private")
                .build();

        var presigned = presigner.presignPutObject(PutObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .putObjectRequest(request)
                .build());

        return new PresignedUpload(
                objectKey,
                presigned.url().toString(),
                Map.of("Content-Type", mimeType, "x-amz-acl", "private"));
    }

    @Override
    public String presignOriginalDownload(String objectKey, Duration ttl) {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(config.originalsBucket())
                .key(objectKey)
                .build();

        return presigner
                .presignGetObject(GetObjectPresignRequest.builder()
                        .signatureDuration(ttl)
                        .getObjectRequest(request)
                        .build())
                .url()
                .toString();
    }

    @Override
    public String putCharacter(String objectKey, byte[] content, String mimeType) {
        client.putObject(
                PutObjectRequest.builder()
                        .bucket(config.charactersBucket())
                        .key(objectKey)
                        .contentType(mimeType)
                        // Characters are immutable once generated, so they can be
                        // cached aggressively by the CDN and the app.
                        .cacheControl("public, max-age=31536000, immutable")
                        .build(),
                RequestBody.fromBytes(content));
        return objectKey;
    }

    @Override
    public byte[] getOriginal(String objectKey) {
        try {
            ResponseBytes<GetObjectResponse> response = client.getObjectAsBytes(
                    GetObjectRequest.builder()
                            .bucket(config.originalsBucket())
                            .key(objectKey)
                            .build());
            return response.asByteArray();
        } catch (NoSuchKeyException exception) {
            throw new ApiException(ErrorCode.UPLOAD_NOT_FOUND);
        }
    }

    @Override
    public String characterUrl(String objectKey) {
        if (objectKey == null) {
            return null;
        }
        String base = config.charactersCdnBaseUrl();
        return base.endsWith("/") ? base + objectKey : base + "/" + objectKey;
    }

    @Override
    public void deleteOriginal(String objectKey) {
        if (objectKey == null) {
            return;
        }
        try {
            client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(config.originalsBucket())
                    .key(objectKey)
                    .build());
        } catch (RuntimeException exception) {
            // A failed delete must not fail the user's request; the retention
            // job will retry it.
            log.warn("failed to delete original {}", objectKey, exception);
        }
    }

    @Override
    public void deleteCharacter(String objectKey) {
        if (objectKey == null) {
            return;
        }
        try {
            client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(config.charactersBucket())
                    .key(objectKey)
                    .build());
        } catch (RuntimeException exception) {
            log.warn("failed to delete character {}", objectKey, exception);
        }
    }

    @Override
    public boolean originalExists(String objectKey) {
        try {
            client.headObject(HeadObjectRequest.builder()
                    .bucket(config.originalsBucket())
                    .key(objectKey)
                    .build());
            return true;
        } catch (NoSuchKeyException exception) {
            return false;
        } catch (RuntimeException exception) {
            log.warn("headObject failed for {}", objectKey, exception);
            return false;
        }
    }

    /**
     * Keys are date-partitioned and random — never derived from the user's
     * nickname or a sequential id, so a key cannot be guessed from another
     * key, and lifecycle rules can expire a whole day's prefix.
     */
    private String originalKey(UUID userId, String mimeType) {
        String extension = switch (mimeType) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/heic", "image/heif" -> "heic";
            default -> "jpg";
        };
        LocalDate today = LocalDate.now();
        return "originals/%d/%02d/%02d/%s/%s.%s"
                .formatted(
                        today.getYear(),
                        today.getMonthValue(),
                        today.getDayOfMonth(),
                        userId,
                        UUID.randomUUID(),
                        extension);
    }

    /** Character keys mirror the generation they came from, for traceability. */
    public static String characterKey(UUID userId, UUID generationId) {
        LocalDate today = LocalDate.now();
        return "characters/%d/%02d/%s/%s.png"
                .formatted(today.getYear(), today.getMonthValue(), userId, generationId);
    }
}
