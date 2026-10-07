package app.pixme.pixel;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.ai.AiProviderRegistry;
import app.pixme.ai.PixelStyle;
import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.common.RateLimiter;
import app.pixme.common.ServiceClock;
import app.pixme.config.PixmeProperties;
import app.pixme.pixel.domain.GenerationFailureReason;
import app.pixme.pixel.domain.PixelGeneration;
import app.pixme.pixel.domain.PixelUpload;
import app.pixme.pixel.repository.PixelGenerationRepository;
import app.pixme.pixel.repository.PixelUploadRepository;
import app.pixme.storage.StorageService;
import app.pixme.store.CreditService;
import app.pixme.store.repository.UserUnlockRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Orchestrates photo → character.
 *
 * <p>Two properties drive the whole design:
 *
 * <ol>
 *   <li><b>The user must never pay for a character they didn't get.</b> The
 *       allowance is spent up front (so concurrent requests can't both slip
 *       through), and <em>every</em> non-success terminal state returns it —
 *       provider error, timeout, crash, or a photo the safety screen rejects.
 *       The reaper covers the case where the process dies mid-flight.
 *   <li><b>The request must not block on the provider.</b> Generation takes
 *       tens of seconds, so the API returns a QUEUED generation immediately and
 *       the client polls. Progress is reported from the actual pipeline stage,
 *       not a timer, so the loading copy matches reality.
 * </ol>
 */
@Service
public class GenerationService {

    private static final Logger log = LoggerFactory.getLogger(GenerationService.class);

    /** A generation still unfinished after this is considered dead. */
    private static final Duration STUCK_AFTER = Duration.ofMinutes(5);

    private final PixelGenerationRepository generationRepository;
    private final PixelUploadRepository uploadRepository;
    private final UserUnlockRepository unlockRepository;
    private final AiProviderRegistry providers;
    private final StorageService storage;
    private final CreditService credits;
    private final ServiceClock clock;
    private final RateLimiter rateLimiter;
    private final PixmeProperties properties;
    private final GenerationPipeline pipeline;
    private final ApplicationEventPublisher events;

    public GenerationService(
            PixelGenerationRepository generationRepository,
            PixelUploadRepository uploadRepository,
            UserUnlockRepository unlockRepository,
            AiProviderRegistry providers,
            StorageService storage,
            CreditService credits,
            ServiceClock clock,
            RateLimiter rateLimiter,
            PixmeProperties properties,
            GenerationPipeline pipeline,
            ApplicationEventPublisher events) {
        this.generationRepository = generationRepository;
        this.uploadRepository = uploadRepository;
        this.unlockRepository = unlockRepository;
        this.providers = providers;
        this.storage = storage;
        this.credits = credits;
        this.clock = clock;
        this.rateLimiter = rateLimiter;
        this.properties = properties;
        this.pipeline = pipeline;
        this.events = events;
    }

    /* ------------------------------------------------------------- uploads */

    /**
     * What the client needs to upload a photo.
     *
     * <p>Note that {@code uploadId} is our row id, not the storage key: the
     * key is never exposed to clients, so one upload URL can't be used to
     * guess another.
     */
    public record UploadTicket(
            UUID uploadId,
            String uploadUrl,
            java.util.Map<String, String> headers,
            Instant expiresAt) {}

    /**
     * Issues a pre-signed PUT so the photo goes straight to private storage.
     * The API deliberately never receives the image bytes — it is the most
     * sensitive data in the product and there is no reason for it to pass
     * through the application tier.
     */
    @Transactional
    public UploadTicket createUpload(UUID userId, String mimeType, long byteSize) {
        String resolvedMime = normalizeMimeType(mimeType);

        StorageService.PresignedUpload presigned = storage.presignOriginalUpload(
                userId, resolvedMime, properties.storage().uploadUrlTtl());

        Instant expiresAt = Instant.now().plus(properties.storage().uploadUrlTtl());
        PixelUpload upload = PixelUpload.create(
                userId,
                presigned.objectKey(),
                resolvedMime,
                byteSize,
                // The row outlives the signed URL so an abandoned upload is
                // still reapable after the URL has expired.
                expiresAt.plus(properties.storage().uploadUrlTtl().multipliedBy(5)));
        uploadRepository.save(upload);

        return new UploadTicket(
                upload.getId(), presigned.url(), presigned.headers(), expiresAt);
    }

    /* ---------------------------------------------------------- generation */

