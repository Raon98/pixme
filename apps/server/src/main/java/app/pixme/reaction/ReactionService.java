package app.pixme.reaction;

import java.time.Duration;
import java.util.UUID;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.common.RateLimiter;
import app.pixme.config.PixmeProperties;
import app.pixme.dailystatus.domain.DailyStatus;
import app.pixme.dailystatus.repository.DailyStatusRepository;
import app.pixme.reaction.domain.ReactionType;
import app.pixme.reaction.repository.ReactionRepository;
import app.pixme.safety.repository.BlockRepository;
import app.pixme.user.domain.UserStats;
import app.pixme.user.repository.UserStatsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hearts — the lightest gesture in the product.
 *
 * <p>Correctness notes that matter more than they look:
 * <ul>
 *   <li><b>Idempotent.</b> The insert is an upsert against the unique index on
 *       (user, daily status, type), so a double-tap or a retried request adds
 *       nothing and there is no race window between a check and the write.
 *   <li><b>Counts are atomic.</b> Status and author counters move with an
 *       {@code UPDATE ... SET x = x + 1}; a popular status receiving concurrent
 *       hearts would lose increments under read-modify-write.
 *   <li><b>No self-hearting</b>, and no reacting across a block in either
 *       direction.
 * </ul>
 */
@Service
public class ReactionService {

    private final ReactionRepository reactionRepository;
    private final DailyStatusRepository statusRepository;
    private final UserStatsRepository statsRepository;
    private final BlockRepository blockRepository;
    private final RateLimiter rateLimiter;
    private final PixmeProperties properties;
    private final ReactionNotifier notifier;

    public ReactionService(
            ReactionRepository reactionRepository,
            DailyStatusRepository statusRepository,
            UserStatsRepository statsRepository,
            BlockRepository blockRepository,
            RateLimiter rateLimiter,
            PixmeProperties properties,
            ReactionNotifier notifier) {
        this.reactionRepository = reactionRepository;
        this.statusRepository = statusRepository;
        this.statsRepository = statsRepository;
        this.blockRepository = blockRepository;
        this.rateLimiter = rateLimiter;
        this.properties = properties;
        this.notifier = notifier;
    }

    public record HeartResult(UUID dailyStatusId, int heartCount, boolean heartedByMe) {}

    @Transactional
    public HeartResult sendHeart(UUID userId, UUID dailyStatusId) {
        rateLimiter.check(
                "heart", userId, properties.rateLimit().heartPerMinute(), Duration.ofMinutes(1));

        DailyStatus status = statusRepository
                .findById(dailyStatusId)
                .orElseThrow(() -> ApiException.notFound("오늘의 상태"));

        if (status.getUserId().equals(userId)) {
            throw new ApiException(ErrorCode.CANNOT_REACT_TO_SELF);
        }
        if (blockRepository.existsBetween(userId, status.getUserId())) {
            throw new ApiException(ErrorCode.BLOCKED_BY_PEER);
        }

        int inserted = reactionRepository.insertHeartIfAbsent(
                UUID.randomUUID(), userId, dailyStatusId);

        if (inserted == 0) {
            // Already hearted. Report the current state rather than erroring —
            // from the user's point of view the heart is simply there.
            return currentState(dailyStatusId, userId);
        }

        statusRepository.adjustHeartCount(dailyStatusId, 1);
        adjustAuthorHearts(status.getUserId(), 1);

        notifier.onHeartReceived(status.getUserId(), userId, dailyStatusId);

        return new HeartResult(dailyStatusId, status.getHeartCount() + 1, true);
    }

    @Transactional
    public HeartResult removeHeart(UUID userId, UUID dailyStatusId) {
        DailyStatus status = statusRepository
                .findById(dailyStatusId)
                .orElseThrow(() -> ApiException.notFound("오늘의 상태"));

        boolean existed = reactionRepository
                .findByFromUserIdAndDailyStatusIdAndType(userId, dailyStatusId, ReactionType.HEART)
                .map(reaction -> {
                    reactionRepository.delete(reaction);
                    return true;
                })
                .orElse(false);

        if (!existed) {
            return new HeartResult(dailyStatusId, status.getHeartCount(), false);
        }

        statusRepository.adjustHeartCount(dailyStatusId, -1);
        adjustAuthorHearts(status.getUserId(), -1);

        return new HeartResult(dailyStatusId, Math.max(0, status.getHeartCount() - 1), false);
    }

    @Transactional(readOnly = true)
    public HeartResult currentState(UUID dailyStatusId, UUID viewerId) {
        DailyStatus status = statusRepository
                .findById(dailyStatusId)
                .orElseThrow(() -> ApiException.notFound("오늘의 상태"));
        boolean hearted = reactionRepository.existsByFromUserIdAndDailyStatusIdAndType(
                viewerId, dailyStatusId, ReactionType.HEART);
        return new HeartResult(dailyStatusId, status.getHeartCount(), hearted);
    }

    private void adjustAuthorHearts(UUID authorId, int delta) {
        UserStats stats = statsRepository
                .findById(authorId)
                .orElseGet(() -> statsRepository.save(UserStats.createFor(authorId)));
        stats.addHearts(delta);
        statsRepository.save(stats);
    }
}
