package app.pixme.job;

import java.time.Instant;
import java.util.List;

import app.pixme.auth.repository.RefreshTokenRepository;
import app.pixme.common.ServiceClock;
import app.pixme.config.PixmeProperties;
import app.pixme.feed.FeedExposureRepository;
import app.pixme.pixel.GenerationService;
import app.pixme.pixel.domain.PixelCharacter;
import app.pixme.pixel.domain.PixelUpload;
import app.pixme.pixel.repository.PixelCharacterRepository;
import app.pixme.pixel.repository.PixelUploadRepository;
import app.pixme.square.SquareService;
import app.pixme.storage.StorageService;
import app.pixme.store.StoreService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Background maintenance.
 *
 * <p>Several of these are not housekeeping but correctness guarantees that the
 * request path cannot provide on its own:
 * <ul>
 *   <li><b>Stuck generations</b> — if a worker dies mid-flight the user has paid
 *       and received nothing. This is what makes the refund promise hold across
 *       deploys and crashes, not just across handled errors.
 *   <li><b>Original retention</b> — the privacy policy says photos are kept for
 *       a bounded time. Nothing in the request path ever deletes them on
 *       schedule, so this job <em>is</em> the policy.
 *   <li><b>Subscription reconciliation</b> — stores notify unreliably; polling
 *       is what stops a lapsed subscription from granting access forever.
 * </ul>
 */
@Component
public class MaintenanceJobs {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceJobs.class);

    /** Exposure and placement history older than this is never read again. */
    private static final int HISTORY_KEEP_DAYS = 3;

    private final GenerationService generationService;
    private final PixelUploadRepository uploadRepository;
    private final PixelCharacterRepository characterRepository;
    private final FeedExposureRepository exposureRepository;
    private final SquareService squareService;
    private final StoreService storeService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final StorageService storage;
    private final ServiceClock clock;
    private final PixmeProperties properties;

    public MaintenanceJobs(
            GenerationService generationService,
            PixelUploadRepository uploadRepository,
            PixelCharacterRepository characterRepository,
            FeedExposureRepository exposureRepository,
            SquareService squareService,
            StoreService storeService,
            RefreshTokenRepository refreshTokenRepository,
            StorageService storage,
            ServiceClock clock,
            PixmeProperties properties) {
        this.generationService = generationService;
        this.uploadRepository = uploadRepository;
        this.characterRepository = characterRepository;
        this.exposureRepository = exposureRepository;
        this.squareService = squareService;
        this.storeService = storeService;
        this.refreshTokenRepository = refreshTokenRepository;
        this.storage = storage;
        this.clock = clock;
        this.properties = properties;
    }

    /**
     * Fails generations whose worker never finished, returning the credit.
     *
     * <p>Runs often, because the user is sitting on a loading screen.
     */
    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void reapStuckGenerations() {
        try {
            generationService.reapStuckGenerations();
        } catch (RuntimeException exception) {
            log.error("stuck-generation reaper failed", exception);
        }
    }

    /** Deletes originals for uploads the user abandoned before generating. */
    @Scheduled(cron = "0 15 * * * *")
    @Transactional
    public void reapAbandonedUploads() {
        List<PixelUpload> abandoned = uploadRepository.findAbandoned(Instant.now());
        for (PixelUpload upload : abandoned) {
            storage.deleteOriginal(upload.getObjectKey());
            uploadRepository.delete(upload);
        }
        if (!abandoned.isEmpty()) {
            log.info("reaped {} abandoned upload(s)", abandoned.size());
        }
    }

    /**
     * Enforces the original-photo retention window.
     *
     * <p>The character and the user's record survive; only the photograph is
     * removed. Users who opted out of retention never reach this job — their
     * original is deleted at publish time.
     */
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void purgeExpiredOriginals() {
        Instant threshold = Instant.now().minus(properties.privacy().originalRetention());
        List<PixelCharacter> expired = characterRepository.findWithExpiredOriginals(threshold);

        for (PixelCharacter character : expired) {
            storage.deleteOriginal(character.getOriginalObjectKey());
            character.forgetOriginal();
            characterRepository.save(character);
        }
        if (!expired.isEmpty()) {
            log.info("purged {} original photo(s) past retention", expired.size());
        }
    }

    /** Keeps discovery bookkeeping bounded. */
    @Scheduled(cron = "0 0 4 * * *")
    @Transactional
    public void pruneDiscoveryHistory() {
        int exposures = exposureRepository.deleteOlderThan(
                clock.today().minusDays(HISTORY_KEEP_DAYS));
        int placements = squareService.pruneOldPlacements(HISTORY_KEEP_DAYS);
        log.info("pruned {} exposure(s) and {} placement(s)", exposures, placements);
    }

    /** Reconciles store subscription state and pays out monthly credit grants. */
    @Scheduled(cron = "0 10 * * * *")
    public void reconcileSubscriptions() {
        try {
            int expired = storeService.expireLapsedSubscriptions();
            int granted = storeService.grantPendingSubscriptionCredits();
            if (expired > 0 || granted > 0) {
                log.info("subscriptions: {} expired, {} credit grant(s)", expired, granted);
            }
        } catch (RuntimeException exception) {
            log.error("subscription reconciliation failed", exception);
        }
    }

    @Scheduled(cron = "0 45 4 * * *")
    @Transactional
    public void deleteExpiredRefreshTokens() {
        int removed = refreshTokenRepository.deleteExpired(Instant.now());
        if (removed > 0) {
            log.info("deleted {} expired refresh token(s)", removed);
        }
    }
}
