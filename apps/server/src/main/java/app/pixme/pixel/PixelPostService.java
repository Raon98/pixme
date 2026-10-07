package app.pixme.pixel;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import app.pixme.common.ApiException;
import app.pixme.common.Cursors;
import app.pixme.common.ErrorCode;
import app.pixme.common.ServiceClock;
import app.pixme.common.TextSanitizer;
import app.pixme.config.PixmeProperties;
import app.pixme.pixel.domain.GenerationStatus;
import app.pixme.pixel.domain.PixelGeneration;
import app.pixme.pixel.domain.PixelPost;
import app.pixme.pixel.domain.PixelPostTag;
import app.pixme.pixel.repository.PixelGenerationRepository;
import app.pixme.pixel.repository.PixelPostRepository;
import app.pixme.pixel.repository.PixelPostTagRepository;
import app.pixme.storage.StorageService;
import app.pixme.user.domain.UserProfile;
import app.pixme.user.domain.UserSettings;
import app.pixme.user.domain.UserStats;
import app.pixme.user.repository.UserProfileRepository;
import app.pixme.user.repository.UserSettingsRepository;
import app.pixme.user.repository.UserStatsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Publishing and reading PIXME posts.
 *
 * <p>The one rule everything else follows from: a user has at most one
 * <em>representative</em> post per calendar day. Publishing again on the same
 * day replaces it — the previous character is demoted to private and stays in
 * the owner's record. That is what keeps the feed and the square legible as
 * "today, one card per person", while still letting people try several
 * candidates.
 */
@Service
public class PixelPostService {

    private static final Logger log = LoggerFactory.getLogger(PixelPostService.class);
    private static final int MAX_TAGS = 4;

    private final PixelPostRepository postRepository;
    private final PixelPostTagRepository tagRepository;
    private final PixelGenerationRepository generationRepository;
    private final UserProfileRepository profileRepository;
    private final UserStatsRepository statsRepository;
    private final UserSettingsRepository settingsRepository;
    private final StorageService storage;
    private final TextSanitizer sanitizer;
    private final ServiceClock clock;
    private final PixmeProperties properties;

    public PixelPostService(
            PixelPostRepository postRepository,
            PixelPostTagRepository tagRepository,
            PixelGenerationRepository generationRepository,
            UserProfileRepository profileRepository,
            UserStatsRepository statsRepository,
            UserSettingsRepository settingsRepository,
            StorageService storage,
            TextSanitizer sanitizer,
            ServiceClock clock,
            PixmeProperties properties) {
        this.postRepository = postRepository;
        this.tagRepository = tagRepository;
        this.generationRepository = generationRepository;
        this.profileRepository = profileRepository;
        this.statsRepository = statsRepository;
        this.settingsRepository = settingsRepository;
        this.storage = storage;
        this.sanitizer = sanitizer;
        this.clock = clock;
        this.properties = properties;
    }

    public record PublishCommand(
            String caption, String mood, List<String> tags, boolean replaceRepresentative) {}

