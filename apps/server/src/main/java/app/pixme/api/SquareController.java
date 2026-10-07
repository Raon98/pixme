package app.pixme.api;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import app.pixme.api.dto.SquareDtos;
import app.pixme.pixel.domain.PixelPost;
import app.pixme.security.AuthPrincipal;
import app.pixme.security.CurrentUser;
import app.pixme.square.SquareService;
import app.pixme.square.domain.SquareScene;
import app.pixme.storage.StorageService;
import app.pixme.user.domain.UserProfile;
import app.pixme.user.repository.UserProfileRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/square")
public class SquareController {

    private static final Logger log = LoggerFactory.getLogger(SquareController.class);

    private final SquareService squareService;
    private final UserProfileRepository profileRepository;
    private final StorageService storage;
    private final ObjectMapper objectMapper;

    public SquareController(
            SquareService squareService,
            UserProfileRepository profileRepository,
            StorageService storage,
            ObjectMapper objectMapper) {
        this.squareService = squareService;
        this.profileRepository = profileRepository;
        this.storage = storage;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/today")
    public SquareDtos.SquareResponse today(
            @CurrentUser AuthPrincipal principal,
            @RequestParam(required = false) Integer limit) {

        SquareService.SquareView view = squareService.today(principal.userId(), limit);

        List<UUID> userIds = new ArrayList<>();
        view.occupants().forEach(occupant -> userIds.add(occupant.post().getUserId()));
        view.curations().forEach(curation ->
                curation.posts().forEach(post -> userIds.add(post.getUserId())));

        Map<UUID, String> nicknames = new HashMap<>();
        if (!userIds.isEmpty()) {
            profileRepository.findByUserIdIn(userIds.stream().distinct().toList())
                    .forEach(profile -> nicknames.put(
                            profile.getUserId(), nicknameOf(profile)));
        }

        List<SquareDtos.OccupantResponse> occupants = new ArrayList<>(view.occupants().size());
        for (SquareService.Occupant occupant : view.occupants()) {
            PixelPost post = occupant.post();
            occupants.add(new SquareDtos.OccupantResponse(
                    post.getId().toString(),
                    post.getUserId().toString(),
                    nicknames.getOrDefault(post.getUserId(), "알 수 없음"),
                    storage.characterUrl(post.getCharacterObjectKey()),
                    post.getMood(),
                    occupant.placement().getX(),
                    occupant.placement().getY(),
                    occupant.placement().getIdleVariant(),
                    occupant.placement().getDepth()));
        }

        List<SquareDtos.CurationResponse> curations = new ArrayList<>(view.curations().size());
        for (SquareService.Curation curation : view.curations()) {
            List<SquareDtos.CurationEntryResponse> entries =
                    new ArrayList<>(curation.posts().size());
            for (PixelPost post : curation.posts()) {
                entries.add(new SquareDtos.CurationEntryResponse(
                        post.getId().toString(),
                        post.getUserId().toString(),
                        nicknames.getOrDefault(post.getUserId(), "알 수 없음"),
                        storage.characterUrl(post.getCharacterObjectKey()),
                        post.getMood()));
            }
            curations.add(new SquareDtos.CurationResponse(
                    curation.code().name(), curation.title(), entries));
        }

        return new SquareDtos.SquareResponse(
                scene(view.scene()), occupants, curations, view.totalCount(), null);
    }

    private SquareDtos.SceneResponse scene(SquareScene scene) {
        if (scene == null) {
            // The square must always render; a missing scene row is a config
            // problem, not a reason to fail the request.
            return new SquareDtos.SceneResponse(
                    "BASIC",
                    "오늘의 광장",
                    1,
                    new SquareDtos.PaletteResponse("#EAF2FF", "#F6F1E4", "#7C6CF0"),
                    List.of());
        }

        return new SquareDtos.SceneResponse(
                scene.getCode(),
                scene.getName(),
                scene.getVersion(),
                new SquareDtos.PaletteResponse(
                        scene.getSkyColor(), scene.getGroundColor(), scene.getAccentColor()),
                parseProps(scene.getPropsJson()));
    }

    private List<SquareDtos.PropResponse> parseProps(String json) {
        try {
            JsonNode node = objectMapper.readTree(json);
            List<SquareDtos.PropResponse> props = new ArrayList<>(node.size());
            node.forEach(prop -> props.add(new SquareDtos.PropResponse(
                    prop.path("code").asText(),
                    prop.path("x").asInt(),
                    prop.path("y").asInt(),
                    prop.path("scale").asDouble(1.0),
                    prop.path("zIndex").asInt(0))));
            return props;
        } catch (Exception exception) {
            log.warn("could not parse scene props", exception);
            return List.of();
        }
    }

    private String nicknameOf(UserProfile profile) {
        return profile.getNickname() == null || profile.getNickname().isBlank()
                ? "알 수 없음"
                : profile.getNickname();
    }
}
