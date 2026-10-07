package app.pixme.api.dto;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.Size;

public final class DailyStatusDtos {

    private DailyStatusDtos() {}

    /**
     * Upserts today's status. Every field is optional: sending only
     * {@code pixelCharacterId} is a free Current PIXME switch, sending only
     * {@code mood}/{@code message}/{@code tags} is a pure text edit, and the
     * two can be combined in one call.
     */
    public record UpsertStatusRequest(
            String mood,
            @Size(max = 60) String message,
            List<String> tags,
            String pixelCharacterId) {}

    public record StatusResponse(
            String id,
            PixelDtos.AuthorResponse author,
            String characterImageUrl,
            String mood,
            String message,
            List<String> tags,
            int heartCount,
            boolean heartedByMe,
            boolean freshCharacter,
            String statusDate,
            Instant createdAt) {}

    public record StatusSummaryResponse(
            String id, String characterImageUrl, String statusDate, String mood, int heartCount) {}

    public record TodayStatusResponse(
            StatusResponse myTodayStatus,
            boolean firstGenerationAvailable,
            boolean firstRetryAvailable,
            int bonusFreeCredits,
            int creditBalance,
            boolean nextGenerationIsFree,
            String pendingGenerationId,
            boolean squareVisible,
            boolean squareOnboarded) {}

    public record HeartResponse(String dailyStatusId, int heartCount, boolean heartedByMe) {}
}
