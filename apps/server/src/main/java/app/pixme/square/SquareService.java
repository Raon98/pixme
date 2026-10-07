package app.pixme.square;

import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import app.pixme.common.ServiceClock;
import app.pixme.config.PixmeProperties;
import app.pixme.pixel.domain.PixelPost;
import app.pixme.pixel.repository.PixelPostRepository;
import app.pixme.safety.repository.BlockRepository;
import app.pixme.square.domain.SquarePlacement;
import app.pixme.square.domain.SquareScene;
import app.pixme.square.repository.SquarePlacementRepository;
import app.pixme.square.repository.SquareSceneRepository;
import app.pixme.user.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 오늘의 광장 — the 2D space holding everyone who published today.
 *
 * <p>Server-owned on purpose. Placement, scene selection and curation all
 * happen here so that:
 * <ul>
 *   <li>everyone looking at the square today sees the same arrangement,
 *   <li>a refresh doesn't shuffle the crowd,
 *   <li>and the client needs no layout, ranking or collision logic — it just
 *       draws characters at the coordinates it is given.
 * </ul>
 */
@Service
public class SquareService {

    /** "Active now" window for the 지금 활동 중 rail. */
    private static final Duration ACTIVE_WINDOW = Duration.ofMinutes(30);

    private final PixelPostRepository postRepository;
    private final SquarePlacementRepository placementRepository;
    private final SquareSceneRepository sceneRepository;
    private final BlockRepository blockRepository;
    private final UserRepository userRepository;
    private final SquarePlacementAllocator allocator;
    private final ServiceClock clock;
    private final PixmeProperties properties;

    public SquareService(
            PixelPostRepository postRepository,
            SquarePlacementRepository placementRepository,
            SquareSceneRepository sceneRepository,
            BlockRepository blockRepository,
            UserRepository userRepository,
            SquarePlacementAllocator allocator,
            ServiceClock clock,
            PixmeProperties properties) {
        this.postRepository = postRepository;
        this.placementRepository = placementRepository;
        this.sceneRepository = sceneRepository;
        this.blockRepository = blockRepository;
        this.userRepository = userRepository;
        this.allocator = allocator;
        this.clock = clock;
        this.properties = properties;
    }

    public record Occupant(PixelPost post, SquarePlacement placement) {}

    public enum CurationCode {
        HEARTS,
        FRESH,
        ACTIVE,
        RECURRING
    }

    public record Curation(CurationCode code, String title, List<PixelPost> posts) {}

    public record SquareView(
            SquareScene scene, List<Occupant> occupants, List<Curation> curations, int totalCount) {}

    /* --------------------------------------------------------------- read */

    @Transactional
    public SquareView today(UUID viewerId, Integer requestedLimit) {
        int limit = requestedLimit == null || requestedLimit <= 0
                ? properties.square().pageSize()
                : Math.min(requestedLimit, 80);

        LocalDate today = clock.today();
        List<UUID> excluded = blockRepository.findAllRelatedUserIds(viewerId);
        boolean excludedIsEmpty = excluded.isEmpty();
        List<UUID> excludedOrPlaceholder = excludedIsEmpty ? List.of(viewerId) : excluded;

        List<PixelPost> posts = postRepository.findSquareOccupants(
                today, excludedOrPlaceholder, excludedIsEmpty, PageRequest.of(0, limit));

        List<Occupant> occupants = withPlacements(today, posts);
        SquareScene scene = resolveScene();
        List<Curation> curations = buildCurations(today, excludedOrPlaceholder, excludedIsEmpty);

        return new SquareView(scene, occupants, curations, occupants.size());
    }

    /**
     * Chooses the scene for right now: highest-priority match on hour and
     * month, falling back to BASIC which always matches.
     */
    @Transactional(readOnly = true)
    public SquareScene resolveScene() {
        var now = clock.localNow();
        List<SquareScene> scenes = sceneRepository.findByActiveTrueOrderByPriorityDesc();

        return scenes.stream()
                .filter(scene -> scene.matches(now.getHour(), now.getMonthValue()))
                .findFirst()
                .orElseGet(() -> scenes.isEmpty() ? null : scenes.get(scenes.size() - 1));
    }

    /* ---------------------------------------------------------- placement */

    /**
     * Ensures every post has a stable coordinate, allocating for any that are
     * new since the last read.
     */
    private List<Occupant> withPlacements(LocalDate today, List<PixelPost> posts) {
        if (posts.isEmpty()) {
            return List.of();
        }

        List<UUID> postIds = posts.stream().map(PixelPost::getId).toList();
        Map<UUID, SquarePlacement> byPost = new LinkedHashMap<>();
        for (SquarePlacement placement : placementRepository.findForPosts(today, postIds)) {
            byPost.put(placement.getPostId(), placement);
        }

        List<SquarePlacement> allToday = placementRepository.findByKeyPostDateOrderByYAsc(today);
        List<SquarePlacementAllocator.Point> taken =
                new ArrayList<>(allocator.toPoints(allToday));

        List<Occupant> occupants = new ArrayList<>(posts.size());
        for (PixelPost post : posts) {
            SquarePlacement placement = byPost.get(post.getId());

            if (placement == null) {
                placement = allocateFor(today, post, taken);
            }

            taken.add(new SquarePlacementAllocator.Point(
                    placement.getX(), placement.getY(), placement.getDepth()));
            occupants.add(new Occupant(post, placement));
        }

        // Painter's order: further back first, so a front-row character
        // correctly overlaps someone standing behind them.
        occupants.sort(Comparator.comparingInt(occupant -> occupant.placement().getY()));
        return occupants;
    }

