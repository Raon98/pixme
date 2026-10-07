package app.pixme.api.dto;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.Size;

public final class UserDtos {

    private UserDtos() {}

    /**
     * Profile PATCH.
     *
     * <p>Every field is nullable so that omitting one leaves it untouched —
     * first-run setup sends them one step at a time, and the edit screen must
     * not wipe interests just because it didn't change them.
     */
    public record UpdateMeRequest(
            @Size(min = 2, max = 12) String nickname,
            LocalDate birthDate,
            /** Explicitly nullable: null with `bioProvided` clears the bio. */
            String bio,
            List<String> interests,
            SettingsPatchRequest settings) {}

    public record SettingsPatchRequest(
            Boolean pushHeart,
            Boolean pushConnectionRequest,
            Boolean pushConnected,
            Boolean pushMessage,
            Boolean pushDailyReminder,
            Boolean keepOriginalPhoto) {}

    public record NicknameAvailabilityResponse(boolean available, String reason) {}

    public record InterestResponse(String code, String label, String emoji) {}

    public record RegisterPushTokenRequest(
            String token, String platform, String appVersion) {}

    public record BlockedUserResponse(
            String userId,
            String nickname,
            String representativeCharacterUrl,
            java.time.Instant blockedAt) {}

    /** Another person's profile. */
    public record PublicProfileResponse(
            String id,
            String nickname,
            String bio,
            List<String> interests,
            String representativeCharacterUrl,
            PixelDtos.PostResponse todayPost,
            List<PixelDtos.PostSummaryResponse> recentPosts,
            PublicStats stats,
            RelationResponse relation) {

        public record PublicStats(int receivedHeartCount, int pixelCount) {}
    }

    public record RelationResponse(
            boolean isMe,
            String connectionStatus,
            String conversationId,
            boolean heartedTodayPost,
            boolean blockedByMe) {}
}
