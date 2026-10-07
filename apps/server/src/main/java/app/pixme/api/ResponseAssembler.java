package app.pixme.api;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import app.pixme.api.dto.EntitlementsResponse;
import app.pixme.api.dto.MeResponse;
import app.pixme.api.dto.PixelDtos;
import app.pixme.api.dto.SocialDtos;
import app.pixme.api.dto.UserDtos;
import app.pixme.chat.domain.Message;
import app.pixme.connection.ConnectionService;
import app.pixme.notification.domain.Notification;
import app.pixme.pixel.domain.PixelGeneration;
import app.pixme.pixel.domain.PixelPost;
import app.pixme.pixel.repository.PixelPostRepository;
import app.pixme.pixel.repository.PixelPostTagRepository;
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
 * profiles, representative characters, tags and the viewer's hearts, and doing
 * that per card is the classic N+1 that makes an image feed feel slow — the
 * {@code posts(...)} method resolves all of it in a fixed number of queries.
 *
 * <p>Second, and more important: this is the one place where the private
 * original photo could leak into a response. {@link #post} never populates it;
 * only {@link #myPost}, which is reachable only from owner-scoped endpoints,
 * does. Keeping that decision in a single file makes it reviewable.
 */
@Component
public class ResponseAssembler {

    private final UserProfileRepository profileRepository;
    private final PixelPostRepository postRepository;
    private final PixelPostTagRepository tagRepository;
    private final ReactionRepository reactionRepository;
    private final BlockRepository blockRepository;
    private final StorageService storage;
    private final ConnectionService connectionService;
    private final StoreService storeService;
    private final UserService userService;

    public ResponseAssembler(
            UserProfileRepository profileRepository,
            PixelPostRepository postRepository,
            PixelPostTagRepository tagRepository,
            ReactionRepository reactionRepository,
            BlockRepository blockRepository,
            StorageService storage,
            ConnectionService connectionService,
            StoreService storeService,
            UserService userService) {
        this.profileRepository = profileRepository;
        this.postRepository = postRepository;
        this.tagRepository = tagRepository;
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
                representativeUrl(profile),
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
                entitlements.freeGenerationAvailable(),
                entitlements.creditBalance(),
                List.copyOf(entitlements.unlockedStyles()),
                List.copyOf(entitlements.unlockedDecorations()));
    }

    /* -------------------------------------------------------------- posts */

    /** Batched mapping for a feed page, a grid, or a curation rail. */
    @Transactional(readOnly = true)
    public List<PixelDtos.PostResponse> posts(UUID viewerId, List<PixelPost> posts) {
        if (posts.isEmpty()) {
            return List.of();
        }

        List<UUID> postIds = posts.stream().map(PixelPost::getId).toList();
        List<UUID> authorIds = posts.stream().map(PixelPost::getUserId).distinct().toList();

        Map<UUID, UserProfile> profiles = new HashMap<>();
        profileRepository.findByUserIdIn(authorIds)
                .forEach(profile -> profiles.put(profile.getUserId(), profile));

        Map<UUID, List<String>> tags = new HashMap<>();
        for (Object[] row : tagRepository.findTagsByPostIds(postIds)) {
            tags.computeIfAbsent((UUID) row[0], key -> new ArrayList<>()).add((String) row[1]);
        }

        Set<UUID> hearted =
                new HashSet<>(reactionRepository.findHeartedPostIds(viewerId, postIds));

        // Representative characters for author avatars, resolved in one pass.
        Map<UUID, String> representativeUrls = resolveRepresentativeUrls(profiles.values());

        Map<UUID, String> relations = new HashMap<>();
        for (UUID authorId : authorIds) {
            relations.put(
                    authorId,
                    authorId.equals(viewerId)
                            ? ConnectionService.RelationStatus.NONE.name()
                            : connectionService.relationStatus(viewerId, authorId).name());
        }

        List<PixelDtos.PostResponse> responses = new ArrayList<>(posts.size());
        for (PixelPost post : posts) {
            UserProfile profile = profiles.get(post.getUserId());
            responses.add(new PixelDtos.PostResponse(
                    post.getId().toString(),
                    new PixelDtos.AuthorResponse(
                            post.getUserId().toString(),
                            nicknameOf(profile),
                            representativeUrls.get(post.getUserId()),
                            relations.get(post.getUserId())),
                    storage.characterUrl(post.getCharacterObjectKey()),
                    post.getCaption(),
                    post.getMood(),
                    tags.getOrDefault(post.getId(), List.of()),
                    post.getStyle().name(),
                    post.getVisibility().name(),
                    post.getHeartCount(),
                    hearted.contains(post.getId()),
                    post.getPostDate().toString(),
                    post.isRepresentative(),
                    post.getCreatedAt()));
        }
        return responses;
    }

    @Transactional(readOnly = true)
    public PixelDtos.PostResponse post(UUID viewerId, PixelPost post) {
        return posts(viewerId, List.of(post)).get(0);
    }

    /**
     * Owner-only mapping.
     *
     * <p>{@code originalImageUrl} is intentionally left null even here — the
     * signed URL is issued only by the dedicated
     * {@code GET /pixels/{id}/original} endpoint, so a list response can never
     * carry a working link to someone's photograph. This DTO only reports
     * <em>whether</em> an original still exists.
     */
    @Transactional(readOnly = true)
    public PixelDtos.MyPostResponse myPost(UUID viewerId, PixelPost post) {
        PixelDtos.PostResponse base = post(viewerId, post);
        return new PixelDtos.MyPostResponse(
                base.id(),
                base.author(),
                base.characterImageUrl(),
                base.caption(),
                base.mood(),
                base.tags(),
                base.style(),
                base.visibility(),
                base.heartCount(),
                base.heartedByMe(),
                base.postDate(),
                base.isRepresentative(),
                base.createdAt(),
                null,
                post.hasOriginal());
    }

    @Transactional(readOnly = true)
    public List<PixelDtos.MyPostResponse> myPosts(UUID viewerId, List<PixelPost> posts) {
        List<PixelDtos.PostResponse> base = posts(viewerId, posts);
        List<PixelDtos.MyPostResponse> responses = new ArrayList<>(base.size());
        for (int index = 0; index < base.size(); index++) {
            PixelDtos.PostResponse current = base.get(index);
            PixelPost entity = posts.get(index);
            responses.add(new PixelDtos.MyPostResponse(
                    current.id(),
                    current.author(),
                    current.characterImageUrl(),
                    current.caption(),
                    current.mood(),
                    current.tags(),
                    current.style(),
                    current.visibility(),
                    current.heartCount(),
                    current.heartedByMe(),
                    current.postDate(),
                    current.isRepresentative(),
                    current.createdAt(),
                    null,
                    entity.hasOriginal()));
        }
        return responses;
    }

    public List<PixelDtos.PostSummaryResponse> summaries(List<PixelPost> posts) {
        List<PixelDtos.PostSummaryResponse> responses = new ArrayList<>(posts.size());
        for (PixelPost post : posts) {
            responses.add(new PixelDtos.PostSummaryResponse(
                    post.getId().toString(),
                    storage.characterUrl(post.getCharacterObjectKey()),
                    post.getPostDate().toString(),
                    post.getMood(),
                    post.getHeartCount()));
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
                generation.isUsedFreeGeneration(),
                generation.isUsedCredit(),
                generation.getCreatedAt(),
                generation.getCompletedAt());
    }

    /* ------------------------------------------------------------ profile */

    @Transactional(readOnly = true)
    public UserDtos.PublicProfileResponse publicProfile(
            UUID viewerId,
            User target,
            PixelPost todayPost,
            List<PixelPost> recentPosts,
            UUID conversationId) {

        UUID targetId = target.getId();
        UserProfile profile = userService.profileOf(targetId);
        UserStats stats = userService.statsOf(targetId);

        boolean blockedByMe = blockRepository
                .findBlockedAmong(viewerId, List.of(targetId))
                .contains(targetId);

        boolean heartedToday = todayPost != null
                && !reactionRepository
                        .findHeartedPostIds(viewerId, List.of(todayPost.getId()))
                        .isEmpty();

        return new UserDtos.PublicProfileResponse(
                targetId.toString(),
                nicknameOf(profile),
                profile.getBio(),
                userService.interestsOf(targetId),
                representativeUrl(profile),
                todayPost == null ? null : post(viewerId, todayPost),
                summaries(recentPosts),
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
                representativeUrl(profile),
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

    private String representativeUrl(UserProfile profile) {
        if (profile == null || profile.getRepresentativePostId() == null) {
            return null;
        }
        return postRepository
                .findAlive(profile.getRepresentativePostId())
                .map(post -> storage.characterUrl(post.getCharacterObjectKey()))
                .orElse(null);
    }

    private Map<UUID, String> resolveRepresentativeUrls(
            java.util.Collection<UserProfile> profiles) {
        List<UUID> representativeIds = profiles.stream()
                .map(UserProfile::getRepresentativePostId)
                .filter(java.util.Objects::nonNull)
                .toList();

        Map<UUID, String> byPostId = new HashMap<>();
        if (!representativeIds.isEmpty()) {
            postRepository.findByIdIn(representativeIds).forEach(post -> byPostId.put(
                    post.getId(), storage.characterUrl(post.getCharacterObjectKey())));
        }

        Map<UUID, String> byUserId = new HashMap<>();
        for (UserProfile profile : profiles) {
            if (profile.getRepresentativePostId() != null) {
                byUserId.put(
                        profile.getUserId(), byPostId.get(profile.getRepresentativePostId()));
            }
        }
        return byUserId;
    }
}
