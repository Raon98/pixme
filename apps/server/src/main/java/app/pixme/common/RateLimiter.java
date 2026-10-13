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
 * <p>{@link #check} fails open: for hearts, waves, messages and reports,
 * losing the limiter is better than losing the service, and none of them cost
 * anything to serve.
 *
 * <p>{@link #checkOrRefuse} fails closed, and is what the generation paths
 * use. A limiter that disappears when Redis does would otherwise turn a cache
 * outage into unbounded spend at an external provider — the one failure here
 * that costs real money and cannot be undone.
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
        enforce(action, userId, limit, window, true);
    }

    /**
     * As {@link #check}, but refuses the action when the limiter itself cannot
     * be consulted. For anything that spends money downstream.
     */
    public void checkOrRefuse(String action, UUID userId, int limit, Duration window) {
        enforce(action, userId, limit, window, false);
    }

    private void enforce(
            String action, UUID userId, int limit, Duration window, boolean failOpen) {
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
            if (!failOpen) {
                log.error(
                        "rate limiter unavailable for action={}, refusing", action, exception);
                throw new ApiException(ErrorCode.RATE_LIMITED);
            }
            log.warn("rate limiter unavailable for action={}, failing open", action, exception);
        }
    }
}
