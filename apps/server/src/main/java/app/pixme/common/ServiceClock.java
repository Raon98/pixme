package app.pixme.common;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

import app.pixme.config.PixmeProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * The service's notion of "now" and, more importantly, of "today".
 *
 * <p>PIXME's central rule is one representative PIXME per day, so the day
 * boundary is a product decision, not an incidental detail. Everything is
 * stored as UTC instants, but {@code postDate} is resolved in the service
 * timezone (KST) so a post made at 1am belongs to that night, matching what
 * users experience. Injecting this makes the boundary testable.
 */
@Component
public class ServiceClock {

    private final Clock clock;
    private final ZoneId zone;

    @Autowired
    public ServiceClock(PixmeProperties properties) {
        this.zone = ZoneId.of(properties.timezone());
        this.clock = Clock.system(this.zone);
    }

    /** Test seam: lets a test pin "today" and exercise the day boundary. */
    ServiceClock(Clock clock, ZoneId zone) {
        this.clock = clock;
        this.zone = zone;
    }

    public Instant now() {
        return clock.instant();
    }

    public ZoneId zone() {
        return zone;
    }

    /** The calendar day a PIXME created right now belongs to. */
    public LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), zone);
    }

    public LocalDate dateOf(Instant instant) {
        return LocalDate.ofInstant(instant, zone);
    }

    public LocalDateTime localNow() {
        return LocalDateTime.ofInstant(clock.instant(), zone);
    }

    /** Start of tomorrow — when the free daily generation resets. */
    public Instant nextDayStart() {
        return today().plusDays(1).atStartOfDay(zone).toInstant();
    }
}
