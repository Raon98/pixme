package app.pixme.api;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import app.pixme.api.dto.DailyStatusDtos;
import app.pixme.api.dto.EntitlementsResponse;
import app.pixme.api.dto.MeResponse;
import app.pixme.api.dto.PixelDtos;
import app.pixme.api.dto.SocialDtos;
import app.pixme.api.dto.UserDtos;
import app.pixme.chat.domain.Message;
import app.pixme.connection.ConnectionService;
import app.pixme.dailystatus.DailyStatusService;
import app.pixme.dailystatus.domain.DailyStatus;
import app.pixme.notification.domain.Notification;
import app.pixme.pixel.domain.PixelCharacter;
import app.pixme.pixel.domain.PixelGeneration;
import app.pixme.pixel.domain.UserCurrentPixel;
import app.pixme.pixel.repository.PixelCharacterRepository;
import app.pixme.pixel.repository.UserCurrentPixelRepository;
import app.pixme.reaction.repository.ReactionRepository;
import app.pixme.safety.repository.BlockRepository;
import app.pixme.storage.StorageService;
import app.pixme.store.StoreService;
import app.pixme.user.UserService;
import app.pixme.user.domain.User;
import app.pixme.user.domain.UserProfile;
import app.pixme.user.domain.UserSettings;
import app.pixme.user.domain.UserStats;
import app.pixme.user.repository.UserProfileRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Entity → DTO mapping.
 *
 * <p>Centralised for two reasons. First, batching: a feed page needs author
 * profiles, current characters, tags and the viewer's hearts, and doing that
 * per card is the classic N+1 that makes an image feed feel slow — the
 * {@code statuses(...)} method resolves all of it in a fixed number of
 * queries.
 *
 * <p>Second, and more important: this is the one place where the private
 * original photo could leak into a response. No {@code DailyStatus} or
 * {@code PixelCharacter} mapping here ever populates an original URL — that is
 * reachable only through {@code PixelCharacterService#originalUrl}'s dedicated,
 * owner-only endpoint.
 */
@Component
public class ResponseAssembler {

    private final UserProfileRepository profileRepository;
    private final PixelCharacterRepository characterRepository;
    private final UserCurrentPixelRepository currentPixelRepository;
    private final DailyStatusService dailyStatusService;
    private final ReactionRepository reactionRepository;
    private final BlockRepository blockRepository;
    private final StorageService storage;
    private final ConnectionService connectionService;
    private final StoreService storeService;
    private final UserService userService;

    public ResponseAssembler(
            UserProfileRepository profileRepository,
            PixelCharacterRepository characterRepository,
            UserCurrentPixelRepository currentPixelRepository,
            DailyStatusService dailyStatusService,
            ReactionRepository reactionRepository,
            BlockRepository blockRepository,
            StorageService storage,
            ConnectionService connectionService,
            StoreService storeService,
            UserService userService) {
        this.profileRepository = profileRepository;
        this.characterRepository = characterRepository;
        this.currentPixelRepository = currentPixelRepository;
        this.dailyStatusService = dailyStatusService;
        this.reactionRepository = reactionRepository;
        this.blockRepository = blockRepository;
        this.storage = storage;
        this.connectionService = connectionService;
        this.storeService = storeService;
        this.userService = userService;
    }

    /* ----------------------------------------------------------------- me */

    @Transactional(readOnly = true)
    public MeResponse me(User user) {
        UUID userId = user.getId();
        UserProfile profile = userService.profileOf(userId);
        UserStats stats = userService.statsOf(userId);
        UserSettings settings = userService.settingsOf(userId);
        StoreService.Entitlements entitlements = storeService.entitlements(userId);

        return new MeResponse(
                userId.toString(),
                user.getProvider().name(),
                profile.getNickname(),
                profile.getBio(),
                profile.getBirthDate() == null ? null : profile.getBirthDate().toString(),
                user.getStatus().name(),
                userService.isProfileCompleted(userId),
                userService.interestsOf(userId),
                representativeUrl(userId),
                new MeResponse.StatsResponse(
                        stats.getReceivedHeartCount(),
                        stats.getConnectionCount(),
                        stats.getPixelCount(),
                        stats.getStreakDays()),
                entitlements(entitlements),
                new MeResponse.SettingsResponse(
                        settings.isPushHeart(),
                        settings.isPushConnectionRequest(),
                        settings.isPushConnected(),
                        settings.isPushMessage(),
                        settings.isPushDailyReminder(),
                        settings.isKeepOriginalPhoto()),
                user.getCreatedAt());
    }

    public EntitlementsResponse entitlements(StoreService.Entitlements entitlements) {
        return new EntitlementsResponse(
                entitlements.plusActive(),
                entitlements.plusExpiresAt(),
                entitlements.firstGenerationAvailable(),
                entitlements.firstRetryAvailable(),
                entitlements.bonusFreeCredits(),
                entitlements.creditBalance(),
                entitlements.nextGenerationIsFree(),
                List.copyOf(entitlements.unlockedStyles()),
                List.copyOf(entitlements.unlockedDecorations()));
    }

    /* ----------------------------------------------------- daily statuses */

    /** Batched mapping for a feed page, a history grid, or a curation rail. */
    @Transactional(readOnly = true)
    public List<DailyStatusDtos.StatusResponse> statuses(UUID viewerId, List<DailyStatus> statuses) {
        if (statuses.isEmpty()) {
            return List.of();
        }

        List<UUID> statusIds = statuses.stream().map(DailyStatus::getId).toList();
        List<UUID> authorIds = statuses.stream().map(DailyStatus::getUserId).distinct().toList();
        List<UUID> characterIds =
                statuses.stream().map(DailyStatus::getPixelCharacterId).distinct().toList();

        Map<UUID, UserProfile> profiles = new HashMap<>();
        profileRepository.findByUserIdIn(authorIds)
                .forEach(profile -> profiles.put(profile.getUserId(), profile));

        Map<UUID, PixelCharacter> charactersById = new HashMap<>();
        characterRepository.findAllById(characterIds)
                .forEach(character -> charactersById.put(character.getId(), character));

        Map<UUID, List<String>> tags = dailyStatusService.tagsOf(statusIds);

        Set<UUID> hearted =
                new HashSet<>(reactionRepository.findHeartedDailyStatusIds(viewerId, statusIds));

        // Representative characters for author avatars, resolved in one pass.
        Map<UUID, String> representativeUrls = resolveRepresentativeUrls(authorIds);

        Map<UUID, String> relations = new HashMap<>();
        for (UUID authorId : authorIds) {
            relations.put(
                    authorId,
                    authorId.equals(viewerId)
                            ? ConnectionService.RelationStatus.NONE.name()
                            : connectionService.relationStatus(viewerId, authorId).name());
        }

        List<DailyStatusDtos.StatusResponse> responses = new ArrayList<>(statuses.size());
        for (DailyStatus status : statuses) {
            UserProfile profile = profiles.get(status.getUserId());
            PixelCharacter character = charactersById.get(status.getPixelCharacterId());
            responses.add(new DailyStatusDtos.StatusResponse(
                    status.getId().toString(),
                    new PixelDtos.AuthorResponse(
                            status.getUserId().toString(),
                            nicknameOf(profile),
                            representativeUrls.get(status.getUserId()),
                            relations.get(status.getUserId())),
                    character == null ? null : storage.characterUrl(character.getCharacterObjectKey()),
                    status.getMood(),
                    status.getMessage(),
                    tags.getOrDefault(status.getId(), List.of()),
                    status.getHeartCount(),
                    hearted.contains(status.getId()),
                    status.isFreshCharacter(),
                    status.getStatusDate().toString(),
                    status.getCreatedAt()));
        }
        return responses;
    }

    @Transactional(readOnly = true)
    public DailyStatusDtos.StatusResponse status(UUID viewerId, DailyStatus status) {
        return statuses(viewerId, List.of(status)).get(0);
    }

    public List<DailyStatusDtos.StatusSummaryResponse> statusSummaries(List<DailyStatus> statuses) {
        if (statuses.isEmpty()) {
            return List.of();
        }
        List<UUID> characterIds =
                statuses.stream().map(DailyStatus::getPixelCharacterId).distinct().toList();
        Map<UUID, PixelCharacter> charactersById = new HashMap<>();
        characterRepository.findAllById(characterIds)
                .forEach(character -> charactersById.put(character.getId(), character));

        List<DailyStatusDtos.StatusSummaryResponse> responses = new ArrayList<>(statuses.size());
        for (DailyStatus status : statuses) {
            PixelCharacter character = charactersById.get(status.getPixelCharacterId());
            responses.add(new DailyStatusDtos.StatusSummaryResponse(
                    status.getId().toString(),
                    character == null ? null : storage.characterUrl(character.getCharacterObjectKey()),
                    status.getStatusDate().toString(),
                    status.getMood(),
                    status.getHeartCount()));
        }
        return responses;
    }

    /* --------------------------------------------------------- generation */

    public PixelDtos.GenerationResponse generation(PixelGeneration generation) {
        return new PixelDtos.GenerationResponse(
                generation.getId().toString(),
                generation.getStatus().name(),
                generation.getStyle().name(),
                generation.getProgress(),
                storage.characterUrl(generation.getGeneratedObjectKey()),
                generation.getFailureReason() == null
                        ? null
                        : generation.getFailureReason().name(),
                generation.getSpendKind().name(),
                generation.isUsedFreeGeneration(),
                generation.isUsedCredit(),
                generation.getRetryOfGenerationId() == null
                        ? null
                        : generation.getRetryOfGenerationId().toString(),
                generation.getCreatedAt(),
                generation.getCompletedAt());
    }

    /* ---------------------------------------------------------- character */

    public PixelDtos.CharacterResponse character(PixelCharacter character, UUID currentCharacterId) {
        return new PixelDtos.CharacterResponse(
                character.getId().toString(),
                storage.characterUrl(character.getCharacterObjectKey()),
                character.getStyle().name(),
                character.getLabel(),
                character.getId().equals(currentCharacterId),
                character.hasOriginal(),
                character.getCreatedAt());
    }

    public List<PixelDtos.CharacterResponse> characters(
            List<PixelCharacter> characters, UUID currentCharacterId) {
        List<PixelDtos.CharacterResponse> responses = new ArrayList<>(characters.size());
        for (PixelCharacter character : characters) {
            responses.add(character(character, currentCharacterId));
        }
        return responses;
    }

    /* ------------------------------------------------------------ profile */

    @Transactional(readOnly = true)
    public UserDtos.PublicProfileResponse publicProfile(
            UUID viewerId,
            User target,
            DailyStatus todayStatus,
            List<DailyStatus> recentStatuses,
            UUID conversationId) {

        UUID targetId = target.getId();
        UserProfile profile = userService.profileOf(targetId);
        UserStats stats = userService.statsOf(targetId);

        boolean blockedByMe = blockRepository
                .findBlockedAmong(viewerId, List.of(targetId))
                .contains(targetId);

        boolean heartedToday = todayStatus != null
                && !reactionRepository
                        .findHeartedDailyStatusIds(viewerId, List.of(todayStatus.getId()))
                        .isEmpty();

        return new UserDtos.PublicProfileResponse(
                targetId.toString(),
                nicknameOf(profile),
                profile.getBio(),
                userService.interestsOf(targetId),
                representativeUrl(targetId),
                todayStatus == null ? null : status(viewerId, todayStatus),
                statusSummaries(recentStatuses),
                new UserDtos.PublicProfileResponse.PublicStats(
                        stats.getReceivedHeartCount(), stats.getPixelCount()),
                new UserDtos.RelationResponse(
                        targetId.equals(viewerId),
                        connectionService.relationStatus(viewerId, targetId).name(),
                        conversationId == null ? null : conversationId.toString(),
                        heartedToday,
                        blockedByMe));
    }

    @Transactional(readOnly = true)
    public PixelDtos.AuthorResponse author(UUID viewerId, UUID userId) {
        UserProfile profile = profileRepository.findById(userId).orElse(null);
        return new PixelDtos.AuthorResponse(
                userId.toString(),
                nicknameOf(profile),
                representativeUrl(userId),
                userId.equals(viewerId)
                        ? ConnectionService.RelationStatus.NONE.name()
                        : connectionService.relationStatus(viewerId, userId).name());
    }

    /* --------------------------------------------------------------- chat */

    public SocialDtos.MessageResponse message(Message message) {
        return new SocialDtos.MessageResponse(
                message.getId().toString(),
                message.getConversationId().toString(),
                message.getSenderId() == null ? null : message.getSenderId().toString(),
                message.getType().name(),
                message.getContent(),
                message.getCreatedAt(),
                message.getReadAt());
    }

    /* ------------------------------------------------------ notifications */

    public SocialDtos.NotificationResponse notification(Notification notification) {
        return new SocialDtos.NotificationResponse(
                notification.getId().toString(),
                notification.getType().name(),
                notification.getTitle(),
                notification.getBody(),
                storage.characterUrl(notification.getImageObjectKey()),
                notification.getDeepLink(),
                notification.getReadAt(),
                notification.getCreatedAt());
    }

    /* ------------------------------------------------------------ helpers */

    private String nicknameOf(UserProfile profile) {
        if (profile == null || profile.getNickname() == null || profile.getNickname().isBlank()) {
            // A deleted account's nickname is released; show a neutral label
            // rather than leaking the old one or an empty string.
            return "알 수 없음";
        }
        return profile.getNickname();
    }

    private String representativeUrl(UUID userId) {
        return currentPixelRepository
                .findByUserId(userId)
                .map(UserCurrentPixel::getPixelCharacterId)
                .flatMap(characterRepository::findAlive)
                .map(character -> storage.characterUrl(character.getCharacterObjectKey()))
                .orElse(null);
    }

    private Map<UUID, String> resolveRepresentativeUrls(List<UUID> userIds) {
        Map<UUID, UUID> currentCharacterIds = new HashMap<>();
        for (Object[] row : currentPixelRepository.findCharacterIdsByUserIds(userIds)) {
            currentCharacterIds.put((UUID) row[0], (UUID) row[1]);
        }

        Map<UUID, String> byCharacterId = new HashMap<>();
        if (!currentCharacterIds.isEmpty()) {
            characterRepository.findAllById(currentCharacterIds.values())
                    .forEach(character -> byCharacterId.put(
                            character.getId(), storage.characterUrl(character.getCharacterObjectKey())));
        }

        Map<UUID, String> byUserId = new HashMap<>();
        for (Map.Entry<UUID, UUID> entry : currentCharacterIds.entrySet()) {
            byUserId.put(entry.getKey(), byCharacterId.get(entry.getValue()));
        }
        return byUserId;
    }
}
