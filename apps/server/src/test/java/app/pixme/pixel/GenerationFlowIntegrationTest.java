package app.pixme.pixel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import app.pixme.ai.PixelStyle;
import app.pixme.feed.FeedService;
import app.pixme.pixel.domain.GenerationStatus;
import app.pixme.pixel.domain.PixelGeneration;
import app.pixme.pixel.domain.PixelPost;
import app.pixme.square.SquareService;
import app.pixme.storage.StorageService;
import app.pixme.store.CreditService;
import app.pixme.support.InMemoryStorageService;
import app.pixme.support.IntegrationTest;
import app.pixme.support.TestFixtures;
import app.pixme.user.UserService;
import app.pixme.user.domain.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;

/**
 * The whole daily loop, end to end: photo → character → published PIXME →
 * visible in someone else's feed → standing in the square.
 *
 * <p>Runs against the stub AI provider and in-memory storage, so it exercises
 * every piece of our own logic — allowance, upload consumption, the pipeline
 * state machine, publish, ranking, placement — without touching a paid
 * provider or an object store.
 */
@IntegrationTest
@Import(InMemoryStorageService.Config.class)
class GenerationFlowIntegrationTest {

    @Autowired
    private GenerationService generationService;

    @Autowired
    private PixelPostService postService;

    @Autowired
    private FeedService feedService;

    @Autowired
    private SquareService squareService;

    @Autowired
    private CreditService creditService;

    @Autowired
    private UserService userService;

    @Autowired
    private StorageService storageService;

    @Autowired
    private TestFixtures fixtures;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    /**
     * Clears today's published content before each run.
     *
     * <p>The feed deliberately shows a ranked, diversity-mixed <em>page</em> of
     * ten, so with leftover data from earlier runs a specific post legitimately
     * might not appear — the assertion would be flaky for the right reasons.
     * Starting from an empty day makes "my PIXME shows up" a real assertion
     * rather than a probabilistic one.
     */
    @org.junit.jupiter.api.BeforeEach
    void clearTodaysContent() {
        jdbc.update("delete from feed_exposures");
        jdbc.update("delete from square_placements");
        jdbc.update("delete from reactions");
        jdbc.update("delete from pixel_post_tags");
        jdbc.update("delete from pixel_posts");
    }

    @Test
    @DisplayName("사진 한 장이 캐릭터가 되고, 광장과 다른 사람의 피드에 나타난다")
    void fullDailyLoop() {
        User author = fixtures.activeUser("loop1");
        User viewer = fixtures.activeUser("loop2");

        // --- 1. the client asks for an upload slot and PUTs the photo --------
        GenerationService.UploadTicket ticket =
                generationService.createUpload(author.getId(), "image/jpeg", 12_345);
        assertThat(ticket.uploadUrl()).isNotBlank();

        UUID uploadId = ticket.uploadId();
        // The id handed to the client is our row id, never the storage key.
        assertThat(uploadId.toString()).doesNotContain("originals/");

        InMemoryStorageService storage = (InMemoryStorageService) storageService;
        storage.putOriginal(captureObjectKey(author, uploadId), fakeJpeg());

        // --- 2. generation ---------------------------------------------------
        assertThat(creditService.allowance(author.getId()).freeAvailable()).isTrue();

        PixelGeneration started = generationService.start(
                author.getId(), uploadId, PixelStyle.PIXME_BASIC);

        assertThat(started.isUsedFreeGeneration()).isTrue();
        assertThat(started.isUsedCredit()).isFalse();
        // The free slot is spent up front, so a parallel request can't also use it.
        assertThat(creditService.allowance(author.getId()).freeAvailable()).isFalse();

        await().atMost(Duration.ofSeconds(20))
                .pollInterval(Duration.ofMillis(200))
                .until(() -> generationService
                        .get(author.getId(), started.getId())
                        .getStatus()
                        .isTerminal());

        PixelGeneration finished = generationService.get(author.getId(), started.getId());
        assertThat(finished.getStatus()).isEqualTo(GenerationStatus.COMPLETED);
        assertThat((int) finished.getProgress()).isEqualTo(100);
        assertThat(finished.getGeneratedObjectKey()).isNotNull();
        assertThat(storage.hasCharacter(finished.getGeneratedObjectKey())).isTrue();
        // The analysis is stored so a retry can reuse the outfit.
        assertThat(finished.getAnalysisJson()).isNotBlank();

        // --- 3. publish ------------------------------------------------------
        PixelPost post = postService.publish(
                author.getId(),
                finished.getId(),
                new PixelPostService.PublishCommand(
                        "오늘은 그냥 산책.", "HAPPY", List.of("산책", "카페"), false));

        assertThat(post.isRepresentative()).isTrue();
        assertThat(userService.statsOf(author.getId()).getPixelCount()).isEqualTo(1);

        // --- 4. it shows up in someone else's feed ---------------------------
        FeedService.FeedPage feed = feedService.today(viewer.getId(), null, 10);
        assertThat(feed.posts()).extracting(PixelPost::getId).contains(post.getId());

        // --- 5. and it is standing in the square at a stable coordinate ------
        SquareService.SquareView square = squareService.today(viewer.getId(), 40);
        assertThat(square.scene()).isNotNull();

        var occupant = square.occupants().stream()
                .filter(entry -> entry.post().getId().equals(post.getId()))
                .findFirst();
        assertThat(occupant).isPresent();

        int firstX = occupant.get().placement().getX();
        int firstY = occupant.get().placement().getY();

        // Refreshing must not teleport the crowd.
        SquareService.SquareView again = squareService.today(viewer.getId(), 40);
        var sameOccupant = again.occupants().stream()
                .filter(entry -> entry.post().getId().equals(post.getId()))
                .findFirst()
                .orElseThrow();

        assertThat(sameOccupant.placement().getX()).isEqualTo(firstX);
        assertThat(sameOccupant.placement().getY()).isEqualTo(firstY);
    }

