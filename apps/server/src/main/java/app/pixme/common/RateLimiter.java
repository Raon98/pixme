package app.pixme.common;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Fixed-window rate limiter backed by Redis.
 *
 * <p>Used for the actions where abuse is both cheap and expensive for us:
 * generation (costs real provider money), hearts and waves (spam vector), and
 * reports (moderation noise). A fixed window is a deliberate simplification —
 * it allows a burst at a boundary, which is acceptable here and much cheaper
 * than a sliding log.
 *
 * <p>Fails open: if Redis is unavailable the user is not blocked. Losing a
 * limiter is better than losing the service, and the hard per-day caps in the
 * database still apply to the expensive paths.
 */
@Component
public class RateLimiter {

    private static final Logger log = LoggerFactory.getLogger(RateLimiter.class);

    private final StringRedisTemplate redis;

    public RateLimiter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /** Throws {@code RATE_LIMITED} when the caller is over {@code limit} in {@code window}. */
    public void check(String action, UUID userId, int limit, Duration window) {
        if (limit <= 0) {
            return;
        }
        long bucket = System.currentTimeMillis() / window.toMillis();
        String key = "rl:" + action + ":" + userId + ":" + bucket;

        try {
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redis.expire(key, window.toSeconds() + 1, TimeUnit.SECONDS);
            }
            if (count != null && count > limit) {
                throw new ApiException(ErrorCode.RATE_LIMITED);
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            log.warn("rate limiter unavailable for action={}, failing open", action, exception);
        }
    }
}
