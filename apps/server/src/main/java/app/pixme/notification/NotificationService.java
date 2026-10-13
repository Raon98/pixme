package app.pixme.notification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executor;

import app.pixme.chat.ChatEventPublisher;
import app.pixme.chat.domain.Message;
import app.pixme.chat.domain.MessageType;
import app.pixme.common.Cursors;
import app.pixme.config.AsyncConfig;
import app.pixme.connection.ConnectionNotifier;
import app.pixme.connection.domain.Connection;
import app.pixme.notification.domain.Notification;
import app.pixme.notification.domain.NotificationType;
import app.pixme.notification.domain.PushPlatform;
import app.pixme.notification.domain.PushToken;
import app.pixme.notification.repository.NotificationRepository;
import app.pixme.notification.repository.PushTokenRepository;
import app.pixme.pixel.GenerationNotifier;
import app.pixme.pixel.domain.GenerationFailureReason;
import app.pixme.dailystatus.domain.DailyStatus;
import app.pixme.dailystatus.repository.DailyStatusRepository;
import app.pixme.pixel.domain.PixelCharacter;
import app.pixme.pixel.domain.UserCurrentPixel;
import app.pixme.pixel.repository.PixelCharacterRepository;
import app.pixme.pixel.repository.UserCurrentPixelRepository;
import app.pixme.reaction.ReactionNotifier;
import app.pixme.reaction.repository.ReactionRepository;
import app.pixme.user.domain.UserProfile;
import app.pixme.user.domain.UserSettings;
import app.pixme.user.repository.UserProfileRepository;
import app.pixme.user.repository.UserSettingsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Notification centre and push fan-out.
 *
 * <p>The single implementation of every domain notifier hook, which keeps all
 * the "should we even tell them?" judgement in one reviewable place. The
 * guiding rule is that PIXME is a quiet app:
 *
 * <ul>
 *   <li><b>Hearts are grouped.</b> Ten hearts on one post is one notification
 *       that updates in place, not ten. Hearts are the most frequent event in
 *       the product and the fastest route to an app people mute.
 *   <li><b>Waves are anonymous.</b> "누군가 친해지고 싶어해요" never names the
 *       sender — revealing them before mutual consent would make not waving
 *       back socially costly.
 *   <li><b>Per-type opt-out is honoured on the server.</b> A disabled type is
 *       not pushed <em>and</em> not even written, so turning it off actually
 *       makes it go away.
 *   <li><b>Only messages and connections make a sound.</b>
 * </ul>
 */
