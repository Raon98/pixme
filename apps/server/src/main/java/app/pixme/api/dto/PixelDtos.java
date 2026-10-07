package app.pixme.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class PixelDtos {

    private PixelDtos() {}

    /* ------------------------------------------------------------ upload */

    public record CreateUploadRequest(@NotBlank String mimeType, long byteSize) {}

    public record UploadTicketResponse(
            String uploadId, String uploadUrl, Map<String, String> headers, Instant expiresAt) {}

    /* -------------------------------------------------------- generation */

    public record StartGenerationRequest(@NotBlank String uploadId, String style) {}

    public record RetryGenerationRequest(@NotBlank String generationId, String style) {}

    public record GenerationResponse(
            String id,
            String status,
            String style,
            int progress,
            String characterImageUrl,
            String failureReason,
            boolean usedFreeGeneration,
            boolean usedCredit,
            Instant createdAt,
            Instant completedAt) {}

    /* -------------------------------------------------------------- post */

    public record PublishRequest(
            @Size(max = 60) String caption,
            String mood,
            List<String> tags,
            boolean replaceRepresentative) {}

    public record AuthorResponse(
            String id,
            String nickname,
            String representativeCharacterUrl,
            String connectionStatus) {}

    public record PostResponse(
            String id,
            AuthorResponse author,
            String characterImageUrl,
            String caption,
            String mood,
            List<String> tags,
            String style,
            String visibility,
            int heartCount,
            boolean heartedByMe,
            String postDate,
            boolean isRepresentative,
            Instant createdAt) {}

    /** Owner-only view; the only place `originalImageUrl` is ever populated. */
    public record MyPostResponse(
            String id,
            AuthorResponse author,
            String characterImageUrl,
            String caption,
            String mood,
            List<String> tags,
            String style,
            String visibility,
            int heartCount,
            boolean heartedByMe,
            String postDate,
            boolean isRepresentative,
            Instant createdAt,
            String originalImageUrl,
            boolean originalRetained) {}

    public record PostSummaryResponse(
            String id, String characterImageUrl, String postDate, String mood, int heartCount) {}

    public record TodayStatusResponse(
            PostResponse myTodayPost,
            boolean freeGenerationAvailable,
            int creditBalance,
            String pendingGenerationId) {}

    public record SignedUrlResponse(String url, Instant expiresAt) {}

    /* ---------------------------------------------------------- reaction */

    public record HeartResponse(String postId, int heartCount, boolean heartedByMe) {}
}
