package app.pixme.user;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.UUID;

import app.pixme.ai.PixelStyle;
import app.pixme.ai.PromptLibrary;
import app.pixme.common.ServiceClock;
import app.pixme.connection.ConnectionService;
import app.pixme.pixel.PixelCharacterService;
import app.pixme.pixel.domain.GenerationStatus;
import app.pixme.pixel.domain.PixelGeneration;
import app.pixme.pixel.repository.PixelGenerationRepository;
import app.pixme.storage.StorageService;
import app.pixme.store.domain.StorePlatform;
import app.pixme.store.domain.SpendKind;
import app.pixme.store.domain.Subscription;
import app.pixme.store.domain.SubscriptionStatus;
import app.pixme.store.repository.SubscriptionRepository;
import app.pixme.user.domain.ReservedSignupAssignment;
import app.pixme.user.domain.User;
import app.pixme.user.repository.ReservedSignupAssignmentRepository;
import app.pixme.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * "When this email signs up, give them X" — applied the moment the account
 * is actually created, not before. Three admin/reviewer identities are
 * seeded this way today (see {@code V10__reserved_signup_assignments.sql}):
 * two already-master accounts each get a Current PIXME waiting for them, and
 * one non-master reviewer account additionally gets a real, synthetic
 * PIXME+ subscription.
 *
 * <p>Runs after the sign-up transaction commits, in its own
 * {@code REQUIRES_NEW} transaction — see {@link ReservedSignupEvent} for why
 * the timing is load-bearing. It also means a seed-data hiccup (storage down,
 * a missing classpath asset) cannot block a real person's sign-up, which
 * sharing the caller's transaction would risk.
 */
@Service
public class ReservedSignupService {

    private static final Logger log = LoggerFactory.getLogger(ReservedSignupService.class);

    /** "영구" in practice — a century out, rather than a literal unbounded value. */
    private static final Instant FOREVER =
            ZonedDateTime.now().plusYears(100).toInstant();

    /**
     * The two reviewer/admin identities that should already know each other
     * the moment both have signed up — no wave, no quota, just connected.
     * Checked from both directions as each half of the pair completes their
     * own sign-up, whichever happens second triggers it.
     */
    private static final Map<String, String> AUTO_CONNECT_PARTNER = Map.of(
            "cheol1998@kakao.com", "ahdzz11@naver.com",
            "ahdzz11@naver.com", "cheol1998@kakao.com");

    private final ReservedSignupAssignmentRepository assignmentRepository;
    private final StorageService storage;
    private final PixelGenerationRepository generationRepository;
    private final PixelCharacterService characterService;
    private final SubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private final ConnectionService connectionService;
    private final ServiceClock clock;

    public ReservedSignupService(
            ReservedSignupAssignmentRepository assignmentRepository,
            StorageService storage,
            PixelGenerationRepository generationRepository,
            PixelCharacterService characterService,
            SubscriptionRepository subscriptionRepository,
            UserRepository userRepository,
            ConnectionService connectionService,
            ServiceClock clock) {
        this.assignmentRepository = assignmentRepository;
        this.storage = storage;
        this.generationRepository = generationRepository;
        this.characterService = characterService;
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
        this.connectionService = connectionService;
        this.clock = clock;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onReservedSignup(ReservedSignupEvent event) {
        userRepository.findById(event.userId()).ifPresent(this::apply);
    }

    private void apply(User user) {
        // Social sign-in can leave this null *or* empty, depending on provider.
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            return;
        }
        ReservedSignupAssignment assignment = assignmentRepository
                .findByEmailIgnoreCase(user.getEmail())
                .orElse(null);
        if (assignment == null || assignment.isApplied()) {
            return;
        }

        try {
            if (assignment.getCharacterAssetKey() != null) {
                seedCharacter(user.getId(), assignment.getCharacterAssetKey());
            }
            if (assignment.isGrantPlusForever()) {
                grantPermanentPlus(user.getId());
            }
            assignment.markApplied();
            assignmentRepository.save(assignment);
            log.info("applied reserved signup assignment for {}", user.getEmail());

            connectIfPartnerReady(user);
        } catch (RuntimeException exception) {
            // Not re-thrown: a cosmetic seed failing must never look like a
            // broken sign-up to the person who just created an account.
            log.error("reserved signup assignment failed for {}", user.getEmail(), exception);
        }
    }

    /** Whichever of the two signs up second is the one that finds the other already applied. */
    private void connectIfPartnerReady(User user) {
        String partnerEmail = AUTO_CONNECT_PARTNER.get(user.getEmail().toLowerCase());
        if (partnerEmail == null) {
            return;
        }
        userRepository.findByEmailIgnoreCase(partnerEmail).ifPresent(partner -> {
            boolean partnerReady = assignmentRepository
                    .findByEmailIgnoreCase(partnerEmail)
                    .map(ReservedSignupAssignment::isApplied)
                    .orElse(false);
            if (partnerReady) {
                connectionService.connectDirectly(user.getId(), partner.getId());
            }
        });
    }

    private void seedCharacter(UUID userId, String assetKey) {
        byte[] png;
        try {
            png = new ClassPathResource("pixme/seed-characters/" + assetKey + ".png")
                    .getInputStream().readAllBytes();
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("missing seed character asset: " + assetKey, exception);
        }

        String objectKey = "seed/%s-%s.png".formatted(assetKey, userId);
        storage.putCharacter(objectKey, png, "image/png");

        LocalDate today = clock.today();
        PixelGeneration generation = PixelGeneration.create(
                userId,
                // No real original photo exists for a seeded character —
                // this key is never read, since `keep` is called with
                // keepOriginal=false below, but the column is NOT NULL.
                "seed/no-original-" + userId,
                PixelStyle.PIXME_BASIC,
                "seed",
                PromptLibrary.VERSION,
                today,
                (short) 1);
        generation.setGeneratedObjectKey(objectKey);
        generation.setStatus(GenerationStatus.COMPLETED);
        generation.setProgress((short) 100);
        generation.setSpendKind(SpendKind.MASTER);
        generation.setCompletedAt(Instant.now());
        generationRepository.saveAndFlush(generation);

        // Goes through the real application service — not hand-rolled — so
        // it gets the same Collection-count bump and UserCurrentPixel
        // pointer a normal "keep" would.
        characterService.keep(userId, generation.getId(), true, false, null);
    }

    private void grantPermanentPlus(UUID userId) {
        Subscription subscription = Subscription.create(
                userId,
                "PLUS_MONTHLY",
                StorePlatform.IOS,
                "seed-" + userId,
                SubscriptionStatus.ACTIVE,
                FOREVER);
        subscriptionRepository.save(subscription);
    }
}
