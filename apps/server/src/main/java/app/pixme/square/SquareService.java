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

    /** "Active now" window for the 지금 활동 중 rail. */
    private static final Duration ACTIVE_WINDOW = Duration.ofMinutes(30);

    private final SquarePresenceRepository presenceRepository;
    private final SquarePlacementRepository placementRepository;
    private final SquareSceneRepository sceneRepository;
    private final BlockRepository blockRepository;
    private final UserRepository userRepository;
    private final UserSettingsRepository settingsRepository;
    private final UserCurrentPixelRepository currentPixelRepository;
    private final PixelCharacterRepository characterRepository;
    private final DailyStatusRepository statusRepository;
    private final SquarePlacementAllocator allocator;
    private final ServiceClock clock;
    private final PixmeProperties properties;

    public SquareService(
            SquarePresenceRepository presenceRepository,
            SquarePlacementRepository placementRepository,
            SquareSceneRepository sceneRepository,
            BlockRepository blockRepository,
            UserRepository userRepository,
            UserSettingsRepository settingsRepository,
            UserCurrentPixelRepository currentPixelRepository,
            PixelCharacterRepository characterRepository,
            DailyStatusRepository statusRepository,
            SquarePlacementAllocator allocator,
            ServiceClock clock,
            PixmeProperties properties) {
        this.presenceRepository = presenceRepository;
        this.placementRepository = placementRepository;
        this.sceneRepository = sceneRepository;
        this.blockRepository = blockRepository;
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
        List<UUID> excluded = blockRepository.findAllRelatedUserIds(viewerId);
        boolean excludedIsEmpty = excluded.isEmpty();
        List<UUID> excludedOrPlaceholder = excludedIsEmpty ? List.of(viewerId) : excluded;

        List<SquarePresence> presences = presenceRepository.findOccupants(
                today, excludedOrPlaceholder, excludedIsEmpty, PageRequest.of(0, limit));

        List<Occupant> occupants = withPlacements(today, presences);
        SquareScene scene = resolveScene();
        List<Curation> curations = buildCurations(today, excludedOrPlaceholder, excludedIsEmpty);

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

    /* ---------------------------------------------------------- resolution */

    /**
     * Ensures every occupant has a stable coordinate, allocating for any that
     * are new since the last read, and resolves each one's live Current PIXME
     * and today's status alongside it.
     */
    private List<Occupant> withPlacements(LocalDate today, List<SquarePresence> presences) {
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
            LocalDate today, List<UUID> excluded, boolean excludedIsEmpty) {

        int size = properties.square().curationSize();
        var page = PageRequest.of(0, size * 4);

        List<SquarePresence> pool = presenceRepository.findOccupants(today, excluded, excludedIsEmpty, page);
        List<Occupant> candidates = withPlacements(today, pool);

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
            curations.add(new Curation(CurationCode.HEARTS, "🔥 오늘 많이 받은 하트", hearted));
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
