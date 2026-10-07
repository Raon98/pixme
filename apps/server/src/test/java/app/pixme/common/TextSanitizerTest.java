package app.pixme.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TextSanitizerTest {

    private final TextSanitizer sanitizer = new TextSanitizer();

    @Test
    @DisplayName("닉네임은 한글·영문·숫자·밑줄만 허용한다")
    void acceptsValidNicknames() {
        assertThat(sanitizer.sanitizeNickname("밍밍")).isEqualTo("밍밍");
        assertThat(sanitizer.sanitizeNickname("ming_2")).isEqualTo("ming_2");
        assertThat(sanitizer.sanitizeNickname("  여백있음  ")).isEqualTo("여백있음");
    }

    @ParameterizedTest
    @ValueSource(strings = {"밍", "a", "열두자를넘어가는아주긴닉네임", "ming!", "ming ming", "밍 밍"})
    @DisplayName("길이·문자 규칙을 어기면 거부한다")
    void rejectsInvalidNicknames(String nickname) {
        assertThatThrownBy(() -> sanitizer.sanitizeNickname(nickname))
                .isInstanceOf(ApiException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"pixme", "PIXME", "픽미", "관리자", "운영팀", "p_i_x_m_e"})
    @DisplayName("운영자로 오인될 닉네임은 막는다")
    void rejectsReservedNicknames(String nickname) {
        assertThatThrownBy(() -> sanitizer.sanitizeNickname(nickname))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.NICKNAME_FORBIDDEN);
    }

    @Test
    @DisplayName("보이지 않는 문자로 규칙을 우회할 수 없다")
    void stripsInvisibleCharacters() {
        // Zero-width space inside a reserved name — the classic bypass.
        assertThatThrownBy(() -> sanitizer.sanitizeNickname("pix​me"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("한줄소개에 연락처를 넣을 수 없다")
    void rejectsContactInfoInBio() {
        assertThatThrownBy(() -> sanitizer.sanitizeFreeText("카톡 abcd123 주세요", 60, "한줄소개"))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> sanitizer.sanitizeFreeText("010-1234-5678", 60, "한줄소개"))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> sanitizer.sanitizeFreeText("me@example.com", 60, "한줄소개"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("연결된 사이의 메시지에서는 연락처를 막지 않는다")
    void allowsContactInfoInMessages() {
        // Two people who mutually consented to talk are exactly who should be
        // able to exchange contacts.
        assertThat(sanitizer.sanitizeMessage("내 카톡은 ming123이야"))
                .isEqualTo("내 카톡은 ming123이야");
    }

    @Test
    @DisplayName("태그는 # 과 공백을 제거하고 12자로 자른다")
    void normalizesTags() {
        assertThat(sanitizer.sanitizeTag("#꾸안꾸")).isEqualTo("꾸안꾸");
        assertThat(sanitizer.sanitizeTag("  ## 올 블랙 ")).isEqualTo("올블랙");
        assertThat(sanitizer.sanitizeTag("###")).isNull();
        assertThat(sanitizer.sanitizeTag("아주아주아주아주긴태그입니다").length()).isEqualTo(12);
    }

    @Test
    @DisplayName("빈 한줄소개는 null 로 정규화한다")
    void normalizesEmptyBioToNull() {
        assertThat(sanitizer.sanitizeFreeText("   ", 60, "한줄소개")).isNull();
        assertThat(sanitizer.sanitizeFreeText(null, 60, "한줄소개")).isNull();
    }
}
