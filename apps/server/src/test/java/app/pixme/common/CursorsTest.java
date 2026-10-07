package app.pixme.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CursorsTest {

    @Test
    @DisplayName("커서는 왕복해도 동일한 키셋을 돌려준다")
    void roundTrips() {
        Instant timestamp = Instant.parse("2026-10-07T04:05:06.789Z");
        UUID id = UUID.randomUUID();

        Cursors.Keyset decoded = Cursors.decode(Cursors.encode(timestamp, id));

        assertThat(decoded).isNotNull();
        assertThat(decoded.timestamp()).isEqualTo(timestamp);
        assertThat(decoded.id()).isEqualTo(id);
    }

    @Test
    @DisplayName("빈 커서는 첫 페이지를 의미한다")
    void treatsBlankAsFirstPage() {
        assertThat(Cursors.decode(null)).isNull();
        assertThat(Cursors.decode("")).isNull();
        assertThat(Cursors.decode("   ")).isNull();
    }

    @Test
    @DisplayName("조작된 커서는 검증 오류로 거부한다")
    void rejectsMalformedCursor() {
        assertThatThrownBy(() -> Cursors.decode("not-a-cursor"))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("커서는 불투명하다 — 원본 값이 그대로 드러나지 않는다")
    void isOpaque() {
        UUID id = UUID.randomUUID();
        String cursor = Cursors.encode(Instant.now(), id);
        assertThat(cursor).doesNotContain(id.toString());
    }
}