    @Test
    @DisplayName("사용한 사진으로는 다시 생성할 수 없다")
    void uploadIsSingleUse() {
        User author = fixtures.activeUser("once1");

        UUID uploadId = generationService
                .createUpload(author.getId(), "image/jpeg", 100)
                .uploadId();
        ((InMemoryStorageService) storageService)
                .putOriginal(captureObjectKey(author, uploadId), fakeJpeg());

        generationService.start(author.getId(), uploadId, PixelStyle.PIXME_BASIC);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> generationService.start(
                        author.getId(), uploadId, PixelStyle.PIXME_BASIC))
                .isInstanceOf(app.pixme.common.ApiException.class)
                .extracting(error -> ((app.pixme.common.ApiException) error).code())
                .isEqualTo(app.pixme.common.ErrorCode.UPLOAD_ALREADY_USED);
    }

    @Test
    @DisplayName("잠긴 스타일로는 생성할 수 없다")
    void lockedStyleIsRefused() {
        User author = fixtures.activeUser("lockd");

        UUID uploadId = generationService
                .createUpload(author.getId(), "image/jpeg", 100)
                .uploadId();

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> generationService.start(
                        author.getId(), uploadId, PixelStyle.Y2K_PIXEL))
                .isInstanceOf(app.pixme.common.ApiException.class)
                .extracting(error -> ((app.pixme.common.ApiException) error).code())
                .isEqualTo(app.pixme.common.ErrorCode.STYLE_NOT_UNLOCKED);
    }

    @Test
    @DisplayName("지원하지 않는 이미지 형식은 업로드 단계에서 막는다")
    void rejectsUnsupportedMimeType() {
        User author = fixtures.activeUser("mime1");

        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                        generationService.createUpload(author.getId(), "image/gif", 100))
                .isInstanceOf(app.pixme.common.ApiException.class);
    }

    /* -------------------------------------------------------------- helpers */

    /**
     * The storage key is intentionally not exposed to clients, so the test
     * reads it back from the upload row the service created.
     */
    @Autowired
    private app.pixme.pixel.repository.PixelUploadRepository uploadRepository;

    private String captureObjectKey(User author, UUID uploadId) {
        return uploadRepository
                .findByIdAndUserId(uploadId, author.getId())
                .orElseThrow()
                .getObjectKey();
    }

    /** Minimal JPEG header — the stub provider only looks at the byte length. */
    private byte[] fakeJpeg() {
        byte[] bytes = new byte[512];
        bytes[0] = (byte) 0xFF;
        bytes[1] = (byte) 0xD8;
        bytes[2] = (byte) 0xFF;
        bytes[bytes.length - 2] = (byte) 0xFF;
        bytes[bytes.length - 1] = (byte) 0xD9;
        return bytes;
    }
}
