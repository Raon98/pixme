package app.pixme.feed;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import app.pixme.config.PixmeProperties;
import app.pixme.dailystatus.domain.DailyStatus;
import org.springframework.stereotype.Component;

/**
 * Ranks today's PIXME for one viewer.
 *
 * <p>This is explicitly <em>not</em> dating optimisation. There is no
 * attractiveness signal, no mutual-interest prediction, no desirability score
 * and no "best match". The objective is a varied, current, interesting look at
 * other people's day, which decomposes into:
 *
 * <ul>
 *   <li><b>recency</b> — "today" has to feel like today; a post from an hour ago
 *       beats one from this morning.
 *   <li><b>interest overlap</b> — a mild nudge, not a filter bubble. Shared
 *       interests give a bounded bonus so you still see people unlike you.
 *   <li><b>reaction rate, not reaction count</b> — hearts divided by views.
 *       Using raw counts is how a feed ends up showing the same ten popular
 *       accounts to everyone forever.
 *   <li><b>new-user boost</b> — someone who joined this week has no hearts yet
 *       and would otherwise never surface. A reserved share of the feed fixes
 *       the cold start that otherwise makes the app feel empty for newcomers.
 *   <li><b>exposure penalty</b> — already seen today, or this author already
 *       shown N times, drops sharply.
 *   <li><b>jitter</b> — a small deterministic-per-(viewer,post) wobble so two
 *       people with identical profiles don't get identical feeds, and so the
 *       ordering isn't perfectly predictable.
 * </ul>
 */
@Component
public class FeedRanker {

    private final PixmeProperties properties;

    public FeedRanker(PixmeProperties properties) {
        this.properties = properties;
    }

    /** Inputs the ranker needs that the post itself doesn't carry. */
    public record Context(
            UUID viewerId,
            Instant now,
            /** Candidate author id → number of interests shared with the viewer. */
            Map<UUID, Integer> sharedInterestCounts,
            int viewerInterestCount,
            /** Author id → times already shown to this viewer today. */
            Map<UUID, Long> authorExposureCounts,
            Set<UUID> seenStatusIds,
            Set<UUID> heartedStatusIds,
            /**
             * Authors who waved at the viewer today and are still waiting —
             * this is the entire visibility mechanism for a one-sided wave:
             * there is no inbox, so surfacing the sender's card here is the
             * only way the recipient ever has a chance to notice and wave
             * back.
             */
            Set<UUID> wavedAtMeUserIds,
            /** Authors whose account is younger than a week. */
            Set<UUID> newUserIds) {}

    public List<DailyStatus> rank(List<DailyStatus> candidates, Context context) {
        int exposureCap = properties.feed().maxExposuresPerAuthorPerDay();

        Map<UUID, Double> scores = new HashMap<>();
        for (DailyStatus status : candidates) {
            scores.put(status.getId(), score(status, context, exposureCap));
        }

        return candidates.stream()
                .sorted(Comparator.comparingDouble((DailyStatus status) -> -scores.get(status.getId())))
                .toList();
    }

