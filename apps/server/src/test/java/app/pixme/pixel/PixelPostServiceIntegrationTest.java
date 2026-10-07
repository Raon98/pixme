package app.pixme.pixel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.common.ServiceClock;
import app.pixme.pixel.domain.PixelGeneration;
import app.pixme.pixel.domain.PixelPost;
import app.pixme.support.IntegrationTest;
import app.pixme.support.TestFixtures;
import app.pixme.user.UserService;
import app.pixme.user.domain.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The central product rule: one representative PIXME per person per day.
 * Everything about how the feed and the square read depends on it holding.
 */
@IntegrationTest
class PixelPostServiceIntegrationTest {

    @Autowired
    private PixelPostService postService;

    @Autowired
    private UserService userService;

    @Autowired
    private ServiceClock clock;

    @Autowired
    private TestFixtures fixtures;

    @Test
    @DisplayName("오늘의 PIXME를 게시하면 대표 캐릭터가 된다")
    void publishSetsRepresentative() {
        User user = fixtures.activeUser("pub");
        PixelGeneration generation = fixtures.completedGeneration(user.getId(), clock.today());

        PixelPost post = postService.publish(
                user.getId(),
                generation.getId(),
                new PixelPostService.PublishCommand(
                        "오늘은 그냥 산책.", "HAPPY", List.of("카페", "#산책"), false));

        assertThat(post.isRepresentative()).isTrue();
        assertThat(post.getCaption()).isEqualTo("오늘은 그냥 산책.");
        assertThat(postService.tagsOf(post.getId())).containsExactlyInAnyOrder("카페", "산책");
        assertThat(userService.profileOf(user.getId()).getRepresentativePostId())
                .isEqualTo(post.getId());
        assertThat(userService.statsOf(user.getId()).getPixelCount()).isEqualTo(1);
        assertThat(userService.statsOf(user.getId()).getStreakDays()).isEqualTo(1);
    }

    @Test
    @DisplayName("같은 날 두 번째 게시는 확인 없이는 거부된다")
    void refusesSecondPublishWithoutConfirmation() {
        User user = fixtures.activeUser("twice");
        PixelGeneration first = fixtures.completedGeneration(user.getId(), clock.today());
        PixelGeneration second = fixtures.completedGeneration(user.getId(), clock.today());

        postService.publish(
                user.getId(),
                first.getId(),
                new PixelPostService.PublishCommand(null, null, List.of(), false));

        assertThatThrownBy(() -> postService.publish(
                        user.getId(),
                        second.getId(),
                        new PixelPostService.PublishCommand(null, null, List.of(), false)))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.ALREADY_PUBLISHED_TODAY);
    }

    @Test
    @DisplayName("바꾸기를 확인하면 새 모습이 대표가 되고 이전 모습은 기록에만 남는다")
    void replacingKeepsPreviousInHistoryOnly() {
        User user = fixtures.activeUser("replace");
        PixelGeneration first = fixtures.completedGeneration(user.getId(), clock.today());
        PixelGeneration second = fixtures.completedGeneration(user.getId(), clock.today());

        PixelPost original = postService.publish(
                user.getId(),
                first.getId(),
                new PixelPostService.PublishCommand(null, null, List.of(), false));

        PixelPost replacement = postService.publish(
                user.getId(),
                second.getId(),
                new PixelPostService.PublishCommand("바꿨어요", null, List.of(), true));

        assertThat(replacement.isRepresentative()).isTrue();
        assertThat(postService.findTodayRepresentative(user.getId()))
                .get()
                .extracting(PixelPost::getId)
                .isEqualTo(replacement.getId());

        // The replaced one survives in the owner's record but is no longer public.
        PixelPost demoted = postService.getOwned(user.getId(), original.getId());
        assertThat(demoted.isRepresentative()).isFalse();
        assertThat(demoted.isVisibleToOthers()).isFalse();
        assertThat(postService.history(user.getId(), null, null, 10)).hasSize(2);
    }

    @Test
    @DisplayName("같은 생성을 다시 게시하면 멱등이다")
    void republishingSameGenerationIsIdempotent() {
        User user = fixtures.activeUser("idem");
        PixelGeneration generation = fixtures.completedGeneration(user.getId(), clock.today());

        PixelPost first = postService.publish(
                user.getId(),
                generation.getId(),
                new PixelPostService.PublishCommand(null, null, List.of(), false));
        PixelPost second = postService.publish(
                user.getId(),
                generation.getId(),
                new PixelPostService.PublishCommand(null, null, List.of(), false));

        assertThat(second.getId()).isEqualTo(first.getId());
    }

    @Test
    @DisplayName("태그는 4개까지만 저장된다")
    void capsTagCount() {
        User user = fixtures.activeUser("tags");
        PixelGeneration generation = fixtures.completedGeneration(user.getId(), clock.today());

        PixelPost post = postService.publish(
                user.getId(),
                generation.getId(),
                new PixelPostService.PublishCommand(
                        null, null, List.of("카페", "산책", "출근", "운동", "여행", "데이트"), false));

        assertThat(postService.tagsOf(post.getId())).hasSize(4);
    }

    @Test
    @DisplayName("알 수 없는 기분 값은 저장하지 않는다")
    void rejectsUnknownMood() {
        User user = fixtures.activeUser("mood");
        PixelGeneration generation = fixtures.completedGeneration(user.getId(), clock.today());

        assertThatThrownBy(() -> postService.publish(
                        user.getId(),
                        generation.getId(),
                        new PixelPostService.PublishCommand(null, "ECSTATIC", List.of(), false)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("원본 사진을 지워도 캐릭터와 기록은 남는다")
    void deletingOriginalKeepsCharacter() {
        User user = fixtures.activeUser("orig");
        PixelGeneration generation = fixtures.completedGeneration(user.getId(), clock.today());

        PixelPost post = postService.publish(
                user.getId(),
                generation.getId(),
                new PixelPostService.PublishCommand(null, null, List.of(), false));
        assertThat(post.hasOriginal()).isTrue();

        postService.deleteOriginal(user.getId(), post.getId());

        PixelPost reloaded = postService.getOwned(user.getId(), post.getId());
        assertThat(reloaded.hasOriginal()).isFalse();
        assertThat(reloaded.getCharacterObjectKey()).isNotNull();
        assertThat(reloaded.isRepresentative()).isTrue();

        assertThatThrownBy(() -> postService.originalUrl(user.getId(), post.getId()))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.ORIGINAL_NOT_AVAILABLE);
    }

    @Test
    @DisplayName("다른 사람의 비공개 PIXME는 조회할 수 없다")
    void hidesNonPublicPostsFromOthers() {
        User owner = fixtures.activeUser("owner");
        User viewer = fixtures.activeUser("viewer");

        PixelGeneration generation = fixtures.completedGeneration(owner.getId(), clock.today());
        PixelPost post = postService.publish(
                owner.getId(),
                generation.getId(),
                new PixelPostService.PublishCommand(null, null, List.of(), false));

        postService.unpublish(owner.getId(), post.getId());

        assertThatThrownBy(() -> postService.getVisible(viewer.getId(), post.getId()))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.NOT_FOUND);
    }
}
