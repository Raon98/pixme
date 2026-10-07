package app.pixme.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The day boundary is a product rule — one representative PIXME per day — so it
 * gets its own test. A post made at 1am KST must belong to that night, not to
 * the previous UTC day.
 */
class ServiceClockTest {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    @Test
    @DisplayName("한국 시간 자정 직후는 그 날의 날짜다")
    void resolvesTodayInServiceTimezone() {
        // 2026-10-07T00:30 KST == 2026-10-06T15:30Z
        ServiceClock clock = new ServiceClock(
                Clock.fixed(Instant.parse("2026-10-06T15:30:00Z"), SEOUL), SEOUL);

        assertThat(clock.today()).isEqualTo(LocalDate.of(2026, 10, 7));
    }

    @Test
    @DisplayName("한국 시간 자정 직전은 아직 전날이다")
    void resolvesYesterdayJustBeforeMidnight() {
        // 2026-10-06T23:30 KST == 2026-10-06T14:30Z
        ServiceClock clock = new ServiceClock(
                Clock.fixed(Instant.parse("2026-10-06T14:30:00Z"), SEOUL), SEOUL);

        assertThat(clock.today()).isEqualTo(LocalDate.of(2026, 10, 6));
    }

    @Test
    @DisplayName("무료 생성은 한국 시간 다음날 0시에 초기화된다")
    void nextDayStartIsLocalMidnight() {
        ServiceClock clock = new ServiceClock(
                Clock.fixed(Instant.parse("2026-10-06T15:30:00Z"), SEOUL), SEOUL);

        // Next reset is 2026-10-08T00:00 KST == 2026-10-07T15:00Z
        assertThat(clock.nextDayStart()).isEqualTo(Instant.parse("2026-10-07T15:00:00Z"));
    }
}
