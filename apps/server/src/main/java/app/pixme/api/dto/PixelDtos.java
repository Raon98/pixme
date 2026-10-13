package app.pixme.api.dto;

import java.time.Instant;
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

    /**
     * @param clientRequestId idempotency key. A double-tapped button or a
     *     network retry resolves to the same generation instead of a second
     *     charge.
     */
    public record StartGenerationRequest(
            @NotBlank String uploadId, String style, String clientRequestId) {}

    public record RetryGenerationRequest(
            @NotBlank String generationId, String style, String clientRequestId) {}

    public record GenerationResponse(
            String id,
            String status,
            String style,
            int progress,
            String characterImageUrl,
            String failureReason,
            /** FREE_FIRST · FREE_FIRST_RETRY · FREE_BONUS · PAID_CREDIT */
            String spendKind,
            boolean usedFreeGeneration,
            boolean usedCredit,
            /** Set when this render is a retry, pointing at the original. */
            String retryOfGenerationId,
            Instant createdAt,
            Instant completedAt) {}

    /**
     * Confirms a generation result as an owned PixelCharacter — the only
     * moment one is added to the Collection. {@code asCurrent} points
     * {@code UserCurrentPixel} at it and, if there is a {@code DailyStatus}
     * row for today, marks it fresh; declining to set it current still keeps
     * the character in the Collection for later, free, re-selection.
     */
    public record KeepGenerationRequest(boolean asCurrent, boolean keepOriginal, String label) {}

    /* ---------------------------------------------------------- character */

    public record CharacterResponse(
            String id,
            String characterImageUrl,
            String style,
            String label,
            boolean isCurrent,
            boolean hasOriginal,
            Instant createdAt) {}

    public record AuthorResponse(
            String id,
            String nickname,
            String representativeCharacterUrl,
            String connectionStatus,
            /**
             * Slot name → unlock code the author has applied, already filtered
             * to what they may actually use. Empty when they decorate nothing.
             */
            Map<String, String> decorations) {}

    public record SignedUrlResponse(String url, Instant expiresAt) {}
}