    private double score(DailyStatus status, Context context, int exposureCap) {
        double score = 0;

        /* --- recency: full marks within the hour, decaying over the day --- */
        Instant published = status.getUpdatedAt() == null ? status.getCreatedAt() : status.getUpdatedAt();
        long minutesOld = Duration.between(published, context.now()).toMinutes();
        score += 40.0 * Math.exp(-Math.max(0, minutesOld) / 420.0);

        /* --- interest overlap: bounded, so it nudges rather than filters --- */
        int shared = context.sharedInterestCounts().getOrDefault(status.getUserId(), 0);
        if (context.viewerInterestCount() > 0 && shared > 0) {
            double ratio = (double) shared / context.viewerInterestCount();
            score += 18.0 * Math.min(1.0, ratio);
        }

        /* --- reaction rate, with a floor so a brand-new status isn't punished */
        int views = Math.max(status.getViewCount(), 1);
        double reactionRate = (double) status.getHeartCount() / views;
        score += 20.0 * Math.min(1.0, reactionRate * 4);

        /*
         * A small absolute-popularity term, deliberately logarithmic and
         * deliberately weaker than the rate term above: raw heart count is the
         * signal that entrenches already-popular accounts, so it may inform
         * the order but must never decide it.
         */
        score += 4.0 * Math.log1p(status.getHeartCount()) / Math.log1p(50);

        /* --- new-user boost: the cold-start fix -------------------------- */
        if (context.newUserIds().contains(status.getUserId())) {
            score += 22.0;
        }

        // Already-connected authors and today's waved-at targets never reach
        // this ranker at all — FeedService excludes them from the candidate
        // query itself, so there is no score term for them here.

        /* --- waved at me, unmatched: the only path to ever noticing it --- */
        if (context.wavedAtMeUserIds().contains(status.getUserId())) {
            score += 35.0;
        }

        /*
         * "Fresh look" bonus — a small nudge for someone who picked a new
         * Current PIXME today, never a requirement to appear at all. Setting
         * only a mood/message/tag still surfaces you with zero bonus; this
         * must stay a bonus, not a gate.
         */
        if (status.isFreshCharacter()) {
            score += 6.0;
        }

        /* --- exposure penalties ------------------------------------------ */
        if (context.seenStatusIds().contains(status.getId())) {
            score -= 60.0;
        }
        long authorShown = context.authorExposureCounts().getOrDefault(status.getUserId(), 0L);
        if (authorShown >= exposureCap) {
            score -= 45.0;
        } else if (authorShown > 0) {
            score -= 12.0 * authorShown;
        }

        /* --- already hearted: they've reacted, show someone else --------- */
        if (context.heartedStatusIds().contains(status.getId())) {
            score -= 25.0;
        }

        /*
         * Stable jitter. Kept small on purpose: it exists to break ties between
         * near-equal candidates so two similar users don't get identical
         * feeds. Weighted any higher it starts overriding the real signals —
         * a status with a 10x better reaction rate must not lose to a coin
         * flip.
         */
        score += jitter(context.viewerId(), status.getId()) * 2.0;

        return score;
    }

    /**
     * Deterministic per (viewer, post) in [0,1). Stable across requests — a
     * random value here would reshuffle the feed under the user's thumb on
     * every page fetch.
     */
    private double jitter(UUID viewerId, UUID statusId) {
        long mixed = viewerId.getLeastSignificantBits() * 31L
                + statusId.getMostSignificantBits() * 17L
                + statusId.getLeastSignificantBits();
        // Knuth multiplicative hash, then take the top bits.
        long hashed = mixed * 0x9E3779B97F4A7C15L;
        return ((hashed >>> 11) & 0x1FFFFFFFFFFFFFL) / (double) (1L << 53);
    }

    /**
     * Interleaves the ranked list so that the configured share of slots goes to
     * new accounts even when established users would have out-scored them.
     *
     * <p>A pure score sort tends to starve newcomers in practice, which is
     * exactly the failure mode that makes a social app feel dead to the people
     * who just arrived.
     */
    public List<DailyStatus> applyNewUserQuota(
            List<DailyStatus> ranked, Set<UUID> newUserIds, int limit) {
        double quota = properties.feed().newUserQuota();
        if (quota <= 0 || ranked.isEmpty()) {
            return ranked.stream().limit(limit).toList();
        }

        int reserved = (int) Math.floor(limit * quota);
        if (reserved == 0) {
            return ranked.stream().limit(limit).toList();
        }

        List<DailyStatus> newcomers = ranked.stream()
                .filter(status -> newUserIds.contains(status.getUserId()))
                .limit(reserved)
                .toList();

        if (newcomers.isEmpty()) {
            return ranked.stream().limit(limit).toList();
        }

        List<DailyStatus> rest = ranked.stream()
                .filter(status -> !newcomers.contains(status))
                .toList();

        // Spread the reserved slots through the page rather than clustering
        // them at the top, where they would read as a "new users" section.
        java.util.List<DailyStatus> result = new java.util.ArrayList<>(limit);
        int stride = Math.max(2, limit / (newcomers.size() + 1));
        int newcomerIndex = 0;
        int restIndex = 0;

        for (int slot = 0; slot < limit && (newcomerIndex < newcomers.size() || restIndex < rest.size()); slot++) {
            boolean takeNewcomer = newcomerIndex < newcomers.size()
                    && slot > 0
                    && slot % stride == 0;
            if (takeNewcomer) {
                result.add(newcomers.get(newcomerIndex++));
            } else if (restIndex < rest.size()) {
                result.add(rest.get(restIndex++));
            } else if (newcomerIndex < newcomers.size()) {
                result.add(newcomers.get(newcomerIndex++));
            }
        }
        return result;
    }
}
