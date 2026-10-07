package app.pixme.api;

import java.util.List;
import java.util.UUID;

import app.pixme.api.dto.DailyStatusDtos;
import app.pixme.common.ApiException;
import app.pixme.common.CursorPage;
import app.pixme.common.Cursors;
import app.pixme.common.ErrorCode;
import app.pixme.dailystatus.DailyStatusService;
import app.pixme.dailystatus.domain.DailyStatus;
import app.pixme.dailystatus.repository.DailyStatusRepository;
import app.pixme.feed.FeedService;
import app.pixme.pixel.GenerationService;
import app.pixme.security.AuthPrincipal;
import app.pixme.security.CurrentUser;
import app.pixme.store.CreditService;
import app.pixme.user.UserService;
import app.pixme.user.domain.UserSettings;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * "오늘의 상태" — the free half of the day, and the gate for Today/광장.
 *
 * <p>Route order matters: {@code /daily-status/today}, {@code /me} and
 * {@code /history} are declared before {@code /{dailyStatusId}} so the literal
 * paths are not swallowed by the UUID path variable.
 */
@RestController
@RequestMapping("/api/v1/daily-status")
public class DailyStatusController {

    private static final int HISTORY_PAGE_SIZE = 30;

    private final DailyStatusService dailyStatusService;
    private final DailyStatusRepository statusRepository;
    private final FeedService feedService;
    private final GenerationService generationService;
    private final CreditService creditService;
    private final UserService userService;
    private final ResponseAssembler assembler;

    public DailyStatusController(
            DailyStatusService dailyStatusService,
            DailyStatusRepository statusRepository,
            FeedService feedService,
            GenerationService generationService,
            CreditService creditService,
            UserService userService,
            ResponseAssembler assembler) {
        this.dailyStatusService = dailyStatusService;
        this.statusRepository = statusRepository;
        this.feedService = feedService;
        this.generationService = generationService;
        this.creditService = creditService;
        this.userService = userService;
        this.assembler = assembler;
    }

    /* --------------------------------------------------------------- feed */

    @GetMapping("/today")
    public CursorPage<DailyStatusDtos.StatusResponse> todayFeed(
            @CurrentUser AuthPrincipal principal,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {

        FeedService.FeedPage page = feedService.today(principal.userId(), cursor, limit);
        return CursorPage.of(
                assembler.statuses(principal.userId(), page.statuses()), page.nextCursor());
    }

    /**
     * Entry point for the create/status screen: today's own status (if any),
     * plus everything needed to decide what to offer — free allowance, and
     * whether the user has ever seen the square's visibility explanation.
     */
    @GetMapping("/me")
    public DailyStatusDtos.TodayStatusResponse myToday(@CurrentUser AuthPrincipal principal) {
        DailyStatus myToday = dailyStatusService.today(principal.userId()).orElse(null);
        CreditService.Allowance allowance = creditService.allowance(principal.userId());
        UserSettings settings = userService.settingsOf(principal.userId());
        String pendingGenerationId = generationService
                .latestUnkeptCandidate(principal.userId())
                .map(generation -> generation.getId().toString())
                .orElse(null);

        return new DailyStatusDtos.TodayStatusResponse(
                myToday == null ? null : assembler.status(principal.userId(), myToday),
                allowance.firstGenerationAvailable(),
                allowance.firstRetryAvailable(),
                allowance.bonusFreeCredits(),
                allowance.creditBalance(),
                allowance.nextGenerationIsFree(),
                pendingGenerationId,
                settings.isSquareVisible(),
                settings.isSquareOnboarded());
    }

    /**
     * Upserts today's status — free, and completely independent of generating
     * a new character. {@code pixelCharacterId} is optional: present, it is a
     * free Current PIXME switch; absent, only mood/message/tags change.
     */
    @PutMapping("/me")
    public DailyStatusDtos.StatusResponse upsertMyToday(
            @CurrentUser AuthPrincipal principal,
            @Valid @RequestBody DailyStatusDtos.UpsertStatusRequest request) {

        UUID pixelCharacterId = request.pixelCharacterId() == null || request.pixelCharacterId().isBlank()
                ? null
                : parseUuid(request.pixelCharacterId());

        DailyStatus status = dailyStatusService.upsertStatus(
                principal.userId(), request.mood(), request.message(), request.tags(), pixelCharacterId);
        return assembler.status(principal.userId(), status);
    }

    /* ------------------------------------------------------------ history */

    @GetMapping("/history")
    public CursorPage<DailyStatusDtos.StatusSummaryResponse> myHistory(
            @CurrentUser AuthPrincipal principal,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "" + HISTORY_PAGE_SIZE) int limit) {

        int capped = Math.min(Math.max(limit, 1), 60);
        Cursors.Keyset keyset = Cursors.decode(cursor);

        List<DailyStatus> statuses = statusRepository.findHistory(
                principal.userId(),
                Cursors.dateOrOpen(keyset),
                Cursors.idOrOpen(keyset),
                org.springframework.data.domain.PageRequest.of(0, capped + 1));

        boolean hasMore = statuses.size() > capped;
        List<DailyStatus> page = hasMore ? statuses.subList(0, capped) : statuses;

        String nextCursor = hasMore && !page.isEmpty()
                ? Cursors.encodeDate(
                        page.get(page.size() - 1).getStatusDate(), page.get(page.size() - 1).getId())
                : null;

        return CursorPage.of(assembler.statusSummaries(page), nextCursor);
    }

    /* ------------------------------------------------------------- detail */

    @GetMapping("/{dailyStatusId}")
    public DailyStatusDtos.StatusResponse detail(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID dailyStatusId) {
        DailyStatus status = statusRepository
                .findById(dailyStatusId)
                .orElseThrow(() -> ApiException.notFound("오늘의 상태"));
        return assembler.status(principal.userId(), status);
    }

    private UUID parseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "잘못된 요청이에요.");
        }
    }
}
