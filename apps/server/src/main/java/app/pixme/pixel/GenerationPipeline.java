package app.pixme.pixel;

import java.util.Optional;
import java.util.UUID;

import app.pixme.ai.AiProviderRegistry;
import app.pixme.ai.GeneratedCharacter;
import app.pixme.ai.GenerationRequest;
import app.pixme.ai.ImageAnalysis;
import app.pixme.ai.PixelImageProvider;
import app.pixme.ai.SafetyVerdict;
import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.pixel.domain.GenerationFailureReason;
import app.pixme.pixel.domain.GenerationStatus;
import app.pixme.pixel.domain.PixelGeneration;
import app.pixme.pixel.repository.PixelGenerationRepository;
import app.pixme.storage.S3StorageService;
import app.pixme.storage.StorageService;
import app.pixme.store.CreditService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs one generation: safety screen → analysis → render → store.
 *
 * <p>Deliberately a separate bean from {@link GenerationService}. The stage
 * methods need {@code REQUIRES_NEW} so each step commits independently (the
 * client is polling for progress, and a late failure must not roll back the
 * earlier states). Spring's transaction advice is proxy-based, so those
 * annotations would be silently ignored if the pipeline called them on
 * {@code this} from inside the same class — a trap that is invisible until
 * something needs to roll back and doesn't.
 */
@Component
public class GenerationPipeline {

    private static final Logger log = LoggerFactory.getLogger(GenerationPipeline.class);

    private final PixelGenerationRepository generationRepository;
    private final AiProviderRegistry providers;
    private final StorageService storage;
    private final CreditService credits;
    private final ObjectMapper objectMapper;
    private final GenerationNotifier notifier;

    public GenerationPipeline(
            PixelGenerationRepository generationRepository,
            AiProviderRegistry providers,
            StorageService storage,
            CreditService credits,
            ObjectMapper objectMapper,
            GenerationNotifier notifier) {
        this.generationRepository = generationRepository;
        this.providers = providers;
        this.storage = storage;
        this.credits = credits;
        this.objectMapper = objectMapper;
        this.notifier = notifier;
    }

    /**
     * The pipeline body. Runs on a virtual thread, outside any request
     * transaction.
     *
     * <p>Each stage persists its progress so the client's loading copy tracks
     * the real pipeline position rather than a fabricated animation. Every
     * failure path funnels through {@link #fail} so the refund behaviour is
     * identical no matter where it broke.
     */
    public void run(UUID generationId) {
        PixelGeneration generation = generationRepository.findById(generationId).orElse(null);
        if (generation == null) {
            // The row should always be committed before dispatch; if it isn't,
            // the stuck-generation reaper will pick it up and refund.
            log.warn("generation={} not found at dispatch time", generationId);
            return;
        }
        if (generation.getStatus().isTerminal()) {
            return;
        }

        try {
            updateProgress(generationId, (short) 10);

            byte[] original = storage.getOriginal(generation.getOriginalObjectKey());
            PixelImageProvider provider = providers.active();

            /* --- safety screen, before anything is rendered ---------------- */
            updateProgress(generationId, (short) 25);
            SafetyVerdict verdict = provider.checkSafety(original, "image/jpeg");
            if (!verdict.allowed()) {
                log.info(
                        "generation={} rejected by safety screen: {}",
                        generationId,
                        verdict.category());
                fail(generationId, GenerationFailureReason.UNSAFE_IMAGE, verdict.reason());
                return;
            }

            /* --- analysis --------------------------------------------------- */
            updateProgress(generationId, (short) 45);
            ImageAnalysis analysis = readStoredAnalysis(generation)
                    .orElseGet(() -> provider.analyzeImage(original, "image/jpeg"));

            if (!analysis.personDetected()) {
                fail(
                        generationId,
                        GenerationFailureReason.NO_PERSON_DETECTED,
                        "no person in frame");
                return;
            }

            /* --- render ----------------------------------------------------- */
            updateProgress(generationId, (short) 70);
            GenerationRequest request = new GenerationRequest(
                    generationId,
                    generation.getUserId(),
                    original,
                    "image/jpeg",
                    generation.getStyle(),
                    analysis,
                    generation.getPromptVersion(),
                    // Stable per generation, so a re-render stays coherent with
                    // what the user already saw.
                    generationId.getLeastSignificantBits());

            GeneratedCharacter character = generation.getAnalysisJson() != null
                    ? provider.generateVariant(request)
                    : provider.generateCharacter(request);

            /* --- persist ---------------------------------------------------- */
            updateProgress(generationId, (short) 90);
            String objectKey = S3StorageService.characterKey(generation.getUserId(), generationId);
            storage.putCharacter(objectKey, character.image(), character.mimeType());

            complete(generationId, objectKey, character);
            notifier.onGenerationCompleted(generation.getUserId(), generationId);

        } catch (ApiException exception) {
            GenerationFailureReason reason = exception.code() == ErrorCode.UNSAFE_IMAGE
                    ? GenerationFailureReason.UNSAFE_IMAGE
                    : GenerationFailureReason.PROVIDER_ERROR;
            fail(generationId, reason, exception.getMessage());
        } catch (RuntimeException exception) {
            log.error("generation={} failed unexpectedly", generationId, exception);
            fail(generationId, GenerationFailureReason.INTERNAL, exception.getMessage());
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void updateProgress(UUID generationId, short progress) {
        generationRepository.findById(generationId).ifPresent(generation -> {
            if (generation.getStatus().isTerminal()) {
                return;
            }
            generation.markProcessing(progress);
            generation.setStatus(GenerationStatus.PROCESSING);
            generationRepository.save(generation);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(UUID generationId, String objectKey, GeneratedCharacter character) {
        generationRepository.findById(generationId).ifPresent(generation -> {
            generation.markCompleted(
                    objectKey, character.model(), serializeAnalysis(character.analysis()));
            generationRepository.save(generation);
        });
    }

    /**
     * Marks a generation failed and returns whatever it consumed.
     *
     * <p>The refund itself runs in its own transaction inside
     * {@link CreditService}, so it survives even if this one rolls back — the
     * user's money is the one thing we cannot afford to lose here.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(UUID generationId, GenerationFailureReason reason, String message) {
        PixelGeneration generation = generationRepository.findById(generationId).orElse(null);
        if (generation == null || generation.getStatus().isTerminal()) {
            return;
        }

        generation.markFailed(reason, message);

        if (generation.getStatus().warrantsRefund()) {
            if (generation.isUsedCredit() && generation.getCreditRefundedAt() == null) {
                if (credits.refundForGeneration(generation.getUserId(), generationId)) {
                    generation.markRefunded();
                }
            } else if (generation.isUsedFreeGeneration()
                    && generation.getCreditRefundedAt() == null) {
                credits.restoreFreeGeneration(generation.getUserId());
                generation.markRefunded();
            }
        }

        generationRepository.save(generation);
        notifier.onGenerationFailed(generation.getUserId(), generationId, reason);
    }

    private Optional<ImageAnalysis> readStoredAnalysis(PixelGeneration generation) {
        if (generation.getAnalysisJson() == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(
                    objectMapper.readValue(generation.getAnalysisJson(), ImageAnalysis.class));
        } catch (Exception exception) {
            // A stored analysis that no longer parses (schema change) is not
            // fatal — fall back to re-analysing the photo.
            log.warn("could not read stored analysis for generation={}", generation.getId());
            return Optional.empty();
        }
    }

    private String serializeAnalysis(ImageAnalysis analysis) {
        if (analysis == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(analysis);
        } catch (Exception exception) {
            log.warn("could not serialise analysis", exception);
            return null;
        }
    }
}
