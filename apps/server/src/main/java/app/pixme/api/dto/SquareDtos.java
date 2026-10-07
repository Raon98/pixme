package app.pixme.api.dto;

import java.util.List;

public final class SquareDtos {

    private SquareDtos() {}

    public record SquareResponse(
            SceneResponse scene,
            List<OccupantResponse> occupants,
            List<CurationResponse> curations,
            int totalCount,
            String nextCursor) {}

    public record SceneResponse(
            String code, String name, int version, PaletteResponse palette, List<PropResponse> props) {}

    public record PaletteResponse(String sky, String ground, String accent) {}

    public record PropResponse(String code, int x, int y, double scale, int zIndex) {}

    /**
     * {@code dailyStatusId} is null when the user is present today but hasn't
     * set a status — they still render, just without a caption/tags.
     * {@code presenceState} drives the "🟢 지금 있어요" / "✨ 방금 도착했어요" /
     * "오늘 다녀간 PIXME" copy client-side.
     */
    public record OccupantResponse(
            String userId,
            String dailyStatusId,
            String nickname,
            String characterImageUrl,
            String mood,
            String message,
            String presenceState,
            int x,
            int y,
            int idleVariant,
            int depth) {}

    public record CurationResponse(String code, String title, List<CurationEntryResponse> entries) {}

    public record CurationEntryResponse(
            String userId, String dailyStatusId, String nickname, String characterImageUrl, String mood) {}
}
