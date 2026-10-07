package app.pixme.api;

import java.util.UUID;

import app.pixme.api.dto.PixelDtos;
import app.pixme.reaction.ReactionService;
import app.pixme.security.AuthPrincipal;
import app.pixme.security.CurrentUser;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** ♡ — the lightest action in the app, and therefore idempotent on both verbs. */
@RestController
@RequestMapping("/api/v1/pixels")
public class ReactionController {

    private final ReactionService reactionService;

    public ReactionController(ReactionService reactionService) {
        this.reactionService = reactionService;
    }

    @PostMapping("/{postId}/heart")
    public PixelDtos.HeartResponse heart(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID postId) {
        ReactionService.HeartResult result =
                reactionService.sendHeart(principal.userId(), postId);
        return new PixelDtos.HeartResponse(
                result.postId().toString(), result.heartCount(), result.heartedByMe());
    }

    @DeleteMapping("/{postId}/heart")
    public PixelDtos.HeartResponse unheart(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID postId) {
        ReactionService.HeartResult result =
                reactionService.removeHeart(principal.userId(), postId);
        return new PixelDtos.HeartResponse(
                result.postId().toString(), result.heartCount(), result.heartedByMe());
    }
}