    private SquarePlacement allocateFor(
            LocalDate today, PixelPost post, List<SquarePlacementAllocator.Point> taken) {

        // Replacing today's representative post moves that user's spot rather
        // than adding a second character for them.
        placementRepository.deleteForUserOnDate(today, post.getUserId());

        long seed = today.toEpochDay() * 31L + post.getId().getLeastSignificantBits();
        SquarePlacementAllocator.Point point = allocator.allocate(taken, seed);

        short idleVariant = (short) Math.abs(post.getId().hashCode() % 3);
        SquarePlacement placement = new SquarePlacement(
                today, post.getId(), post.getUserId(), point.x(), point.y(), point.depth(), idleVariant);

        return placementRepository.save(placement);
    }

    /* ---------------------------------------------------------- curation */

    /**
     * The rails above the square.
     *
     * <p>Three constraints the product insists on, all enforced here:
     * <ul>
     *   <li><b>No ranks.</b> Each rail is an unordered set of people, never a
     *       1st/2nd/3rd list — this is not a leaderboard and must not read as
     *       one.
     *   <li><b>No monopoly.</b> A user appears in at most one rail, and the
     *       hearts rail mixes reaction <em>rate</em> with recency so the same
     *       popular accounts don't own it every day.
     *   <li><b>Room for newcomers.</b> The "just arrived" rail is pure recency,
     *       which guarantees someone who published a minute ago is visible
     *       regardless of how many hearts they have.
     * </ul>
     */
    private List<Curation> buildCurations(
            LocalDate today, List<UUID> excluded, boolean excludedIsEmpty) {

        int size = properties.square().curationSize();
        var page = PageRequest.of(0, size * 4);

        // Already-featured users, so one person never fills two rails.
        Set<UUID> featured = new HashSet<>();
        List<Curation> curations = new ArrayList<>(4);

        /* 🔥 오늘 많이 받은 하트 — rate-weighted, not a raw count ranking. */
        List<PixelPost> hearted = postRepository
                .findTopHearted(today, excluded, excludedIsEmpty, page)
                .stream()
                .sorted(Comparator.comparingDouble(this::heartScore).reversed())
                .filter(post -> featured.add(post.getUserId()))
                .limit(size)
                .toList();
        if (!hearted.isEmpty()) {
            curations.add(new Curation(CurationCode.HEARTS, "🔥 오늘 많이 받은 하트", hearted));
        }

        /* ✨ 지금 막 도착했어요 */
        List<PixelPost> fresh = postRepository
                .findFreshest(today, excluded, excludedIsEmpty, page)
                .stream()
                .filter(post -> featured.add(post.getUserId()))
                .limit(size)
                .toList();
        if (!fresh.isEmpty()) {
            curations.add(new Curation(CurationCode.FRESH, "✨ 지금 막 도착했어요", fresh));
        }

        /* 🌙 지금 활동 중 */
        Set<UUID> activeUserIds = new HashSet<>(userRepository.findActiveSince(
                app.pixme.user.domain.UserStatus.ACTIVE, clock.now().minus(ACTIVE_WINDOW)));
        List<PixelPost> active = postRepository
                .findSquareOccupants(today, excluded, excludedIsEmpty, page)
                .stream()
                .filter(post -> activeUserIds.contains(post.getUserId()))
                .filter(post -> featured.add(post.getUserId()))
                .limit(size)
                .toList();
        if (!active.isEmpty()) {
            curations.add(new Curation(CurationCode.ACTIVE, "🌙 지금 활동 중", active));
        }

        /* 💫 오늘 자주 보이는 PIXME — consistent posters, by streak. */
        List<PixelPost> recurring = postRepository
                .findSquareOccupants(today, excluded, excludedIsEmpty, page)
                .stream()
                .filter(post -> featured.add(post.getUserId()))
                .limit(size)
                .toList();
        if (!recurring.isEmpty()) {
            curations.add(new Curation(CurationCode.RECURRING, "💫 오늘 자주 보이는 PIXME", recurring));
        }

        return curations;
    }

    /**
     * Blends reaction rate with absolute hearts and freshness.
     *
     * <p>Rate alone over-rewards a post with 1 heart and 2 views; count alone
     * entrenches established accounts. The log term keeps big numbers from
     * dominating, and the recency term means yesterday's winner doesn't sit
     * there all of today.
     */
    private double heartScore(PixelPost post) {
        int views = Math.max(post.getViewCount(), 1);
        double rate = (double) post.getHeartCount() / views;
        double magnitude = Math.log1p(post.getHeartCount());
        var published = Optional.ofNullable(post.getPublishedAt()).orElse(post.getCreatedAt());
        double hoursOld = Math.max(0, Duration.between(published, clock.now()).toMinutes() / 60.0);
        double freshness = Math.exp(-hoursOld / 8.0);
        return rate * 10 + magnitude * 2 + freshness * 3;
    }

    /* --------------------------------------------------------- maintenance */

    /** Keeps the placement table bounded; yesterday's square is never read. */
    @Transactional
    public int pruneOldPlacements(int keepDays) {
        return placementRepository.deleteOlderThan(clock.today().minusDays(keepDays));
    }
}
