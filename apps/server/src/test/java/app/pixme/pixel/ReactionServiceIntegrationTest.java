package app.pixme.pixel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.common.ServiceClock;
import app.pixme.pixel.domain.PixelPost;
import app.pixme.reaction.ReactionService;
import app.pixme.safety.SafetyService;
import app.pixme.support.IntegrationTest;
import app.pixme.support.TestFixtures;
import app.pixme.user.UserService;
import app.pixme.user.domain.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Hearts: idempotent, never on your own post, never across a block. */
@IntegrationTest
class ReactionServiceIntegrationTest {

    @Autowired
    private ReactionService reactionService;

    @Autowired
    private PixelPostService postService;

    @Autowired
    private SafetyService safetyService;

    @Autowired
    private UserService userService;

    @Autowired
    private ServiceClock clock;

    @Autowired
    private TestFixtures fixtures;

    @Test
    @DisplayName("하트는 한 번만 센다 — 두 번 눌러도 1이다")
    void heartIsIdempotent() {
        User author = fixtures.activeUser("hauth");
        User viewer = fixtures.activeUser("hview");
        PixelPost post = publish(author);

        ReactionService.HeartResult first = reactionService.sendHeart(viewer.getId(), post.getId());
        ReactionService.HeartResult second = reactionService.sendHeart(viewer.getId(), post.getId());

        assertThat(first.heartCount()).isEqualTo(1);
        assertThat(first.heartedByMe()).isTrue();
        assertThat(second.heartCount()).isEqualTo(1);
        assertThat(second.heartedByMe()).isTrue();
        assertThat(userService.statsOf(author.getId()).getReceivedHeartCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("하트를 취소하면 수가 줄어든다")
    void heartCanBeRemoved() {
        User author = fixtures.activeUser("rauth");
        User viewer = fixtures.activeUser("rview");
        PixelPost post = publish(author);

        reactionService.sendHeart(viewer.getId(), post.getId());
        ReactionService.HeartResult removed =
                reactionService.removeHeart(viewer.getId(), post.getId());

        assertThat(removed.heartCount()).isZero();
        assertThat(removed.heartedByMe()).isFalse();
        assertThat(userService.statsOf(author.getId()).getReceivedHeartCount()).isZero();
    }

    @Test
    @DisplayName("없는 하트를 취소해도 오류가 아니다")
    void removingAbsentHeartIsHarmless() {
        User author = fixtures.activeUser("nauth");
        User viewer = fixtures.activeUser("nview");
        PixelPost post = publish(author);

        ReactionService.HeartResult result =
                reactionService.removeHeart(viewer.getId(), post.getId());

        assertThat(result.heartCount()).isZero();
        assertThat(result.heartedByMe()).isFalse();
    }

    @Test
    @DisplayName("내 PIXME에는 하트를 보낼 수 없다")
    void cannotHeartOwnPost() {
        User author = fixtures.activeUser("sauth");
        PixelPost post = publish(author);

        assertThatThrownBy(() -> reactionService.sendHeart(author.getId(), post.getId()))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.CANNOT_REACT_TO_SELF);
    }

    @Test
    @DisplayName("차단된 사이에는 하트를 보낼 수 없다")
    void cannotHeartAcrossABlock() {
        User author = fixtures.activeUser("bauth");
        User viewer = fixtures.activeUser("bview");
        PixelPost post = publish(author);

        safetyService.block(author.getId(), viewer.getId());

        assertThatThrownBy(() -> reactionService.sendHeart(viewer.getId(), post.getId()))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.BLOCKED_BY_PEER);
    }

    private PixelPost publish(User author) {
        var generation = fixtures.completedGeneration(author.getId(), clock.today());
        return postService.publish(
                author.getId(),
                generation.getId(),
                new PixelPostService.PublishCommand(null, null, List.of(), false));
    }
}