    /**
     * Publishes a completed generation as today's representative PIXME.
     *
     * @throws ApiException {@code ALREADY_PUBLISHED_TODAY} when a representative
     *     post exists and the caller did not explicitly ask to replace it — the
     *     app turns that into the "오늘의 PIXME를 바꿀까요?" confirmation rather
     *     than silently overwriting the user's day.
     */
    @Transactional
    public PixelPost publish(UUID userId, UUID generationId, PublishCommand command) {
        PixelGeneration generation = generationRepository
                .findByIdAndUserId(generationId, userId)
                .orElseThrow(() -> ApiException.notFound("PIXME 생성"));

        if (generation.getStatus() != GenerationStatus.COMPLETED
                || generation.getGeneratedObjectKey() == null) {
            throw new ApiException(ErrorCode.GENERATION_NOT_COMPLETED);
        }

        LocalDate postDate = clock.today();

        Optional<PixelPost> existing = postRepository.findRepresentative(userId, postDate);
        if (existing.isPresent()) {
            if (existing.get().getGenerationId().equals(generationId)) {
                // Idempotent: a retried publish of the same generation is a no-op.
                return existing.get();
            }
            if (!command.replaceRepresentative()) {
                throw new ApiException(ErrorCode.ALREADY_PUBLISHED_TODAY);
            }
            // Demote, then flush: the partial unique index on (user, date)
            // would otherwise reject the insert below.
            existing.get().demote();
            postRepository.saveAndFlush(existing.get());
        }

        boolean keepOriginal = settingsRepository
                .findById(userId)
                .map(UserSettings::isKeepOriginalPhoto)
                .orElse(true);

        String caption = sanitizer.sanitizeFreeText(command.caption(), 60, "오늘의 한마디");
        String mood = normalizeMood(command.mood());

        PixelPost post = PixelPost.publish(
                userId, generation, caption, mood, postDate, keepOriginal);
        postRepository.save(post);

        saveTags(post.getId(), command.tags());

        // Privacy opt-out is honoured at the moment of publish, not by a later
        // job: if the user doesn't want the photo kept, it goes now.
        if (!keepOriginal) {
            storage.deleteOriginal(generation.getOriginalObjectKey());
        }

        profileRepository.findById(userId).ifPresent(profile -> {
            profile.setRepresentativePostId(post.getId());
            profileRepository.save(profile);
        });

        statsRepository
                .findById(userId)
                .or(() -> Optional.of(statsRepository.save(UserStats.createFor(userId))))
                .ifPresent(stats -> {
                    stats.recordPost(postDate);
                    statsRepository.save(stats);
                });

        log.info("user={} published post={} for {}", userId, post.getId(), postDate);
        return post;
    }

    /* ----------------------------------------------------------- read side */

    @Transactional(readOnly = true)
    public PixelPost getVisible(UUID viewerId, UUID postId) {
        PixelPost post = postRepository
                .findAlive(postId)
                .orElseThrow(() -> ApiException.notFound("PIXME"));

        boolean owner = post.getUserId().equals(viewerId);
        if (!owner && !post.isVisibleToOthers()) {
            throw ApiException.notFound("PIXME");
        }
        return post;
    }

    @Transactional(readOnly = true)
    public PixelPost getOwned(UUID userId, UUID postId) {
        return postRepository
                .findByIdAndUserId(postId, userId)
                .filter(post -> post.getDeletedAt() == null)
                .orElseThrow(() -> ApiException.notFound("PIXME"));
    }

    @Transactional(readOnly = true)
    public Optional<PixelPost> findTodayRepresentative(UUID userId) {
        return postRepository.findRepresentative(userId, clock.today());
    }

    @Transactional(readOnly = true)
    public List<PixelPost> history(UUID userId, LocalDate cursorDate, UUID cursorId, int limit) {
        return postRepository.findHistory(
                userId,
                cursorDate == null ? Cursors.OPEN_DATE : cursorDate,
                cursorId == null ? Cursors.OPEN_ID : cursorId,
                PageRequest.of(0, limit));
    }

    @Transactional(readOnly = true)
    public List<PixelPost> publicHistory(
            UUID userId, LocalDate cursorDate, UUID cursorId, int limit) {
        return postRepository.findPublicHistory(
                userId,
                cursorDate == null ? Cursors.OPEN_DATE : cursorDate,
                cursorId == null ? Cursors.OPEN_ID : cursorId,
                PageRequest.of(0, limit));
    }

    @Transactional(readOnly = true)
    public List<String> tagsOf(UUID postId) {
        return tagRepository.findTagsByPostId(postId);
    }

    /* ------------------------------------------------------------ original */

    /**
     * A short-lived signed URL for the owner's own original photo.
     *
     * <p>Owner-only, deliberately short TTL, and never returned in any list
     * response — the only way to see an original is to ask for it explicitly,
     * one post at a time.
     */
    public record SignedUrl(String url, Instant expiresAt) {}