@Service
public class NotificationService
        implements ReactionNotifier, ConnectionNotifier, GenerationNotifier, ChatEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final PushTokenRepository pushTokenRepository;
    private final UserProfileRepository profileRepository;
    private final UserSettingsRepository settingsRepository;
    private final DailyStatusRepository statusRepository;
    private final PixelCharacterRepository characterRepository;
    private final UserCurrentPixelRepository currentPixelRepository;
    private final ReactionRepository reactionRepository;
    private final PushSender pushSender;
    private final Executor executor;

    public NotificationService(
            NotificationRepository notificationRepository,
            PushTokenRepository pushTokenRepository,
            UserProfileRepository profileRepository,
            UserSettingsRepository settingsRepository,
            DailyStatusRepository statusRepository,
            PixelCharacterRepository characterRepository,
            UserCurrentPixelRepository currentPixelRepository,
            ReactionRepository reactionRepository,
            PushSender pushSender,
            @Qualifier(AsyncConfig.NOTIFICATION_EXECUTOR) Executor executor) {
        this.notificationRepository = notificationRepository;
        this.pushTokenRepository = pushTokenRepository;
        this.profileRepository = profileRepository;
        this.settingsRepository = settingsRepository;
        this.statusRepository = statusRepository;
        this.characterRepository = characterRepository;
        this.currentPixelRepository = currentPixelRepository;
        this.reactionRepository = reactionRepository;
        this.pushSender = pushSender;
        this.executor = executor;
    }

    /* ------------------------------------------------------------- hearts */

    @Override
    @Transactional
    public void onHeartReceived(UUID authorId, UUID fromUserId, UUID dailyStatusId) {
        if (!settingOf(authorId).map(UserSettings::isPushHeart).orElse(true)) {
            return;
        }

        String groupKey = "HEART:" + dailyStatusId;
        long heartCount = reactionRepository.countByDailyStatusId(dailyStatusId);

        String title = "♡ 좋아요를 받았어요";
        String body = heartCount <= 1
                ? "누군가 오늘의 PIXME에 좋아요를 눌렀어요."
                : "%d명이 오늘의 PIXME에 좋아요를 눌렀어요.".formatted(heartCount);

        String imageKey = statusRepository
                .findById(dailyStatusId)
                .map(DailyStatus::getPixelCharacterId)
                .flatMap(characterRepository::findAlive)
                .map(PixelCharacter::getCharacterObjectKey)
                .orElse(null);

        Notification notification = notificationRepository
                .findByUserIdAndGroupKey(authorId, groupKey)
                .map(existing -> {
                    existing.refresh(title, body);
                    return existing;
                })
                .orElseGet(() -> Notification.create(
                        authorId,
                        NotificationType.HEART,
                        title,
                        body,
                        imageKey,
                        "/daily-status/" + dailyStatusId,
                        groupKey));

        notificationRepository.save(notification);

        // Only push on the first heart of a group. Subsequent hearts update the
        // in-app row silently — the user doesn't need a buzz per heart.
        if (heartCount <= 1) {
            push(authorId, title, body, "/daily-status/" + dailyStatusId, false, "default");
        }
    }

    /* -------------------------------------------------------- connections */

    @Override
    @Transactional
    public void onConnected(Connection connection, UUID conversationId) {
        notifyConnected(connection.getUserAId(), connection.getUserBId(), connection, conversationId);
        notifyConnected(connection.getUserBId(), connection.getUserAId(), connection, conversationId);
    }

    private void notifyConnected(
            UUID userId, UUID peerId, Connection connection, UUID conversationId) {
        if (!settingOf(userId).map(UserSettings::isPushConnected).orElse(true)) {
            return;
        }

        String peerNickname = nicknameOf(peerId);
        String title = "✨ 둘이 연결됐어요";
        String body = "%s님과 서로 마음이 통했어요. 대화를 시작해보세요.".formatted(peerNickname);
        String deepLink = "/connection-success?connectionId=" + connection.getId();

        notificationRepository.save(Notification.create(
                userId,
                NotificationType.CONNECTED,
                title,
                body,
                representativeKeyOf(peerId),
                deepLink,
                null));

        push(userId, title, body, deepLink, true, "default");
    }

    /* ------------------------------------------------------------ messages */

    @Override
    @Transactional
    public void onMessageSent(Message message, UUID senderId, UUID recipientId) {
        if (message.getType() != MessageType.TEXT) {
            return;
        }
        if (!settingOf(recipientId).map(UserSettings::isPushMessage).orElse(true)) {
            return;
        }

        String senderNickname = nicknameOf(senderId);
        String preview = message.getContent().length() <= 60
                ? message.getContent()
                : message.getContent().substring(0, 59) + "…";
        String deepLink = "/chat/" + message.getConversationId();

        // Messages are not written to the notification centre: the chat list is
        // already the inbox, and duplicating them there would double-count
        // everything the user has to clear.
        push(recipientId, senderNickname, preview, deepLink, true, "message");
    }

    @Override
    public void onRead(UUID conversationId, UUID notifyUserId, UUID lastMessageId, Instant readAt) {
        // Read receipts are realtime-only; the socket layer handles them.
    }

    @Override
    public void onConversationDeactivated(UUID conversationId, UUID userId, UUID peerId) {
        // No notification: being blocked should not be announced to either side.
    }

    /* ---------------------------------------------------------- generation */

    @Override
    @Transactional
    public void onGenerationCompleted(UUID userId, UUID generationId) {
        String title = "오늘의 PIXME가 완성됐어요";
        String body = "지금 바로 광장에 보내볼까요?";

        // The id travels in the link because the result screen reads its
        // generation from an in-memory draft that does not survive the app
        // being closed — opening a bare /create/result from a push showed
        // "실패했어요" for a generation that had in fact succeeded.
        String deepLink = "/create/result?generationId=" + generationId;

        notificationRepository.save(Notification.create(
                userId,
                NotificationType.GENERATION_COMPLETED,
                title,
                body,
                null,
                deepLink,
                "GENERATION:" + generationId));

        // Worth a push: the user may well have left the app while waiting.
        push(userId, title, body, deepLink, false, "default");
    }

    @Override
    @Transactional
    public void onGenerationFailed(
            UUID userId, UUID generationId, GenerationFailureReason reason) {
        if (reason == GenerationFailureReason.UNSAFE_IMAGE
                || reason == GenerationFailureReason.NO_PERSON_DETECTED) {
            // The user is looking at the screen and already has clear in-app
            // copy for these; a push would just repeat it.
            return;
        }

        String title = "이번에는 픽셀로 옮기지 못했어요";
        String body = "생성권은 사용되지 않았어요. 다시 시도해볼까요?";

        notificationRepository.save(Notification.create(
                userId,
                NotificationType.SYSTEM,
                title,
                body,
                null,
                "/create",
                "GENERATION_FAILED:" + generationId));

        push(userId, title, body, "/create", false, "default");
    }

    /* -------------------------------------------------------- daily nudge */

    /**
     * The one proactive nudge PIXME sends, at most once per day, and only to
     * people who have not already published today. Suppression is the whole
     * point: a reminder to do something you have done is what makes people
     * disable notifications.
     */
    @Transactional
    public void sendDailyReminder(UUID userId) {
        if (!settingOf(userId).map(UserSettings::isPushDailyReminder).orElse(true)) {
            return;
        }

        String title = "오늘의 나는 어떤 모습인가요?";
        String body = "사진 한 장으로 오늘의 PIXME를 남겨보세요.";
        String groupKey = "REMINDER:" + java.time.LocalDate.now();

        if (notificationRepository.findByUserIdAndGroupKey(userId, groupKey).isPresent()) {
            return;
        }

        notificationRepository.save(Notification.create(
                userId,
                NotificationType.DAILY_REMINDER,
                title,
                body,
                null,
                "/create",
                groupKey));

        push(userId, title, body, "/create", false, "default");
    }

    /**
     * "Your PIXME is getting a lot of reactions today" — a positive signal
     * worth surfacing, capped to once per post.
     */
    @Transactional
    public void sendReactionSpike(UUID userId, UUID dailyStatusId, long heartCount) {
        String groupKey = "SPIKE:" + dailyStatusId;
        if (notificationRepository.findByUserIdAndGroupKey(userId, groupKey).isPresent()) {
            return;
        }

        String title = "🔥 오늘 PIXME 반응이 좋아요";
        String body = "%d명이 좋아요를 눌렀어요.".formatted(heartCount);

        notificationRepository.save(Notification.create(
                userId,
                NotificationType.REACTION_SPIKE,
                title,
                body,
                statusRepository
                        .findById(dailyStatusId)
                        .map(DailyStatus::getPixelCharacterId)
                        .flatMap(characterRepository::findAlive)
                        .map(PixelCharacter::getCharacterObjectKey)
                        .orElse(null),
                "/daily-status/" + dailyStatusId,
                groupKey));

        push(userId, title, body, "/daily-status/" + dailyStatusId, false, "default");
    }

    /* ----------------------------------------------------------- read side */

    @Transactional(readOnly = true)
    public List<Notification> page(UUID userId, String cursor, int limit) {
        Cursors.Keyset keyset = Cursors.decode(cursor);
        return notificationRepository.findPage(
                userId,
                Cursors.timestampOrOpen(keyset),
                Cursors.idOrOpen(keyset),
                PageRequest.of(0, limit));
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return notificationRepository.countByUserIdAndReadAtIsNull(userId);
    }

    @Transactional
    public void markRead(UUID userId, UUID notificationId) {
        notificationRepository
                .findById(notificationId)
                .filter(notification -> notification.getUserId().equals(userId))
                .ifPresent(notification -> {
                    notification.markRead();
                    notificationRepository.save(notification);
                });
    }

    @Transactional
    public void markAllRead(UUID userId) {
        notificationRepository.markAllRead(userId, Instant.now());
    }

    /* --------------------------------------------------------- push tokens */

    @Transactional
    public void registerToken(
            UUID userId, String token, PushPlatform platform, String appVersion) {
        pushTokenRepository
                .findById(token)
                .ifPresentOrElse(
                        existing -> {
                            existing.reassign(userId, appVersion);
                            pushTokenRepository.save(existing);
                        },
                        () -> pushTokenRepository.save(
                                PushToken.create(token, userId, platform, appVersion)));
    }

    @Transactional
    public void removeToken(UUID userId, String token) {
        pushTokenRepository
                .findById(token)
                .filter(existing -> existing.getUserId().equals(userId))
                .ifPresent(pushTokenRepository::delete);
    }

    @Transactional
    public void removeAllTokens(UUID userId) {
        pushTokenRepository.deleteByUserId(userId);
    }

    /* ------------------------------------------------------------- helpers */

    /**
     * Fans out to the user's devices off the request thread.
     *
     * <p>Push is best-effort by design: the notification row is already
     * committed, so a transport failure costs a buzz, never the user's data.
     */
    private void push(
            UUID userId,
            String title,
            String body,
            String deepLink,
            boolean playSound,
            String channelId) {

        List<PushToken> tokens = pushTokenRepository.findActiveByUserId(userId);
        if (tokens.isEmpty()) {
            return;
        }

        List<PushSender.PushMessage> messages = new ArrayList<>(tokens.size());
        for (PushToken token : tokens) {
            messages.add(new PushSender.PushMessage(
                    token.getToken(),
                    title,
                    body,
                    java.util.Map.of("deepLink", deepLink == null ? "" : deepLink),
                    playSound,
                    channelId));
        }

        executor.execute(() -> {
            List<String> invalid = pushSender.send(messages);
            if (!invalid.isEmpty()) {
                retireTokens(invalid);
            }
        });
    }

    @Transactional
    public void retireTokens(List<String> tokens) {
        tokens.forEach(token -> pushTokenRepository.findById(token).ifPresent(entity -> {
            entity.markInvalid();
            pushTokenRepository.save(entity);
            log.debug("retired dead push token for user={}", entity.getUserId());
        }));
    }

    private Optional<UserSettings> settingOf(UUID userId) {
        return settingsRepository.findById(userId);
    }

    private String nicknameOf(UUID userId) {
        return profileRepository
                .findById(userId)
                .map(UserProfile::getNickname)
                .filter(nickname -> nickname != null && !nickname.isBlank())
                .orElse("누군가");
    }

    private String representativeKeyOf(UUID userId) {
        return currentPixelRepository
                .findByUserId(userId)
                .map(UserCurrentPixel::getPixelCharacterId)
                .flatMap(characterRepository::findAlive)
                .map(PixelCharacter::getCharacterObjectKey)
                .orElse(null);
    }
}
