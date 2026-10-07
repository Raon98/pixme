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

    public record OccupantResponse(
            String postId,
            String userId,
            String nickname,
            String characterImageUrl,
            String mood,
            int x,
            int y,
            int idleVariant,
            int depth) {}

    public record CurationResponse(String code, String title, List<CurationEntryResponse> entries) {}

    public record CurationEntryResponse(
            String postId, String userId, String nickname, String characterImageUrl, String mood) {}
}
