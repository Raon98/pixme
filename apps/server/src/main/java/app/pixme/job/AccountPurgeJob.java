package app.pixme.job;

import java.time.Instant;
import java.util.List;

import app.pixme.chat.ChatService;
import app.pixme.config.PixmeProperties;
import app.pixme.connection.ConnectionService;
import app.pixme.notification.NotificationService;
import app.pixme.pixel.domain.PixelCharacter;
import app.pixme.pixel.repository.PixelCharacterRepository;
import app.pixme.pixel.repository.PixelGenerationRepository;
import app.pixme.pixel.repository.PixelUploadRepository;
import app.pixme.storage.StorageService;
import app.pixme.user.IdentityFingerprint;
import app.pixme.user.domain.DeletedAccountFingerprint;
import app.pixme.user.domain.User;
import app.pixme.user.repository.DeletedAccountFingerprintRepository;
import app.pixme.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hard-deletes accounts past the deletion grace period.
 *
 * <p>Deletion is two-phase on purpose. The moment a user asks, they disappear
 * from every public surface and their nickname is released — that part is
 * immediate and is handled in the request path. This job is the second phase:
 * after the grace period (during which signing back in restores the account),
 * it removes the data itself — characters, original photos, posts, generations,
 * uploads, messages, push tokens and finally the row.
 *
 * <p>Object storage is cleared <em>before</em> the database rows, because the
 * rows are what tell us which objects to delete. Doing it the other way round
 * orphans files that nothing then knows about.
 */
@Component
public class AccountPurgeJob {

    private static final Logger log = LoggerFactory.getLogger(AccountPurgeJob.class);

    private final UserRepository userRepository;
    private final PixelCharacterRepository characterRepository;
    private final PixelGenerationRepository generationRepository;
    private final PixelUploadRepository uploadRepository;
    private final ChatService chatService;
    private final ConnectionService connectionService;
    private final NotificationService notificationService;
    private final StorageService storage;
    private final PixmeProperties properties;
    private final DeletedAccountFingerprintRepository fingerprintRepository;

    public AccountPurgeJob(
            UserRepository userRepository,
            PixelCharacterRepository characterRepository,
            PixelGenerationRepository generationRepository,
            PixelUploadRepository uploadRepository,
            ChatService chatService,
            ConnectionService connectionService,
            NotificationService notificationService,
            StorageService storage,
            PixmeProperties properties,
            DeletedAccountFingerprintRepository fingerprintRepository) {
        this.userRepository = userRepository;
        this.characterRepository = characterRepository;
        this.generationRepository = generationRepository;
        this.uploadRepository = uploadRepository;
        this.chatService = chatService;
        this.connectionService = connectionService;
        this.notificationService = notificationService;
        this.storage = storage;
        this.properties = properties;
        this.fingerprintRepository = fingerprintRepository;
    }

    @Scheduled(cron = "0 0 5 * * *")
    public void run() {
        Instant threshold = Instant.now().minus(properties.privacy().deletionGracePeriod());
        List<User> purgeable = userRepository.findPurgeable(threshold);

        for (User user : purgeable) {
            try {
                purge(user);
            } catch (RuntimeException exception) {
                log.error("failed to purge user={}", user.getId(), exception);
            }
        }
        if (!purgeable.isEmpty()) {
            log.info("purged {} account(s)", purgeable.size());
        }
    }

    @Transactional
    void purge(User user) {
        var userId = user.getId();

        // 1. Storage objects, while we still know their keys.
        for (PixelCharacter character : characterRepository.findByUserId(userId)) {
            storage.deleteCharacter(character.getCharacterObjectKey());
            if (character.hasOriginal()) {
                storage.deleteOriginal(character.getOriginalObjectKey());
            }
        }
        generationRepository.findByUserId(userId).forEach(generation -> {
            storage.deleteOriginal(generation.getOriginalObjectKey());
            storage.deleteCharacter(generation.getGeneratedObjectKey());
        });
        uploadRepository.findByUserId(userId)
                .forEach(upload -> storage.deleteOriginal(upload.getObjectKey()));

        // 2. Relationships and conversations.
        connectionService.peerIds(userId)
                .forEach(peerId -> connectionService.sever(userId, peerId));
        chatService.purgeForUser(userId);
        notificationService.removeAllTokens(userId);

        // 3. A fingerprint of who this *was*, so a re-signup with the same
        //    social identity after this point does not get onboarding's free
        //    generation and retry all over again. Written before the delete,
        //    in the same transaction, so a crash between the two never leaves
        //    a purged account without its fingerprint recorded.
        String hash = IdentityFingerprint.of(user.getProvider().name(), user.getProviderUserId());
        if (!fingerprintRepository.existsByIdentityHash(hash)) {
            fingerprintRepository.save(
                    DeletedAccountFingerprint.of(hash, user.getProvider().name()));
        }

        // 4. The account row. Every satellite table cascades from here, which
        //    is why the FKs are declared ON DELETE CASCADE.
        userRepository.delete(user);
        log.info("hard-deleted account user={}", userId);
    }
}