    @Transactional(readOnly = true)
    public SignedUrl originalUrl(UUID userId, UUID postId) {
        PixelPost post = getOwned(userId, postId);
        if (!post.hasOriginal()) {
            throw new ApiException(ErrorCode.ORIGINAL_NOT_AVAILABLE);
        }
        Duration ttl = properties.storage().originalViewUrlTtl();
        return new SignedUrl(
                storage.presignOriginalDownload(post.getOriginalObjectKey(), ttl),
                Instant.now().plus(ttl));
    }

    /** Deletes the stored photo but keeps the character and the record. */
    @Transactional
    public void deleteOriginal(UUID userId, UUID postId) {
        PixelPost post = getOwned(userId, postId);
        if (!post.hasOriginal()) {
            return;
        }
        String objectKey = post.getOriginalObjectKey();
        post.forgetOriginal();
        postRepository.save(post);
        storage.deleteOriginal(objectKey);
    }

    /* ------------------------------------------------------------- mutate */

    /** Removes a post from public surfaces; it remains in the owner's history. */
    @Transactional
    public PixelPost unpublish(UUID userId, UUID postId) {
        PixelPost post = getOwned(userId, postId);
        post.unpublish();
        postRepository.save(post);
        clearRepresentativePointer(userId, postId);
        return post;
    }

    @Transactional
    public void delete(UUID userId, UUID postId) {
        PixelPost post = getOwned(userId, postId);
        post.softDelete();
        postRepository.save(post);
        tagRepository.deleteByPostId(postId);

        if (post.hasOriginal()) {
            storage.deleteOriginal(post.getOriginalObjectKey());
            post.forgetOriginal();
            postRepository.save(post);
        }
        clearRepresentativePointer(userId, postId);
    }

    private void clearRepresentativePointer(UUID userId, UUID postId) {
        profileRepository.findById(userId).ifPresent(profile -> {
            if (postId.equals(profile.getRepresentativePostId())) {
                // Fall back to the most recent surviving representative post so
                // the user still has an avatar everywhere.
                UUID fallback = postRepository
                        .findHistory(userId, null, null, PageRequest.of(0, 1))
                        .stream()
                        .filter(post -> !post.getId().equals(postId))
                        .map(PixelPost::getId)
                        .findFirst()
                        .orElse(null);
                profile.setRepresentativePostId(fallback);
                profileRepository.save(profile);
            }
        });
    }

    /* ------------------------------------------------------------ helpers */

    private void saveTags(UUID postId, List<String> rawTags) {
        if (rawTags == null || rawTags.isEmpty()) {
            return;
        }
        // De-duplicate while preserving the order the user picked, then cap.
        Set<String> normalized = new LinkedHashSet<>();
        for (String raw : rawTags) {
            String tag = sanitizer.sanitizeTag(raw);
            if (tag != null) {
                normalized.add(tag);
            }
            if (normalized.size() >= MAX_TAGS) {
                break;
            }
        }

        List<PixelPostTag> entities = new ArrayList<>(normalized.size());
        for (String tag : normalized) {
            entities.add(new PixelPostTag(postId, tag));
        }
        tagRepository.saveAll(entities);
    }

    /** Mood is a closed enum on the client; reject anything else rather than store it. */
    private String normalizeMood(String mood) {
        if (mood == null || mood.isBlank()) {
            return null;
        }
        String value = mood.trim().toUpperCase();
        return switch (value) {
            case "HAPPY", "LOVELY", "SLEEPY", "BLANK", "MELTED", "TEARY", "COOL", "CHAOS" -> value;
            default -> throw new ApiException(ErrorCode.VALIDATION_FAILED, "알 수 없는 기분이에요.");
        };
    }

    /** Resolves the public CDN URL for a character object key. */
    public String characterUrl(PixelPost post) {
        return storage.characterUrl(post.getCharacterObjectKey());
    }

    /** Resolves the representative character URL for a profile, if any. */
    @Transactional(readOnly = true)
    public String representativeCharacterUrl(UserProfile profile) {
        if (profile == null || profile.getRepresentativePostId() == null) {
            return null;
        }
        return postRepository
                .findAlive(profile.getRepresentativePostId())
                .map(this::characterUrl)
                .orElse(null);
    }
}
