package app.pixme.feed;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import app.pixme.common.Cursors;
import app.pixme.common.ServiceClock;
import app.pixme.config.PixmeProperties;
import app.pixme.connection.repository.ConnectionRepository;
import app.pixme.pixel.domain.PixelPost;
import app.pixme.pixel.repository.PixelPostRepository;
import app.pixme.reaction.repository.ReactionRepository;
import app.pixme.safety.repository.BlockRepository;
import app.pixme.user.repository.UserInterestRepository;
import app.pixme.user.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Builds the "오늘" feed.
 *
 * <p>Pagination is keyset over {@code publishedAt} within the day, and the
 * ranker reorders inside that window. Doing it the other way round — ranking
 * globally and paging by rank — is what produces duplicate and skipped cards
 * as new posts arrive mid-session.
 */
@Service
public class FeedService {

    /** Over-fetch factor: the ranker needs room to reorder and drop. */
    private static final int CANDIDATE_MULTIPLIER = 6;

    /** How recently an account must have joined to count as "new". */
    private static final Duration NEW_USER_WINDOW = Duration.ofDays(7);

    private final PixelPostRepository postRepository;
    private final BlockRepository blockRepository;
    private final ReactionRepository reactionRepository;
    private final ConnectionRepository connectionRepository;
    private final UserInterestRepository userInterestRepository;
    private final UserRepository userRepository;
    private final FeedExposureRepository exposureRepository;
    private final FeedRanker ranker;
    private final ServiceClock clock;
    private final PixmeProperties properties;

    public FeedService(
            PixelPostRepository postRepository,
            BlockRepository blockRepository,
            ReactionRepository reactionRepository,
            ConnectionRepository connectionRepository,
            UserInterestRepository userInterestRepository,
            UserRepository userRepository,
            FeedExposureRepository exposureRepository,
            FeedRanker ranker,
            ServiceClock clock,
            PixmeProperties properties) {
        this.postRepository = postRepository;
        this.blockRepository = blockRepository;
        this.reactionRepository = reactionRepository;
        this.connectionRepository = connectionRepository;
        this.userInterestRepository = userInterestRepository;
        this.userRepository = userRepository;
        this.exposureRepository = exposureRepository;
        this.ranker = ranker;
        this.clock = clock;
        this.properties = properties;
    }

    public record FeedPage(List<PixelPost> posts, Set<UUID> heartedPostIds, String nextCursor) {}

    @Transactional
    public FeedPage today(UUID viewerId, String cursor, Integer requestedLimit) {
        int limit = requestedLimit == null || requestedLimit <= 0
                ? properties.feed().pageSize()
                : Math.min(requestedLimit, 30);

        LocalDate today = clock.today();
        Cursors.Keyset keyset = Cursors.decode(cursor);

        List<UUID> excluded = blockRepository.findAllRelatedUserIds(viewerId);

        List<PixelPost> candidates = postRepository.findFeedCandidates(
                today,
                viewerId,
                excluded.isEmpty() ? List.of(viewerId) : excluded,
                excluded.isEmpty(),
                Cursors.timestampOrOpen(keyset),
                Cursors.idOrOpen(keyset),
                PageRequest.of(0, limit * CANDIDATE_MULTIPLIER));

        if (candidates.isEmpty()) {
            return new FeedPage(List.of(), Set.of(), null);
        }

        FeedRanker.Context context = buildContext(viewerId, today, candidates);
        List<PixelPost> ranked = ranker.rank(candidates, context);
        List<PixelPost> page = ranker.applyNewUserQuota(ranked, context.newUserIds(), limit);

        recordExposures(viewerId, today, page);

        // The cursor is the oldest post in the *candidate window*, not in the
        // ranked page — otherwise reordering would make the next page skip
        // posts that were fetched but ranked low.
        PixelPost oldestCandidate = candidates.get(candidates.size() - 1);
        boolean windowExhausted = candidates.size() < limit * CANDIDATE_MULTIPLIER;
        String nextCursor = windowExhausted
                ? null
                : Cursors.encode(
                        oldestCandidate.getPublishedAt() == null
                                ? oldestCandidate.getCreatedAt()
                                : oldestCandidate.getPublishedAt(),
                        oldestCandidate.getId());

        Set<UUID> hearted = new HashSet<>(context.heartedPostIds());
        return new FeedPage(page, hearted, nextCursor);
    }

    /** Which of these posts the viewer has already hearted. */
    @Transactional(readOnly = true)
    public Set<UUID> heartedAmong(UUID viewerId, List<UUID> postIds) {
        if (postIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(reactionRepository.findHeartedPostIds(viewerId, postIds));
    }

    /* ------------------------------------------------------------- context */

    private FeedRanker.Context buildContext(
            UUID viewerId, LocalDate today, List<PixelPost> candidates) {

        List<UUID> authorIds = candidates.stream().map(PixelPost::getUserId).distinct().toList();
        List<UUID> postIds = candidates.stream().map(PixelPost::getId).toList();

        List<String> viewerInterests = userInterestRepository.findCodesByUserId(viewerId);

        Map<UUID, Integer> sharedInterests = new HashMap<>();
        if (!viewerInterests.isEmpty()) {
            for (Object[] row : userInterestRepository.countSharedInterests(
                    authorIds, viewerInterests)) {
                sharedInterests.put((UUID) row[0], ((Number) row[1]).intValue());
            }
        }

        Map<UUID, Long> authorExposures = new HashMap<>();
        for (Object[] row : exposureRepository.countByAuthorForDay(viewerId, today)) {
            authorExposures.put((UUID) row[0], ((Number) row[1]).longValue());
        }

        Set<UUID> seen = new HashSet<>(exposureRepository.findSeenPostIds(viewerId, today));
        Set<UUID> hearted = new HashSet<>(
                reactionRepository.findHeartedPostIds(viewerId, postIds));
        Set<UUID> connected = new HashSet<>(connectionRepository.findPeerIds(viewerId));

        Set<UUID> newUsers = new HashSet<>(userRepository.findRecentlyJoinedAmong(
                authorIds, clock.now().minus(NEW_USER_WINDOW)));

        return new FeedRanker.Context(
                viewerId,
                clock.now(),
                sharedInterests,
                viewerInterests.size(),
                authorExposures,
                seen,
                hearted,
                connected,
                newUsers);
    }

    /**
     * Persists what we showed, and counts the impression on the post.
     *
     * <p>View counts are what make the ranker's reaction <em>rate</em>
     * meaningful, so they have to be written on the serving path rather than
     * inferred later from client telemetry.
     */
    private void recordExposures(UUID viewerId, LocalDate today, List<PixelPost> page) {
        if (page.isEmpty()) {
            return;
        }

        List<FeedExposure> exposures = new ArrayList<>(page.size());
        List<UUID> postIds = new ArrayList<>(page.size());

        for (PixelPost post : page) {
            exposures.add(new FeedExposure(viewerId, post.getId(), post.getUserId(), today));
            postIds.add(post.getId());
        }

        // An exposure may already exist (the viewer re-opened the feed); the
        // upsert semantics we want are "ignore duplicates", so save each
        // independently rather than failing the whole page.
        for (FeedExposure exposure : exposures) {
            if (!exposureRepository.existsById(exposure.getKey())) {
                exposureRepository.save(exposure);
            }
        }
        postRepository.incrementViewCounts(postIds);
    }
}
