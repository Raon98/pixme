package app.pixme.feed;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Field;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import app.pixme.ai.PixelStyle;
import app.pixme.config.PixmeProperties;
import app.pixme.pixel.domain.PixelPost;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Ranking tests assert the product's discovery rules, not an exact ordering:
 * newcomers must surface, the same author must not dominate, and already-seen
 * cards must sink. Those are the properties that make the feed feel varied.
 */
class FeedRankerTest {

    private static final Instant NOW = Instant.parse("2026-10-07T12:00:00Z");

    private final FeedRanker ranker = new FeedRanker(properties());

    @Test
    @DisplayName("최근에 올라온 PIXME가 먼저 보인다")
    void prefersRecentPosts() {
        PixelPost fresh = post(NOW.minus(Duration.ofMinutes(5)), 0, 0);
        PixelPost old = post(NOW.minus(Duration.ofHours(10)), 0, 0);

        List<PixelPost> ranked = ranker.rank(List.of(old, fresh), context(Set.of(), Map.of(), Set.of()));

        assertThat(ranked.get(0)).isEqualTo(fresh);
    }

    @Test
    @DisplayName("이미 본 카드는 뒤로 밀린다")
    void sinksAlreadySeenPosts() {
        PixelPost seen = post(NOW.minus(Duration.ofMinutes(1)), 20, 100);
        PixelPost unseen = post(NOW.minus(Duration.ofHours(3)), 0, 10);

        List<PixelPost> ranked = ranker.rank(
                List.of(seen, unseen), context(Set.of(seen.getId()), Map.of(), Set.of()));

        assertThat(ranked.get(0)).isEqualTo(unseen);
    }

    @Test
    @DisplayName("같은 사람을 하루에 여러 번 보여주지 않는다")
    void penalisesRepeatedAuthors() {
        PixelPost repeated = post(NOW.minus(Duration.ofMinutes(2)), 30, 100);
        PixelPost other = post(NOW.minus(Duration.ofHours(4)), 1, 10);

        List<PixelPost> ranked = ranker.rank(
                List.of(repeated, other),
                context(Set.of(), Map.of(repeated.getUserId(), 2L), Set.of()));

        assertThat(ranked.get(0)).isEqualTo(other);
    }

    @Test
    @DisplayName("하트 '수'가 아니라 '반응률'을 본다")
    void prefersReactionRateOverRawCount() {
        // 50 hearts from 5000 views (1%) vs 5 hearts from 50 views (10%).
        PixelPost popularButFlat = post(NOW.minus(Duration.ofHours(2)), 50, 5000);
        PixelPost smallButLoved = post(NOW.minus(Duration.ofHours(2)), 5, 50);

        List<PixelPost> ranked = ranker.rank(
                List.of(popularButFlat, smallButLoved),
                context(Set.of(), Map.of(), Set.of()));

        assertThat(ranked.get(0)).isEqualTo(smallButLoved);
    }

    @Test
    @DisplayName("신규 사용자는 하트가 없어도 피드에 올라온다")
    void boostsNewUsers() {
        PixelPost newcomer = post(NOW.minus(Duration.ofHours(6)), 0, 0);
        PixelPost established = post(NOW.minus(Duration.ofHours(5)), 8, 100);

        List<PixelPost> ranked = ranker.rank(
                List.of(established, newcomer),
                context(Set.of(), Map.of(), Set.of(newcomer.getUserId())));

        assertThat(ranked.get(0)).isEqualTo(newcomer);
    }

    @Test
    @DisplayName("신규 사용자 쿼터는 페이지 중간에 섞여 들어간다")
    void interleavesNewUserQuota() {
        List<PixelPost> ranked = new java.util.ArrayList<>();
        Set<UUID> newUserIds = new java.util.HashSet<>();

        for (int index = 0; index < 20; index++) {
            PixelPost post = post(NOW.minus(Duration.ofMinutes(index)), 0, 0);
            ranked.add(post);
            if (index >= 15) {
                newUserIds.add(post.getUserId());
            }
        }

        List<PixelPost> page = ranker.applyNewUserQuota(ranked, newUserIds, 10);

        assertThat(page).hasSize(10);
        long newcomersOnPage = page.stream()
                .filter(post -> newUserIds.contains(post.getUserId()))
                .count();
        // 20% of 10 slots = 2 reserved.
        assertThat(newcomersOnPage).isGreaterThanOrEqualTo(2);
        // And they are not all clustered at the very top.
        assertThat(newUserIds).doesNotContain(page.get(0).getUserId());
    }

    @Test
    @DisplayName("같은 사용자·게시물 조합의 지터는 요청마다 바뀌지 않는다")
    void jitterIsStableAcrossCalls() {
        List<PixelPost> candidates = List.of(
                post(NOW.minus(Duration.ofMinutes(10)), 2, 20),
                post(NOW.minus(Duration.ofMinutes(10)), 2, 20),
                post(NOW.minus(Duration.ofMinutes(10)), 2, 20));

        FeedRanker.Context context = context(Set.of(), Map.of(), Set.of());

        assertThat(ranker.rank(candidates, context))
                .containsExactlyElementsOf(ranker.rank(candidates, context));
    }

    /* ------------------------------------------------------------ fixtures */

    private FeedRanker.Context context(
            Set<UUID> seenPostIds, Map<UUID, Long> authorExposures, Set<UUID> newUserIds) {
        return new FeedRanker.Context(
                UUID.fromString("00000000-0000-0000-0000-0000000000ff"),
                NOW,
                Map.of(),
                0,
                authorExposures,
                seenPostIds,
                Set.of(),
                Set.of(),
                newUserIds);
    }

    private PixelPost post(Instant publishedAt, int hearts, int views) {
        PixelPost post = new PixelPost();
        set(post, "id", UUID.randomUUID());
        set(post, "userId", UUID.randomUUID());
        set(post, "generationId", UUID.randomUUID());
        set(post, "characterObjectKey", "characters/test.png");
        set(post, "style", PixelStyle.PIXME_BASIC);
        set(post, "heartCount", hearts);
        set(post, "viewCount", views);
        set(post, "postDate", LocalDate.of(2026, 10, 7));
        set(post, "representative", true);
        set(post, "publishedAt", publishedAt);
        set(post, "createdAt", publishedAt);
        return post;
    }

    /**
     * Entities are built by reflection rather than by adding test-only setters
     * to the domain model — the production API should not grow holes for tests.
     */
    private void set(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException exception) {
            throw new IllegalStateException("could not set " + fieldName, exception);
        }
    }

    private PixmeProperties properties() {
        return new PixmeProperties(
                "Asia/Seoul",
                "1.0.0",
                new PixmeProperties.Maintenance(false, null),
                null,
                null,
                null,
                new PixmeProperties.Generation(1, 20, 10),
                new PixmeProperties.Feed(10, 2, 0.2),
                new PixmeProperties.Square(40, 1000, 1400, 92, 8),
                new PixmeProperties.Push(null, null, false),
                null,
                null,
                new PixmeProperties.RateLimit(10, 60, 60, 60, 20));
    }
}
