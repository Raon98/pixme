package app.pixme.reaction;

import java.time.Duration;
import java.util.UUID;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.common.RateLimiter;
import app.pixme.config.PixmeProperties;
import app.pixme.pixel.domain.PixelPost;
import app.pixme.pixel.repository.PixelPostRepository;
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
 *       (user, post, type), so a double-tap or a retried request adds nothing
 *       and there is no race window between a check and the write.
 *   <li><b>Counts are atomic.</b> Post and author counters move with an
 *       {@code UPDATE ... SET x = x + 1}; a popular post receiving concurrent
 *       hearts would lose increments under read-modify-write.
 *   <li><b>No self-hearting</b>, and no reacting across a block in either
 *       direction.
 * </ul>
 */
@Service
public class ReactionService {

    private final ReactionRepository reactionRepository;
    private final PixelPostRepository postRepository;
    private final UserStatsRepository statsRepository;
    private final BlockRepository blockRepository;
    private final RateLimiter rateLimiter;
    private final PixmeProperties properties;
    private final ReactionNotifier notifier;

    public ReactionService(
            ReactionRepository reactionRepository,
            PixelPostRepository postRepository,
            UserStatsRepository statsRepository,
            BlockRepository blockRepository,
            RateLimiter rateLimiter,
            PixmeProperties properties,
            ReactionNotifier notifier) {
        this.reactionRepository = reactionRepository;
        this.postRepository = postRepository;
        this.statsRepository = statsRepository;
        this.blockRepository = blockRepository;
        this.rateLimiter = rateLimiter;
        this.properties = properties;
        this.notifier = notifier;
    }

    public record HeartResult(UUID postId, int heartCount, boolean heartedByMe) {}

    @Transactional
    public HeartResult sendHeart(UUID userId, UUID postId) {
        rateLimiter.check(
                "heart", userId, properties.rateLimit().heartPerMinute(), Duration.ofMinutes(1));

        PixelPost post = postRepository
                .findAlive(postId)
                .orElseThrow(() -> ApiException.notFound("PIXME"));

        if (post.getUserId().equals(userId)) {
            throw new ApiException(ErrorCode.CANNOT_REACT_TO_SELF);
        }
        if (blockRepository.existsBetween(userId, post.getUserId())) {
            throw new ApiException(ErrorCode.BLOCKED_BY_PEER);
        }
        if (!post.isVisibleToOthers()) {
            throw ApiException.notFound("PIXME");
        }

        int inserted = reactionRepository.insertHeartIfAbsent(
                UUID.randomUUID(), userId, postId);

        if (inserted == 0) {
            // Already hearted. Report the current state rather than erroring —
            // from the user's point of view the heart is simply there.
            return currentState(postId, userId);
        }

        postRepository.adjustHeartCount(postId, 1);
        adjustAuthorHearts(post.getUserId(), 1);

        notifier.onHeartReceived(post.getUserId(), userId, postId);

        return new HeartResult(postId, post.getHeartCount() + 1, true);
    }

    @Transactional
    public HeartResult removeHeart(UUID userId, UUID postId) {
        PixelPost post = postRepository
                .findAlive(postId)
                .orElseThrow(() -> ApiException.notFound("PIXME"));

        boolean existed = reactionRepository
                .findByFromUserIdAndPostIdAndType(userId, postId, ReactionType.HEART)
                .map(reaction -> {
                    reactionRepository.delete(reaction);
                    return true;
                })
                .orElse(false);

        if (!existed) {
            return new HeartResult(postId, post.getHeartCount(), false);
        }

        postRepository.adjustHeartCount(postId, -1);
        adjustAuthorHearts(post.getUserId(), -1);

        return new HeartResult(postId, Math.max(0, post.getHeartCount() - 1), false);
    }

    @Transactional(readOnly = true)
    public HeartResult currentState(UUID postId, UUID viewerId) {
        PixelPost post = postRepository
                .findAlive(postId)
                .orElseThrow(() -> ApiException.notFound("PIXME"));
        boolean hearted = reactionRepository.existsByFromUserIdAndPostIdAndType(
                viewerId, postId, ReactionType.HEART);
        return new HeartResult(postId, post.getHeartCount(), hearted);
    }

    private void adjustAuthorHearts(UUID authorId, int delta) {
        UserStats stats = statsRepository
                .findById(authorId)
                .orElseGet(() -> statsRepository.save(UserStats.createFor(authorId)));
        stats.addHearts(delta);
        statsRepository.save(stats);
    }
}
