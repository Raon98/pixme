package app.pixme.api.dto;

import java.time.Instant;
import java.util.List;

/** The signed-in user's own view of themselves. Mirrors `MeResponse` in the app. */
public record MeResponse(
        String id,
        String provider,
        String nickname,
        String bio,
        String birthDate,
        String status,
        boolean profileCompleted,
        List<String> interests,
        String representativeCharacterUrl,
        StatsResponse stats,
        EntitlementsResponse entitlements,
        SettingsResponse settings,
        Instant createdAt) {

    public record StatsResponse(
            int receivedHeartCount, int connectionCount, int pixelCount, int streakDays) {}

    public record SettingsResponse(
            boolean pushHeart,
            boolean pushConnectionRequest,
            boolean pushConnected,
            boolean pushMessage,
            boolean pushDailyReminder,
            boolean keepOriginalPhoto) {}
}
