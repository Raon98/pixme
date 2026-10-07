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

import app.pixme.config.PixmeProperties;
import app.pixme.dailystatus.domain.DailyStatus;
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
    @DisplayName("최근에 올라온 상태가 먼저 보인다")
    void prefersRecentStatuses() {
        DailyStatus fresh = status(NOW.minus(Duration.ofMinutes(5)), 0, 0);
        DailyStatus old = status(NOW.minus(Duration.ofHours(10)), 0, 0);

        List<DailyStatus> ranked = ranker.rank(List.of(old, fresh), context(Set.of(), Map.of(), Set.of()));

        assertThat(ranked.get(0)).isEqualTo(fresh);
    }

    @Test
    @DisplayName("이미 본 카드는 뒤로 밀린다")
    void sinksAlreadySeenStatuses() {
        DailyStatus seen = status(NOW.minus(Duration.ofMinutes(1)), 20, 100);
        DailyStatus unseen = status(NOW.minus(Duration.ofHours(3)), 0, 10);

        List<DailyStatus> ranked = ranker.rank(
                List.of(seen, unseen), context(Set.of(seen.getId()), Map.of(), Set.of()));

        assertThat(ranked.get(0)).isEqualTo(unseen);
    }

    @Test
    @DisplayName("같은 사람을 하루에 여러 번 보여주지 않는다")
    void penalisesRepeatedAuthors() {
        DailyStatus repeated = status(NOW.minus(Duration.ofMinutes(2)), 30, 100);
        DailyStatus other = status(NOW.minus(Duration.ofHours(4)), 1, 10);

        List<DailyStatus> ranked = ranker.rank(
                List.of(repeated, other),
                context(Set.of(), Map.of(repeated.getUserId(), 2L), Set.of()));

        assertThat(ranked.get(0)).isEqualTo(other);
    }

    @Test
    @DisplayName("하트 '수'가 아니라 '반응률'을 본다")
    void prefersReactionRateOverRawCount() {
        // 50 hearts from 5000 views (1%) vs 5 hearts from 50 views (10%).
        DailyStatus popularButFlat = status(NOW.minus(Duration.ofHours(2)), 50, 5000);
        DailyStatus smallButLoved = status(NOW.minus(Duration.ofHours(2)), 5, 50);

        List<DailyStatus> ranked = ranker.rank(
                List.of(popularButFlat, smallButLoved),
                context(Set.of(), Map.of(), Set.of()));

        assertThat(ranked.get(0)).isEqualTo(smallButLoved);
    }

    @Test
    @DisplayName("신규 사용자는 하트가 없어도 피드에 올라온다")
    void boostsNewUsers() {
        DailyStatus newcomer = status(NOW.minus(Duration.ofHours(6)), 0, 0);
        DailyStatus established = status(NOW.minus(Duration.ofHours(5)), 8, 100);

        List<DailyStatus> ranked = ranker.rank(
                List.of(established, newcomer),
                context(Set.of(), Map.of(), Set.of(newcomer.getUserId())));

        assertThat(ranked.get(0)).isEqualTo(newcomer);
    }

    @Test
    @DisplayName("오늘 새 Current PIXME를 고른 사람은 약간의 가산점을 받지만, 상태만 남긴 사람도 노출된다")
    void freshCharacterIsABonusNotAGate() {
        DailyStatus freshLook = status(NOW.minus(Duration.ofHours(2)), 5, 50);
        set(freshLook, "freshCharacter", true);
        DailyStatus textOnly = status(NOW.minus(Duration.ofHours(2)), 5, 50);

        List<DailyStatus> ranked = ranker.rank(
                List.of(textOnly, freshLook), context(Set.of(), Map.of(), Set.of()));

        // Both appear; the fresh-character one edges ahead on an otherwise tied score.
        assertThat(ranked).containsExactlyInAnyOrder(textOnly, freshLook);
        assertThat(ranked.get(0)).isEqualTo(freshLook);
    }

    @Test
    @DisplayName("신규 사용자 쿼터는 페이지 중간에 섞여 들어간다")
    void interleavesNewUserQuota() {
        List<DailyStatus> ranked = new java.util.ArrayList<>();
        Set<UUID> newUserIds = new java.util.HashSet<>();

        for (int index = 0; index < 20; index++) {
            DailyStatus entry = status(NOW.minus(Duration.ofMinutes(index)), 0, 0);
            ranked.add(entry);
            if (index >= 15) {
                newUserIds.add(entry.getUserId());
            }
        }

        List<DailyStatus> page = ranker.applyNewUserQuota(ranked, newUserIds, 10);

        assertThat(page).hasSize(10);
        long newcomersOnPage = page.stream()
                .filter(entry -> newUserIds.contains(entry.getUserId()))
                .count();
        // 20% of 10 slots = 2 reserved.
        assertThat(newcomersOnPage).isGreaterThanOrEqualTo(2);
        // And they are not all clustered at the very top.
        assertThat(newUserIds).doesNotContain(page.get(0).getUserId());
    }

    @Test
    @DisplayName("같은 사용자·상태 조합의 지터는 요청마다 바뀌지 않는다")
    void jitterIsStableAcrossCalls() {
        List<DailyStatus> candidates = List.of(
                status(NOW.minus(Duration.ofMinutes(10)), 2, 20),
                status(NOW.minus(Duration.ofMinutes(10)), 2, 20),
                status(NOW.minus(Duration.ofMinutes(10)), 2, 20));

        FeedRanker.Context context = context(Set.of(), Map.of(), Set.of());

        assertThat(ranker.rank(candidates, context))
                .containsExactlyElementsOf(ranker.rank(candidates, context));
    }

    /* ------------------------------------------------------------ fixtures */

    private FeedRanker.Context context(
            Set<UUID> seenStatusIds, Map<UUID, Long> authorExposures, Set<UUID> newUserIds) {
        return new FeedRanker.Context(
                UUID.fromString("00000000-0000-0000-0000-0000000000ff"),
                NOW,
                Map.of(),
                0,
                authorExposures,
                seenStatusIds,
                Set.of(),
                Set.of(),
                newUserIds);
    }

    private DailyStatus status(Instant updatedAt, int hearts, int views) {
        DailyStatus status = new DailyStatus();
        set(status, "id", UUID.randomUUID());
        set(status, "userId", UUID.randomUUID());
        set(status, "statusDate", LocalDate.of(2026, 10, 7));
        set(status, "pixelCharacterId", UUID.randomUUID());
        set(status, "freshCharacter", false);
        set(status, "heartCount", hearts);
        set(status, "viewCount", views);
        set(status, "createdAt", updatedAt);
        set(status, "updatedAt", updatedAt);
        return status;
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
