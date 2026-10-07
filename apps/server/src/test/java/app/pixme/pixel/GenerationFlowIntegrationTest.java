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
import app.pixme.dailystatus.DailyStatusService;
import app.pixme.dailystatus.domain.DailyStatus;
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
    private PixelCharacterService characterService;

    @Autowired
    private DailyStatusService dailyStatusService;

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

    @Autowired
    private app.pixme.ai.MasterCharacterReference masterReference;

    @Autowired
    private GenerationPipeline pipeline;

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
        jdbc.update("delete from square_presence");
        jdbc.update("delete from reactions");
        jdbc.update("delete from daily_status_tags");
        jdbc.update("delete from daily_status");
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
        assertThat(creditService.allowance(author.getId()).firstGenerationAvailable()).isTrue();

        PixelGeneration started = generationService.start(
                author.getId(), uploadId, PixelStyle.PIXME_BASIC, "req-" + UUID.randomUUID());

        assertThat(started.getSpendKind())
                .isEqualTo(app.pixme.store.domain.SpendKind.FREE_FIRST);
        assertThat(started.isUsedFreeGeneration()).isTrue();
        assertThat(started.isUsedCredit()).isFalse();
        // Charged up front, so a parallel request can't also claim it.
        assertThat(creditService.allowance(author.getId()).firstGenerationAvailable()).isFalse();

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

        // --- 3. keep as the Current PIXME, with today's status -------------
        characterService.keep(author.getId(), finished.getId(), true, true, null);
        dailyStatusService.upsertStatus(
                author.getId(), "HAPPY", "오늘은 그냥 산책.", List.of("산책", "카페"), null);

        assertThat(userService.statsOf(author.getId()).getPixelCount()).isEqualTo(1);

        // Opt in to the square so presence actually registers.
        userService.updateProfile(
                author.getId(),
                new UserService.UpdateProfileCommand(
                        null, null, null, false, null,
                        new UserService.SettingsPatch(
                                null, null, null, null, null, null, true)));

        // --- 4. it shows up in someone else's feed ---------------------------
        FeedService.FeedPage feed = feedService.today(viewer.getId(), null, 10);
        DailyStatus myStatus = dailyStatusService.today(author.getId()).orElseThrow();
        assertThat(feed.statuses()).extracting(DailyStatus::getId).contains(myStatus.getId());

        // --- 5. and it is standing in the square at a stable coordinate ------
        squareService.recordPresenceIfVisible(author.getId());
        SquareService.SquareView square = squareService.today(viewer.getId(), 40);
        assertThat(square.scene()).isNotNull();

        var occupant = square.occupants().stream()
                .filter(entry -> entry.presence().getUserId().equals(author.getId()))
                .findFirst();
        assertThat(occupant).isPresent();

        int firstX = occupant.get().placement().getX();
        int firstY = occupant.get().placement().getY();

        // Refreshing must not teleport the crowd.
        SquareService.SquareView again = squareService.today(viewer.getId(), 40);
        var sameOccupant = again.occupants().stream()
                .filter(entry -> entry.presence().getUserId().equals(author.getId()))
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

        generationService.start(author.getId(), uploadId, PixelStyle.PIXME_BASIC, null);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> generationService.start(
                        author.getId(), uploadId, PixelStyle.PIXME_BASIC, null))
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
                        author.getId(), uploadId, PixelStyle.Y2K_PIXEL, null))
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

    @Test
    @DisplayName("같은 clientRequestId로 두 번 눌러도 생성은 하나다")
    void generateIsIdempotentOnClientRequestId() {
        User author = fixtures.activeUser("idemp");

        UUID uploadId = generationService
                .createUpload(author.getId(), "image/jpeg", 100)
                .uploadId();
        ((InMemoryStorageService) storageService)
                .putOriginal(captureObjectKey(author, uploadId), fakeJpeg());

        String requestId = "req-" + UUID.randomUUID();
        PixelGeneration first = generationService.start(
                author.getId(), uploadId, PixelStyle.PIXME_BASIC, requestId);
        PixelGeneration replay = generationService.start(
                author.getId(), uploadId, PixelStyle.PIXME_BASIC, requestId);

        assertThat(replay.getId()).isEqualTo(first.getId());
        // And crucially, the replay did not spend a second allowance.
        assertThat(creditService.allowance(author.getId()).bonusFreeCredits()).isEqualTo(1);
    }

    @Test
    @DisplayName("첫 캐릭터 재생성은 무료이고, 두 후보를 비교할 수 있다")
    void firstRetryIsFreeAndOffersBothCandidates() {
        User author = fixtures.activeUser("cmp");

        UUID uploadId = generationService
                .createUpload(author.getId(), "image/jpeg", 100)
                .uploadId();
        ((InMemoryStorageService) storageService)
                .putOriginal(captureObjectKey(author, uploadId), fakeJpeg());

        PixelGeneration first = generationService.start(
                author.getId(), uploadId, PixelStyle.PIXME_BASIC, null);
        awaitTerminal(author, first.getId());

        PixelGeneration retry = generationService.retry(
                author.getId(), first.getId(), PixelStyle.PIXME_BASIC, null);

        assertThat(retry.getSpendKind())
                .isEqualTo(app.pixme.store.domain.SpendKind.FREE_FIRST_RETRY);
        assertThat(retry.getRetryOfGenerationId()).isEqualTo(first.getId());
        // The retry reuses the stored analysis — same outfit, new render.
        // (Re-read the original: the analysis is written by the pipeline, so
        // the entity returned by `start` predates it.)
        PixelGeneration firstCompleted = generationService.get(author.getId(), first.getId());
        assertThat(retry.getAnalysisJson()).isEqualTo(firstCompleted.getAnalysisJson());
        assertThat(retry.getAnalysisJson()).isNotBlank();

        awaitTerminal(author, retry.getId());

        var candidates = generationService.candidatesFor(author.getId(), retry.getId());
        assertThat(candidates).extracting(PixelGeneration::getId)
                .containsExactly(first.getId(), retry.getId());

        // The bonus credit is untouched: the retry is its own currency.
        assertThat(creditService.allowance(author.getId()).bonusFreeCredits()).isEqualTo(1);
    }

    @Test
    @DisplayName("생성된 캐릭터는 마스터 레퍼런스 규격으로 정규화된다")
    void generatedCharacterIsNormalisedToTheReferenceSpec() throws Exception {
        User author = fixtures.activeUser("norm");

        UUID uploadId = generationService
                .createUpload(author.getId(), "image/jpeg", 100)
                .uploadId();
        InMemoryStorageService storage = (InMemoryStorageService) storageService;
        storage.putOriginal(captureObjectKey(author, uploadId), fakeJpeg());

        PixelGeneration generation = generationService.start(
                author.getId(), uploadId, PixelStyle.PIXME_BASIC, null);
        awaitTerminal(author, generation.getId());

        byte[] stored = storage.character(
                generationService.get(author.getId(), generation.getId())
                        .getGeneratedObjectKey());
        var image = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(stored));

        var spec = masterReference.spec();
        assertThat(image.getWidth()).isEqualTo(spec.canvasSize());
        assertThat(image.getHeight()).isEqualTo(spec.canvasSize());
    }

    @Test
    @DisplayName("재생성은 기존 캐릭터를 덮어쓰지 않고 둘 다 남긴다")
    void retryKeepsBothCharacters() {
        User author = fixtures.activeUser("keep");
        PixelGeneration first = generateOnce(author);
        awaitTerminal(author, first.getId());

        PixelGeneration retry = generationService.retry(
                author.getId(), first.getId(), PixelStyle.PIXME_BASIC, null);
        awaitTerminal(author, retry.getId());

        // Both survive and are offered side by side; nothing was overwritten.
        var candidates = generationService.candidatesFor(author.getId(), retry.getId());
        assertThat(candidates).hasSize(2);
        assertThat(candidates)
                .allSatisfy(candidate ->
                        assertThat(candidate.getGeneratedObjectKey()).isNotNull());
    }

    @Test
    @DisplayName("새 결과가 나왔다면 기존 캐릭터를 골라도 생성권은 소비된다")
    void choosingTheOlderCandidateStillConsumesTheAllowance() {
        User author = fixtures.activeUser("chose");

        PixelGeneration first = generateOnce(author);
        awaitTerminal(author, first.getId());

        PixelGeneration retry = generationService.retry(
                author.getId(), first.getId(), PixelStyle.PIXME_BASIC, null);
        awaitTerminal(author, retry.getId());

        CreditService.Allowance beforePublish = creditService.allowance(author.getId());

        // The user compares and keeps the ORIGINAL character.
        characterService.keep(author.getId(), first.getId(), true, true, null);

        // The AI did its job, so the attempt is paid for either way. Refunding
        // on "I preferred the first one" would make retrying free in practice.
        CreditService.Allowance afterPublish = creditService.allowance(author.getId());
        assertThat(afterPublish).isEqualTo(beforePublish);
        assertThat(afterPublish.firstRetryAvailable()).isFalse();
        assertThat(afterPublish.bonusFreeCredits()).isEqualTo(1);
    }

    @Test
    @DisplayName("생성 자체가 실패하면 생성권은 자동으로 복구된다")
    void failedGenerationRefundsTheAllowance() {
        User author = fixtures.activeUser("fail");

        // Spend the first generation and the retry so the next attempt is paid.
        creditService.spendForGeneration(author.getId(), UUID.randomUUID());
        creditService.spendForFirstRetry(author.getId(), UUID.randomUUID());
        creditService.spendForGeneration(author.getId(), UUID.randomUUID()); // bonus

        creditService.grant(
                author.getId(), 1, app.pixme.store.domain.CreditReason.PURCHASE, null);

        PixelGeneration generation = generateOnce(author);
        assertThat(generation.getSpendKind())
                .isEqualTo(app.pixme.store.domain.SpendKind.PAID_CREDIT);
        assertThat(creditService.allowance(author.getId()).creditBalance()).isZero();

        awaitTerminal(author, generation.getId());

        // A provider or server failure must never cost the user anything.
        pipeline.fail(
                generation.getId(),
                app.pixme.pixel.domain.GenerationFailureReason.PROVIDER_ERROR,
                "simulated provider outage");

        // (Already COMPLETED here, so force the path the reaper would take.)
        PixelGeneration failed = failFreshGeneration(author);
        assertThat(creditService.allowance(author.getId()).creditBalance()).isEqualTo(1);
        assertThat(generationService.get(author.getId(), failed.getId()).getCreditRefundedAt())
                .isNotNull();
    }

    /** Starts a generation and fails it before the worker can complete it. */
    private PixelGeneration failFreshGeneration(User author) {
        creditService.grant(
                author.getId(), 1, app.pixme.store.domain.CreditReason.PROMOTION, null);

        UUID uploadId = generationService
                .createUpload(author.getId(), "image/jpeg", 100)
                .uploadId();
        // Deliberately do NOT store the original: the pipeline cannot read it,
        // which is exactly the shape of a storage or provider failure.
        PixelGeneration generation = generationService.start(
                author.getId(), uploadId, PixelStyle.PIXME_BASIC, null);

        await().atMost(Duration.ofSeconds(20))
                .pollInterval(Duration.ofMillis(200))
                .until(() -> generationService
                        .get(author.getId(), generation.getId())
                        .getStatus()
                        .isTerminal());

        return generation;
    }

    private PixelGeneration generateOnce(User author) {
        UUID uploadId = generationService
                .createUpload(author.getId(), "image/jpeg", 100)
                .uploadId();
        ((InMemoryStorageService) storageService)
                .putOriginal(captureObjectKey(author, uploadId), fakeJpeg());
        return generationService.start(author.getId(), uploadId, PixelStyle.PIXME_BASIC, null);
    }

    private void awaitTerminal(User author, UUID generationId) {
        await().atMost(Duration.ofSeconds(20))
                .pollInterval(Duration.ofMillis(200))
                .until(() -> generationService
                        .get(author.getId(), generationId)
                        .getStatus()
                        .isTerminal());
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
