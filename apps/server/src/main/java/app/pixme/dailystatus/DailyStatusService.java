package app.pixme.dailystatus;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import app.pixme.common.ApiException;
import app.pixme.common.ServiceClock;
import app.pixme.dailystatus.domain.DailyStatus;
import app.pixme.dailystatus.domain.DailyStatusTag;
import app.pixme.dailystatus.repository.DailyStatusRepository;
import app.pixme.dailystatus.repository.DailyStatusTagRepository;
import app.pixme.pixel.domain.UserCurrentPixel;
import app.pixme.pixel.repository.UserCurrentPixelRepository;
import app.pixme.square.SquareService;
import app.pixme.user.domain.UserStats;
import app.pixme.user.repository.UserStatsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "오늘의 상태" — the free, independent-of-generation half of the old post.
 *
 * <p>Every write here goes through one of two paths:
 *
 * <ul>
 *   <li>{@link #ensureTodayPointsAt} — a Current PIXME change landed on today.
 *       Called from {@code PixelCharacterService}, never charges anything, and
 *       creates today's row if none exists yet so a switch is always visible.
 *   <li>{@link #upsertStatus} — the user edited mood/message/tags directly,
 *       completely independent of whether they generated anything today.
 * </ul>
 *
 * <p>Both paths touch {@link SquareService#recordPresenceIfVisible} so that
 * showing up in the square follows naturally from being active today, with no
 * separate "enter the square" action required when the user has already
 * opted in via {@code square_visible}.
 */
@Service
public class DailyStatusService {

    private final DailyStatusRepository statusRepository;
    private final DailyStatusTagRepository tagRepository;
    private final UserCurrentPixelRepository currentPixelRepository;
    private final UserStatsRepository statsRepository;
    private final SquareService squareService;
    private final ServiceClock clock;

    public DailyStatusService(
            DailyStatusRepository statusRepository,
            DailyStatusTagRepository tagRepository,
            UserCurrentPixelRepository currentPixelRepository,
            UserStatsRepository statsRepository,
            SquareService squareService,
            ServiceClock clock) {
        this.statusRepository = statusRepository;
        this.tagRepository = tagRepository;
        this.currentPixelRepository = currentPixelRepository;
        this.statsRepository = statsRepository;
        this.squareService = squareService;
        this.clock = clock;
    }

    @Transactional
    public DailyStatus ensureTodayPointsAt(UUID userId, UUID pixelCharacterId) {
        LocalDate today = clock.today();
        DailyStatus status = statusRepository
                .findByUserIdAndStatusDate(userId, today)
                .orElseGet(() -> DailyStatus.createFor(userId, today, pixelCharacterId));
        // Always goes through syncCharacter, even for a brand-new row pointing
        // at the same character it was created with, so "fresh" is true the
        // moment a character was just chosen — not just on a later switch.
        status.syncCharacter(pixelCharacterId);

        DailyStatus saved = statusRepository.save(status);
        recordEngagement(userId, today);
        squareService.recordPresenceIfVisible(userId);
        return saved;
    }

    /**
     * Pure or combined status edit. {@code pixelCharacterId} is optional — a
     * text-only edit keeps whatever character today already points at, and a
     * user with no row yet and no explicit character falls back to their
     * current Collection pick.
     */
    @Transactional
    public DailyStatus upsertStatus(
            UUID userId, String mood, String message, List<String> tags, UUID pixelCharacterId) {

        LocalDate today = clock.today();
        List<String> safeTags = tags == null ? List.of() : tags;

        DailyStatus status = statusRepository.findByUserIdAndStatusDate(userId, today).orElse(null);
        if (status == null) {
            UUID characterId = pixelCharacterId != null
                    ? pixelCharacterId
                    : currentPixelRepository
                            .findByUserId(userId)
                            .map(UserCurrentPixel::getPixelCharacterId)
                            .orElseThrow(() -> new ApiException(
                                    app.pixme.common.ErrorCode.VALIDATION_FAILED,
                                    "먼저 PIXME를 만들어주세요."));
            status = DailyStatus.createFor(userId, today, characterId);
        } else if (pixelCharacterId != null) {
            status.syncCharacter(pixelCharacterId);
        }

        status.editStatus(mood, message);
        DailyStatus saved = statusRepository.save(status);

        tagRepository.deleteByDailyStatusId(saved.getId());
        for (String tag : safeTags) {
            tagRepository.save(new DailyStatusTag(saved.getId(), tag));
        }

        recordEngagement(userId, today);
        squareService.recordPresenceIfVisible(userId);
        return saved;
    }

    @Transactional(readOnly = true)
    public Optional<DailyStatus> today(UUID userId) {
        return statusRepository.findByUserIdAndStatusDate(userId, clock.today());
    }

    @Transactional(readOnly = true)
    public List<String> tagsOf(UUID dailyStatusId) {
        return tagRepository.findTagsByDailyStatusId(dailyStatusId);
    }

    @Transactional(readOnly = true)
    public Map<UUID, List<String>> tagsOf(Collection<UUID> dailyStatusIds) {
        Map<UUID, List<String>> tags = new HashMap<>();
        for (Object[] row : tagRepository.findTagsByDailyStatusIds(dailyStatusIds)) {
            tags.computeIfAbsent((UUID) row[0], key -> new ArrayList<>()).add((String) row[1]);
        }
        return tags;
    }

    private void recordEngagement(UUID userId, LocalDate today) {
        UserStats stats = statsRepository
                .findById(userId)
                .orElseGet(() -> statsRepository.save(UserStats.createFor(userId)));
        stats.recordStatus(today);
        statsRepository.save(stats);
    }
}
