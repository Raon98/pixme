package app.pixme.safety;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import app.pixme.chat.repository.MessageRepository;
import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.common.RateLimiter;
import app.pixme.common.TextSanitizer;
import app.pixme.config.PixmeProperties;
import app.pixme.connection.ConnectionService;
import app.pixme.dailystatus.repository.DailyStatusRepository;
import app.pixme.safety.domain.Block;
import app.pixme.safety.domain.Report;
import app.pixme.safety.domain.ReportReason;
import app.pixme.safety.domain.ReportStatus;
import app.pixme.safety.domain.ReportTargetType;
import app.pixme.safety.repository.BlockRepository;
import app.pixme.safety.repository.ReportRepository;
import app.pixme.user.domain.User;
import app.pixme.user.domain.UserStatus;
import app.pixme.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Blocking, reporting and automatic escalation.
 *
 * <p>Because PIXME ships without identity verification, these are the primary
 * safety controls rather than a secondary layer, and they are built to be
 * decisive:
 *
 * <ul>
 *   <li><b>Blocking is immediate and total.</b> It severs the connection, shuts
 *       the conversation and removes both users from each other's feed, square,
 *       profile and recommendations — in both directions, so the blocked person
 *       cannot tell they were blocked by what they can still see.
 *   <li><b>Reporting is cheap and acts now.</b> The reporter can block in the
 *       same action, and several independent reports against one account within
 *       a day suspend it pending human review instead of waiting for a
 *       moderator to wake up.
 * </ul>
 */
@Service
public class SafetyService {

    private static final Logger log = LoggerFactory.getLogger(SafetyService.class);

    /** Distinct reporters within {@link #ESCALATION_WINDOW} that trigger a hold. */
    private static final int ESCALATION_THRESHOLD = 3;

    private static final Duration ESCALATION_WINDOW = Duration.ofHours(24);

    /** Length of the automatic hold. A human decides what happens next. */
    private static final Duration AUTO_SUSPENSION = Duration.ofHours(72);

    private final BlockRepository blockRepository;
    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final DailyStatusRepository statusRepository;
    private final MessageRepository messageRepository;
    private final ConnectionService connectionService;
    private final TextSanitizer sanitizer;
    private final RateLimiter rateLimiter;
    private final PixmeProperties properties;

    public SafetyService(
            BlockRepository blockRepository,
            ReportRepository reportRepository,
            UserRepository userRepository,
            DailyStatusRepository statusRepository,
            MessageRepository messageRepository,
            ConnectionService connectionService,
            TextSanitizer sanitizer,
            RateLimiter rateLimiter,
            PixmeProperties properties) {
        this.blockRepository = blockRepository;
        this.reportRepository = reportRepository;
        this.userRepository = userRepository;
        this.statusRepository = statusRepository;
        this.messageRepository = messageRepository;
        this.connectionService = connectionService;
        this.sanitizer = sanitizer;
        this.rateLimiter = rateLimiter;
        this.properties = properties;
    }

    /* -------------------------------------------------------------- block */

    @Transactional
    public void block(UUID blockerId, UUID blockedId) {
        if (blockerId.equals(blockedId)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "자신을 차단할 수 없어요.");
        }

        userRepository.findActiveById(blockedId).orElseThrow(() -> ApiException.notFound("사용자"));

        try {
            blockRepository.saveAndFlush(new Block(blockerId, blockedId));
        } catch (DataIntegrityViolationException exception) {
            // Already blocked; the rest of this method is idempotent anyway.
            return;
        }

        // Blocking must take effect everywhere at once, not just in the feed.
        connectionService.sever(blockerId, blockedId);
        log.info("user={} blocked user={}", blockerId, blockedId);
    }

    @Transactional
    public void unblock(UUID blockerId, UUID blockedId) {
        blockRepository.deleteByPair(blockerId, blockedId);
    }

    @Transactional(readOnly = true)
    public List<Block> blockedBy(UUID blockerId) {
        return blockRepository.findByBlockerId(blockerId);
    }

    @Transactional(readOnly = true)
    public List<UUID> hiddenUserIds(UUID userId) {
        return blockRepository.findAllRelatedUserIds(userId);
    }

    @Transactional(readOnly = true)
    public boolean isHidden(UUID viewerId, UUID otherId) {
        return blockRepository.existsBetween(viewerId, otherId);
    }

    /* ------------------------------------------------------------- report */

    public record ReportCommand(
            ReportTargetType targetType,
            UUID targetId,
            ReportReason reason,
            String detail,
            boolean alsoBlock) {}

    @Transactional
    public void report(UUID reporterId, ReportCommand command) {
        rateLimiter.check(
                "report", reporterId, properties.rateLimit().reportPerDay(), Duration.ofDays(1));

        UUID targetUserId = resolveTargetUser(command);
        if (targetUserId != null && targetUserId.equals(reporterId)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "자신을 신고할 수 없어요.");
        }

        // Don't accumulate duplicate open reports from the same person about
        // the same thing — it inflates the escalation signal.
        boolean duplicate = reportRepository
                .existsByReporterIdAndTargetTypeAndTargetIdAndStatus(
                        reporterId, command.targetType(), command.targetId(), ReportStatus.OPEN);

        if (!duplicate) {
            String detail = command.detail() == null
                    ? null
                    : sanitizer.sanitizeFreeText(command.detail(), 500, "신고 내용");

            reportRepository.save(Report.create(
                    reporterId,
                    command.targetType(),
                    command.targetId(),
                    targetUserId,
                    command.reason(),
                    detail));

            log.info(
                    "report filed by={} target={}:{} reason={}",
                    reporterId,
                    command.targetType(),
                    command.targetId(),
                    command.reason());
        }

        if (command.alsoBlock() && targetUserId != null) {
            block(reporterId, targetUserId);
        }

        if (targetUserId != null) {
            maybeEscalate(targetUserId);
        }
    }

    /**
     * Suspends an account that several unrelated people reported in a short
     * window.
     *
     * <p>This is deliberately automatic. With no identity verification, the gap
     * between "several people report someone" and "a human looks at it" is the
     * window in which real harm happens; a time-boxed hold closes it and is
     * reversible if review clears them.
     */
    private void maybeEscalate(UUID targetUserId) {
        long reporters = reportRepository.countDistinctReportersAgainst(
                targetUserId, Instant.now().minus(ESCALATION_WINDOW));

        if (reporters < ESCALATION_THRESHOLD) {
            return;
        }

        userRepository.findActiveById(targetUserId).ifPresent(user -> {
            if (user.getStatus() == UserStatus.SUSPENDED) {
                return;
            }
            user.setStatus(UserStatus.SUSPENDED);
            user.setSuspendedUntil(Instant.now().plus(AUTO_SUSPENSION));
            user.setSuspensionReason("자동 보류: 24시간 내 신고 " + reporters + "건");
            userRepository.save(user);
            log.warn(
                    "auto-suspended user={} after {} distinct reports", targetUserId, reporters);
        });
    }

    /** Resolves the account behind a reported post or message. */
    private UUID resolveTargetUser(ReportCommand command) {
        return switch (command.targetType()) {
            case USER -> userRepository
                    .findActiveById(command.targetId())
                    .map(User::getId)
                    .orElseThrow(() -> ApiException.notFound("사용자"));
            case DAILY_STATUS -> statusRepository
                    .findById(command.targetId())
                    .map(status -> status.getUserId())
                    .orElse(null);
            case MESSAGE -> messageRepository
                    .findById(command.targetId())
                    .map(message -> message.getSenderId())
                    .orElse(null);
        };
    }
}