    /**
     * Starts a generation and returns it in {@code QUEUED} state.
     *
     * <p>Everything that can fail cheaply (ownership, style entitlement, daily
     * cap, allowance) is checked before any provider call or charge.
     */
    @Transactional
    public PixelGeneration start(UUID userId, UUID uploadId, PixelStyle style) {
        rateLimiter.check(
                "generation",
                userId,
                properties.rateLimit().generationPerHour(),
                Duration.ofHours(1));

        PixelUpload upload = uploadRepository
                .findByIdAndUserId(uploadId, userId)
                .orElseThrow(() -> new ApiException(ErrorCode.UPLOAD_NOT_FOUND));

        if (upload.isConsumed()) {
            throw new ApiException(ErrorCode.UPLOAD_ALREADY_USED);
        }
        requireStyleUnlocked(userId, style);

        LocalDate today = clock.today();
        long todayCount = generationRepository.countByUserIdAndPostDate(userId, today);
        if (todayCount >= properties.generation().maxPerDay()) {
            throw new ApiException(ErrorCode.DAILY_GENERATION_LIMIT);
        }

        PixelGeneration generation = PixelGeneration.create(
                userId,
                upload.getObjectKey(),
                style,
                providers.active().name(),
                properties.ai().promptVersion(),
                today,
                (short) (todayCount + 1));

        // Charge before dispatching: two parallel requests must not both see
        // the last credit as available.
        CreditService.SpendKind spend = credits.spendForGeneration(userId, generation.getId());
        generation.setUsedFreeGeneration(spend == CreditService.SpendKind.FREE_DAILY);
        generation.setUsedCredit(spend == CreditService.SpendKind.PAID_CREDIT);

        upload.markConsumed();
        uploadRepository.save(upload);
        generationRepository.save(generation);

        // Dispatch only after this transaction commits — otherwise the worker
        // races the commit and finds no row.
        events.publishEvent(new GenerationQueuedEvent(generation.getId()));

        return generation;
    }

    /**
     * Re-renders an existing generation's analysis under a (possibly different)
     * style — the "다시 만들어보기" path.
     *
     * <p>Reuses the stored analysis rather than re-reading the photo: cheaper,
     * faster, and it keeps the outfit identical while only the rendering
     * varies, which is what the user is actually asking for.
     */
    @Transactional
    public PixelGeneration retry(UUID userId, UUID sourceGenerationId, PixelStyle style) {
        PixelGeneration source = generationRepository
                .findByIdAndUserId(sourceGenerationId, userId)
                .orElseThrow(() -> ApiException.notFound("생성 기록"));

        requireStyleUnlocked(userId, style);

        LocalDate today = clock.today();
        long todayCount = generationRepository.countByUserIdAndPostDate(userId, today);
        if (todayCount >= properties.generation().maxPerDay()) {
            throw new ApiException(ErrorCode.DAILY_GENERATION_LIMIT);
        }

        PixelGeneration generation = PixelGeneration.create(
                userId,
                source.getOriginalObjectKey(),
                style,
                providers.active().name(),
                properties.ai().promptVersion(),
                today,
                (short) (todayCount + 1));
        generation.setAnalysisJson(source.getAnalysisJson());

        CreditService.SpendKind spend = credits.spendForGeneration(userId, generation.getId());
        generation.setUsedFreeGeneration(spend == CreditService.SpendKind.FREE_DAILY);
        generation.setUsedCredit(spend == CreditService.SpendKind.PAID_CREDIT);

        generationRepository.save(generation);

        events.publishEvent(new GenerationQueuedEvent(generation.getId()));

        return generation;
    }

    @Transactional(readOnly = true)
    public PixelGeneration get(UUID userId, UUID generationId) {
        return generationRepository
                .findByIdAndUserId(generationId, userId)
                .orElseThrow(() -> ApiException.notFound("PIXME 생성"));
    }

    @Transactional(readOnly = true)
    public Optional<PixelGeneration> latestUnpublishedCandidate(UUID userId) {
        List<PixelGeneration> candidates =
                generationRepository.findUnpublishedCandidates(userId, clock.today());
        return candidates.isEmpty() ? Optional.empty() : Optional.of(candidates.get(0));
    }

    /* -------------------------------------------------- failure management */

    /**
     * Fails a generation and returns what it consumed. Delegates to
     * {@link GenerationPipeline} so the transactional boundaries (and the
     * refund) are identical whether the failure came from the worker, from the
     * reaper, or from an operator.
     */
    public void fail(UUID generationId, GenerationFailureReason reason, String message) {
        pipeline.fail(generationId, reason, message);
    }

    /**
     * Fails generations whose worker died (deploy, crash, OOM) so a paid credit
     * is never silently swallowed. Scheduled; see {@code MaintenanceJobs}.
     */
    @Transactional(readOnly = true)
    public int reapStuckGenerations() {
        List<PixelGeneration> stuck =
                generationRepository.findStuck(Instant.now().minus(STUCK_AFTER));

        for (PixelGeneration generation : stuck) {
            pipeline.fail(
                    generation.getId(),
                    GenerationFailureReason.TIMEOUT,
                    "worker did not finish");
        }
        if (!stuck.isEmpty()) {
            log.warn("reaped {} stuck generation(s)", stuck.size());
        }
        return stuck.size();
    }

    /* ------------------------------------------------------------- helpers */

    private void requireStyleUnlocked(UUID userId, PixelStyle style) {
        if (style.isFree()) {
            return;
        }
        boolean owned = unlockRepository
                .findCodesByUserId(userId)
                .contains(style.unlockCode());
        if (!owned) {
            throw new ApiException(ErrorCode.STYLE_NOT_UNLOCKED);
        }
    }

    private String normalizeMimeType(String mimeType) {
        if (mimeType == null) {
            return "image/jpeg";
        }
        return switch (mimeType.toLowerCase()) {
            case "image/png" -> "image/png";
            case "image/webp" -> "image/webp";
            case "image/heic", "image/heif" -> "image/heic";
            case "image/jpeg", "image/jpg" -> "image/jpeg";
            default -> throw new ApiException(
                    ErrorCode.VALIDATION_FAILED, "지원하지 않는 이미지 형식이에요.");
        };
    }
}
