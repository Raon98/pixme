package app.pixme.square;

import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import app.pixme.common.ServiceClock;
import app.pixme.config.PixmeProperties;
import app.pixme.connection.repository.ConnectionRepository;
import app.pixme.connection.repository.ConnectionRequestRepository;
import app.pixme.dailystatus.domain.DailyStatus;
import app.pixme.dailystatus.repository.DailyStatusRepository;
import app.pixme.pixel.domain.PixelCharacter;
import app.pixme.pixel.repository.PixelCharacterRepository;
import app.pixme.pixel.repository.UserCurrentPixelRepository;
import app.pixme.safety.repository.BlockRepository;
import app.pixme.square.domain.SquarePlacement;
import app.pixme.square.domain.SquarePresence;
import app.pixme.square.domain.SquareScene;
import app.pixme.square.repository.SquarePlacementRepository;
import app.pixme.square.repository.SquarePresenceRepository;
import app.pixme.square.repository.SquareSceneRepository;
import app.pixme.user.domain.UserSettings;
import app.pixme.user.domain.UserStatus;
import app.pixme.user.repository.UserRepository;
import app.pixme.user.repository.UserSettingsRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 오늘의 광장 — the 2D space holding everyone active today who has opted in.
 *
 * <p>Presence, not publishing, is the gate: a {@link SquarePresence} row only
 * means "active today with {@code user_settings.square_visible} on" — it has
 * nothing to do with whether the user generated anything today. What renders
 * for each occupant is always their live {@link PixelCharacter} via
 * {@code UserCurrentPixel}, resolved at read time, so switching Current PIXME
 * updates the square immediately without touching presence at all.
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

    private static final Logger log = LoggerFactory.getLogger(SquareService.class);

    /** "Active now" window for the 지금 활동 중 rail. */
    private static final Duration ACTIVE_WINDOW = Duration.ofMinutes(30);

    /**
     * How often the visible subset rotates on a day the square is over
     * capacity. An hour, not a refresh-to-refresh shuffle: the square must
     * still look the same to everyone looking at it right now — see the
     * class-level note about a stable arrangement — this only changes who
     * that arrangement includes, and only between hours.
     */
    private static final int ROTATION_WINDOW_HOURS = 1;

    /**
     * Hard ceiling on how many presence rows a single read loads before
     * rotation selection runs — not the visible capacity (that is
     * {@code properties.square().pageSize()}), just a guard against an
     * unbounded query if presence volume is ever far beyond anything the UI
     * is designed for.
     */
    private static final int PRESENCE_FETCH_CEILING = 2000;

    /**
     * Depth is meaningless for a prop exclusion point — it only ever feeds the
     * allocator's distance check, never gets persisted or rendered.
     */
    private static final short PROP_EXCLUSION_DEPTH = 0;

    private final SquarePresenceRepository presenceRepository;
    private final SquarePlacementRepository placementRepository;
    private final SquareSceneRepository sceneRepository;
    private final BlockRepository blockRepository;
    private final ConnectionRepository connectionRepository;
    private final ConnectionRequestRepository connectionRequestRepository;
    private final UserRepository userRepository;
    private final UserSettingsRepository settingsRepository;
    private final UserCurrentPixelRepository currentPixelRepository;
    private final PixelCharacterRepository characterRepository;
    private final DailyStatusRepository statusRepository;
    private final SquarePlacementAllocator allocator;
    private final ServiceClock clock;
    private final PixmeProperties properties;
    private final ObjectMapper objectMapper;

    public SquareService(
            SquarePresenceRepository presenceRepository,
            SquarePlacementRepository placementRepository,
            SquareSceneRepository sceneRepository,
            BlockRepository blockRepository,
            ConnectionRepository connectionRepository,
            ConnectionRequestRepository connectionRequestRepository,
            UserRepository userRepository,
            UserSettingsRepository settingsRepository,
            UserCurrentPixelRepository currentPixelRepository,
            PixelCharacterRepository characterRepository,
            DailyStatusRepository statusRepository,
            SquarePlacementAllocator allocator,
            ServiceClock clock,
            PixmeProperties properties,
            ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.presenceRepository = presenceRepository;
        this.placementRepository = placementRepository;
        this.sceneRepository = sceneRepository;
        this.blockRepository = blockRepository;
        this.connectionRepository = connectionRepository;
        this.connectionRequestRepository = connectionRequestRepository;
        this.userRepository = userRepository;
        this.settingsRepository = settingsRepository;
        this.currentPixelRepository = currentPixelRepository;
        this.characterRepository = characterRepository;
        this.statusRepository = statusRepository;
        this.allocator = allocator;
        this.clock = clock;
        this.properties = properties;
    }

    public record Occupant(
            SquarePresence presence,
            PixelCharacter character,
            DailyStatus status,
            SquarePlacement placement) {}

    public enum CurationCode {
        HEARTS,
        FRESH,
        ACTIVE,
        RECURRING
    }

    public record Curation(CurationCode code, String title, List<Occupant> occupants) {}

    public record SquareView(
            SquareScene scene, List<Occupant> occupants, List<Curation> curations, int totalCount) {}

    /* --------------------------------------------------------------- read */

    @Transactional
    public SquareView today(UUID viewerId, Integer requestedLimit) {
        int limit = requestedLimit == null || requestedLimit <= 0
                ? properties.square().pageSize()
                : Math.min(requestedLimit, 80);

        LocalDate today = clock.today();
        // Same exclusion set as the feed — blocks, people already connected
        // to (the square's job is to surface who's around, not to keep
        // re-showing someone you already have a conversation with), and
        // today's unmatched waves (forgettable, not a lasting block). See
        // FeedService#exclusionsFor for the full rationale.
        Set<UUID> excludedSet = new HashSet<>(blockRepository.findAllRelatedUserIds(viewerId));
        excludedSet.addAll(connectionRepository.findPeerIds(viewerId));
        excludedSet.addAll(connectionRequestRepository.findTargetsWavedSince(
                viewerId, today.atStartOfDay(clock.zone()).toInstant()));
        List<UUID> excluded = List.copyOf(excludedSet);
        boolean excludedIsEmpty = excluded.isEmpty();
        List<UUID> excludedOrPlaceholder = excludedIsEmpty ? List.of(viewerId) : excluded;

        List<SquarePresence> eligible = presenceRepository.findOccupants(
                today, excludedOrPlaceholder, excludedIsEmpty,
                PageRequest.of(0, PRESENCE_FETCH_CEILING));
        List<SquarePresence> presences = rotateToCapacity(eligible, today, limit, viewerId);

        // Resolved before placement so a brand-new placement today can steer
        // clear of this scene's furniture — see withPlacements.
        SquareScene scene = resolveScene();
        List<Occupant> occupants = withPlacements(today, presences, scene);
        List<Curation> curations = buildCurations(today, excludedOrPlaceholder, excludedIsEmpty, scene);

        return new SquareView(scene, occupants, curations, occupants.size());
    }

    /**
     * Opt-in presence touch. Called from self-viewing {@code /square/today}
     * and from every {@code DailyStatus} write — never silently from anywhere
     * else, since standing in the square means other people can see you.
     */
    @Transactional
    public void recordPresenceIfVisible(UUID userId) {
        boolean visible = settingsRepository
                .findById(userId)
                .map(UserSettings::isSquareVisible)
                .orElse(false);
        if (!visible) {
            return;
        }

        LocalDate today = clock.today();
        presenceRepository
                .findByKeyUserIdAndKeyPresenceDate(userId, today)
                .ifPresentOrElse(
                        presence -> {
                            presence.touch();
                            presenceRepository.save(presence);
                        },
                        () -> presenceRepository.save(new SquarePresence(userId, today)));
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

    /**
     * Picks who's visible when a day's presence exceeds capacity.
     *
     * <p>Without this, {@code order by enteredAt asc} plus a row limit means
     * whoever opted in earliest in the day occupies every slot permanently —
     * anyone who shows up after the square fills never appears at all, for
     * the rest of that day. Instead: under capacity, everyone is shown, same
     * as before. Over capacity, the visible set is a deterministic hash of
     * (day, hour, userId), so it is identical for every viewer within one
     * hour — no refresh-to-refresh shuffle — and changes composition at the
     * next hour boundary, so staying present long enough eventually gets
     * everyone a turn instead of locking out everyone after the first
     * {@code pageSize}.
     *
     * <p>The viewer's own presence is exempted from rotation — standing in a
     * square that sometimes doesn't show you *your own self* reads as broken,
     * not as fair rotation, so "everyone gets a turn" applies to everyone
     * else's turn, never to whether you can find yourself.
     */
    private List<SquarePresence> rotateToCapacity(
            List<SquarePresence> eligible, LocalDate today, int limit, UUID viewerId) {
        if (eligible.size() <= limit) {
            return eligible;
        }

        int hourBucket = clock.localNow().getHour() / ROTATION_WINDOW_HOURS;
        long seed = today.toEpochDay() * 31L + hourBucket;

        SquarePresence self = null;
        List<SquarePresence> others = new ArrayList<>(eligible.size());
        for (SquarePresence presence : eligible) {
            if (presence.getUserId().equals(viewerId)) {
                self = presence;
            } else {
                others.add(presence);
            }
        }

        others.sort(Comparator.comparingLong(
                presence -> rotationKey(seed, presence.getUserId())));

        int remaining = self != null ? limit - 1 : limit;
        List<SquarePresence> result = new ArrayList<>(limit);
        if (self != null) {
            result.add(self);
        }
        result.addAll(others.subList(0, Math.min(remaining, others.size())));
        return result;
    }

    /** A presence's sort key for one rotation window — stable, not sequential. */
    private long rotationKey(long seed, UUID userId) {
        long mixed = seed ^ userId.getMostSignificantBits() ^ userId.getLeastSignificantBits();
        // SplitMix64 finalizer: cheap, well-distributed, no java.util.Random
        // instance to allocate per row.
        mixed = (mixed ^ (mixed >>> 30)) * 0xbf58476d1ce4e5b9L;
        mixed = (mixed ^ (mixed >>> 27)) * 0x94d049bb133111ebL;
        return mixed ^ (mixed >>> 31);
    }

    /** Scene furniture coordinates, as exclusion points for the allocator. */
    private List<SquarePlacementAllocator.Point> propPoints(SquareScene scene) {
        if (scene == null) {
            return List.of();
        }
        try {
            JsonNode node = objectMapper.readTree(scene.getPropsJson());
            List<SquarePlacementAllocator.Point> points = new ArrayList<>(node.size());
            node.forEach(prop -> points.add(new SquarePlacementAllocator.Point(
                    prop.path("x").asInt(), prop.path("y").asInt(), PROP_EXCLUSION_DEPTH)));
            return points;
        } catch (Exception exception) {
            log.warn("could not parse scene props for placement exclusion", exception);
            return List.of();
        }
    }

    /* ---------------------------------------------------------- resolution */

    /**
     * Ensures every occupant has a stable coordinate, allocating for any that
     * are new since the last read, and resolves each one's live Current PIXME
     * and today's status alongside it.
     */
    private List<Occupant> withPlacements(
            LocalDate today, List<SquarePresence> presences, SquareScene scene) {
        if (presences.isEmpty()) {
            return List.of();
        }

        List<UUID> userIds = presences.stream().map(SquarePresence::getUserId).toList();

        Map<UUID, UUID> currentCharacterIds = new HashMap<>();
        for (Object[] row : currentPixelRepository.findCharacterIdsByUserIds(userIds)) {
            currentCharacterIds.put((UUID) row[0], (UUID) row[1]);
        }

        Map<UUID, PixelCharacter> charactersById = new HashMap<>();
        for (PixelCharacter character : characterRepository.findAllById(currentCharacterIds.values())) {
            charactersById.put(character.getId(), character);
        }

        Map<UUID, DailyStatus> statusesByUser = new HashMap<>();
        for (DailyStatus status : statusRepository.findByUserIdInAndStatusDate(userIds, today)) {
            statusesByUser.put(status.getUserId(), status);
        }

        Map<UUID, SquarePlacement> placementsByUser = new LinkedHashMap<>();
        for (SquarePlacement placement : placementRepository.findForUsers(today, userIds)) {
            placementsByUser.put(placement.getUserId(), placement);
        }

        List<SquarePlacement> allToday = placementRepository.findByKeyPresenceDateOrderByYAsc(today);
        List<SquarePlacementAllocator.Point> taken = new ArrayList<>(allocator.toPoints(allToday));
        // So a brand-new placement lands clear of the tree/bench/sign the
        // scene is dressed with, rather than landing on top of one and
        // getting drawn under it. Placements already saved from an earlier
        // scene (e.g. before a day→night switch) aren't retroactively moved —
        // they stay stable by design — so the client additionally renders
        // every occupant above scene props regardless, as the real guarantee.
        taken.addAll(propPoints(scene));

        List<Occupant> occupants = new ArrayList<>(presences.size());
        for (SquarePresence presence : presences) {
            UUID userId = presence.getUserId();
            PixelCharacter character = charactersById.get(currentCharacterIds.get(userId));
            if (character == null) {
                // No Current PIXME yet (never generated) — nothing to render.
                continue;
            }

            SquarePlacement placement = placementsByUser.get(userId);
            if (placement == null) {
                placement = allocateFor(today, userId, taken);
            }

            taken.add(new SquarePlacementAllocator.Point(
                    placement.getX(), placement.getY(), placement.getDepth()));
            occupants.add(new Occupant(presence, character, statusesByUser.get(userId), placement));
        }

        // Painter's order: further back first, so a front-row character
        // correctly overlaps someone standing behind them.
        occupants.sort(Comparator.comparingInt(occupant -> occupant.placement().getY()));
        return occupants;
    }

    private SquarePlacement allocateFor(
            LocalDate today, UUID userId, List<SquarePlacementAllocator.Point> taken) {

        long seed = today.toEpochDay() * 31L + userId.getLeastSignificantBits();
        SquarePlacementAllocator.Point point = allocator.allocate(taken, seed);

        short idleVariant = (short) Math.abs(userId.hashCode() % 3);
        SquarePlacement placement =
                new SquarePlacement(today, userId, point.x(), point.y(), point.depth(), idleVariant);

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
     *   <li><b>Room for newcomers.</b> The "just arrived" rail is pure
     *       presence recency, which guarantees someone who just entered is
     *       visible regardless of how many hearts they have.
     * </ul>
     */
    private List<Curation> buildCurations(
            LocalDate today, List<UUID> excluded, boolean excludedIsEmpty, SquareScene scene) {

        int size = properties.square().curationSize();
        var page = PageRequest.of(0, size * 4);

        List<SquarePresence> pool = presenceRepository.findOccupants(today, excluded, excludedIsEmpty, page);
        List<Occupant> candidates = withPlacements(today, pool, scene);

        Set<UUID> featured = new HashSet<>();
        List<Curation> curations = new ArrayList<>(4);

        /* 🔥 오늘 많이 받은 하트 — rate-weighted, not a raw count ranking. */
        List<Occupant> hearted = candidates.stream()
                .filter(occupant -> occupant.status() != null)
                .sorted(Comparator.comparingDouble(this::heartScore).reversed())
                .filter(occupant -> featured.add(occupant.presence().getUserId()))
                .limit(size)
                .toList();
        if (!hearted.isEmpty()) {
            curations.add(new Curation(CurationCode.HEARTS, "🔥 오늘 좋아요를 많이 받은", hearted));
        }

        /* ✨ 지금 막 도착했어요 */
        List<Occupant> fresh = candidates.stream()
                .sorted(Comparator.comparing(
                        (Occupant occupant) -> occupant.presence().getEnteredAt())
                        .reversed())
                .filter(occupant -> featured.add(occupant.presence().getUserId()))
                .limit(size)
                .toList();
        if (!fresh.isEmpty()) {
            curations.add(new Curation(CurationCode.FRESH, "✨ 지금 막 도착했어요", fresh));
        }

        /* 🌙 지금 활동 중 */
        Set<UUID> activeUserIds = new HashSet<>(userRepository.findActiveSince(
                UserStatus.ACTIVE, clock.now().minus(ACTIVE_WINDOW)));
        List<Occupant> active = candidates.stream()
                .filter(occupant -> activeUserIds.contains(occupant.presence().getUserId()))
                .filter(occupant -> featured.add(occupant.presence().getUserId()))
                .limit(size)
                .toList();
        if (!active.isEmpty()) {
            curations.add(new Curation(CurationCode.ACTIVE, "🌙 지금 활동 중", active));
        }

        /* 💫 오늘 자주 보이는 PIXME — remaining room in the candidate pool. */
        List<Occupant> recurring = candidates.stream()
                .filter(occupant -> featured.add(occupant.presence().getUserId()))
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
     * <p>Rate alone over-rewards a status with 1 heart and 2 views; count
     * alone entrenches established accounts. The log term keeps big numbers
     * from dominating, and the recency term means yesterday's winner doesn't
     * sit there all of today.
     */
    private double heartScore(Occupant occupant) {
        DailyStatus status = occupant.status();
        int views = Math.max(status.getViewCount(), 1);
        double rate = (double) status.getHeartCount() / views;
        double magnitude = Math.log1p(status.getHeartCount());
        double hoursOld = Math.max(
                0, Duration.between(status.getUpdatedAt(), clock.now()).toMinutes() / 60.0);
        double freshness = Math.exp(-hoursOld / 8.0);
        return rate * 10 + magnitude * 2 + freshness * 3;
    }

    /* --------------------------------------------------------- maintenance */

    /** Keeps presence and placement tables bounded; yesterday's square is never read. */
    @Transactional
    public int pruneOldPlacements(int keepDays) {
        LocalDate threshold = clock.today().minusDays(keepDays);
        presenceRepository.deleteOlderThan(threshold);
        return placementRepository.deleteOlderThan(threshold);
    }
}
