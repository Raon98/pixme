package app.pixme.job;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import app.pixme.common.ServiceClock;
import app.pixme.notification.NotificationService;
import app.pixme.pixel.repository.PixelPostRepository;
import app.pixme.user.domain.UserStatus;
import app.pixme.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The one proactive nudge in the product.
 *
 * <p>Sent once a day, in the evening (when people have something to show from
 * their day), and <em>only</em> to users who have not already published. Three
 * suppressions are deliberate and matter more than the send itself: already
 * posted today, inactive for weeks, or notifications disabled. A reminder to do
 * something you already did is the fastest way to get an app muted.
 */
@Component
public class DailyReminderJob {

    private static final Logger log = LoggerFactory.getLogger(DailyReminderJob.class);

    /** Only nudge people who have opened the app recently. */
    private static final int ACTIVE_WITHIN_DAYS = 14;

    private final UserRepository userRepository;
    private final PixelPostRepository postRepository;
    private final NotificationService notificationService;
    private final ServiceClock clock;

    public DailyReminderJob(
            UserRepository userRepository,
            PixelPostRepository postRepository,
            NotificationService notificationService,
            ServiceClock clock) {
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.notificationService = notificationService;
        this.clock = clock;
    }

    /** 19:30 in the service timezone. */
    @Scheduled(cron = "0 30 19 * * *", zone = "Asia/Seoul")
    @Transactional(readOnly = true)
    public void run() {
        LocalDate today = clock.today();
        List<UUID> candidates = userRepository.findActiveSince(
                UserStatus.ACTIVE, clock.now().minus(java.time.Duration.ofDays(ACTIVE_WITHIN_DAYS)));

        int sent = 0;
        for (UUID userId : candidates) {
            if (postRepository.findRepresentative(userId, today).isPresent()) {
                continue;
            }
            try {
                notificationService.sendDailyReminder(userId);
                sent++;
            } catch (RuntimeException exception) {
                log.debug("reminder failed for user={}", userId);
            }
        }
        log.info("daily reminder sent to {}/{} candidate(s)", sent, candidates.size());
    }
}
