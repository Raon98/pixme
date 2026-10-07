package app.pixme.feed;

import java.time.Duration;
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
import app.pixme.dailystatus.domain.DailyStatus;
import app.pixme.dailystatus.repository.DailyStatusRepository;
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
 * <p>Pagination is keyset over {@code updatedAt} within the day, and the
 * ranker reorders inside that window. Doing it the other way round — ranking
 * globally and paging by rank — is what produces duplicate and skipped cards
 * as new statuses arrive mid-session.
 */
@Service
public class FeedService {

    /** Over-fetch factor: the ranker needs room to reorder and drop. */
    private static final int CANDIDATE_MULTIPLIER = 6;

    /** How recently an account must have joined to count as "new". */
    private static final Duration NEW_USER_WINDOW = Duration.ofDays(7);

    private final DailyStatusRepository statusRepository;
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
            DailyStatusRepository statusRepository,
            BlockRepository blockRepository,
            ReactionRepository reactionRepository,
            ConnectionRepository connectionRepository,
            UserInterestRepository userInterestRepository,
            UserRepository userRepository,
            FeedExposureRepository exposureRepository,
            FeedRanker ranker,
            ServiceClock clock,
            PixmeProperties properties) {
        this.statusRepository = statusRepository;
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

    public record FeedPage(List<DailyStatus> statuses, Set<UUID> heartedStatusIds, String nextCursor) {}

    @Transactional
    public FeedPage today(UUID viewerId, String cursor, Integer requestedLimit) {
        int limit = requestedLimit == null || requestedLimit <= 0
                ? properties.feed().pageSize()
                : Math.min(requestedLimit, 30);

        LocalDate today = clock.today();
        Cursors.Keyset keyset = Cursors.decode(cursor);

        List<UUID> excluded = blockRepository.findAllRelatedUserIds(viewerId);

        List<DailyStatus> candidates = statusRepository.findFeedCandidates(
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
        List<DailyStatus> ranked = ranker.rank(candidates, context);
        List<DailyStatus> page = ranker.applyNewUserQuota(ranked, context.newUserIds(), limit);

        recordExposures(viewerId, today, page);

        // The cursor is the oldest status in the *candidate window*, not in the
        // ranked page — otherwise reordering would make the next page skip
        // statuses that were fetched but ranked low.
        DailyStatus oldestCandidate = candidates.get(candidates.size() - 1);
        boolean windowExhausted = candidates.size() < limit * CANDIDATE_MULTIPLIER;
        String nextCursor = windowExhausted
                ? null
                : Cursors.encode(oldestCandidate.getUpdatedAt(), oldestCandidate.getId());

        Set<UUID> hearted = new HashSet<>(context.heartedStatusIds());
        return new FeedPage(page, hearted, nextCursor);
    }

    /** Which of these statuses the viewer has already hearted. */
    @Transactional(readOnly = true)
    public Set<UUID> heartedAmong(UUID viewerId, List<UUID> dailyStatusIds) {
        if (dailyStatusIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(reactionRepository.findHeartedDailyStatusIds(viewerId, dailyStatusIds));
    }

    /* ------------------------------------------------------------- context */

    private FeedRanker.Context buildContext(
            UUID viewerId, LocalDate today, List<DailyStatus> candidates) {

        List<UUID> authorIds = candidates.stream().map(DailyStatus::getUserId).distinct().toList();
        List<UUID> statusIds = candidates.stream().map(DailyStatus::getId).toList();

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

        Set<UUID> seen = new HashSet<>(exposureRepository.findSeenDailyStatusIds(viewerId, today));
        Set<UUID> hearted = new HashSet<>(
                reactionRepository.findHeartedDailyStatusIds(viewerId, statusIds));
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
     * Persists what we showed, and counts the impression on the status.
     *
     * <p>View counts are what make the ranker's reaction <em>rate</em>
     * meaningful, so they have to be written on the serving path rather than
     * inferred later from client telemetry.
     */
    private void recordExposures(UUID viewerId, LocalDate today, List<DailyStatus> page) {
        if (page.isEmpty()) {
            return;
        }

        List<FeedExposure> exposures = new ArrayList<>(page.size());
        List<UUID> statusIds = new ArrayList<>(page.size());

        for (DailyStatus status : page) {
            exposures.add(new FeedExposure(viewerId, status.getId(), status.getUserId(), today));
            statusIds.add(status.getId());
        }

        // An exposure may already exist (the viewer re-opened the feed); the
        // upsert semantics we want are "ignore duplicates", so save each
        // independently rather than failing the whole page.
        for (FeedExposure exposure : exposures) {
            if (!exposureRepository.existsById(exposure.getKey())) {
                exposureRepository.save(exposure);
            }
        }
        statusRepository.incrementViewCounts(statusIds);
    }
}
