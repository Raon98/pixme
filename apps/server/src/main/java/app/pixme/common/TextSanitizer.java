package app.pixme.common;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

/**
 * Normalisation and screening for every piece of user-authored text:
 * nicknames, bios, captions and tags.
 *
 * <p>This is not a content-moderation system — reporting and review are. It is
 * the cheap first pass that stops the obvious stuff (impersonating staff,
 * contact-info harvesting, slurs, zero-width character tricks) from ever being
 * stored, and it normalises confusable Unicode so a blocklist can't be
 * side-stepped with homoglyphs.
 */
@Component
public class TextSanitizer {

    /** Zero-width and bidi control characters used to disguise text. */
    private static final Pattern INVISIBLE =
            Pattern.compile("[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u206F\\uFEFF]");

    private static final Pattern CONTROL = Pattern.compile("\\p{Cntrl}");
    private static final Pattern MULTI_SPACE = Pattern.compile("\\s{2,}");

    private static final Pattern NICKNAME_ALLOWED =
            Pattern.compile("^[가-힣a-zA-Z0-9_]{2,12}$");

    private static final Pattern TAG_DISALLOWED = Pattern.compile("[^가-힣a-zA-Z0-9]");

    /** Reserved names: anything that could read as official PIXME communication. */
    private static final Set<String> RESERVED_NICKNAMES = Set.of(
            "pixme", "픽미", "admin", "administrator", "관리자", "운영자", "운영팀",
            "official", "공식", "support", "고객센터", "help", "system", "시스템",
            "pixmeteam", "픽미팀", "notice", "공지");

    /**
     * Patterns that attempt to move the conversation off-platform before any
     * mutual consent exists — the most common vector for scams on an app with
     * no identity verification.
     */
    private static final List<Pattern> CONTACT_PATTERNS = List.of(
            Pattern.compile("01[0-9][\\s-]?\\d{3,4}[\\s-]?\\d{4}"),
            Pattern.compile("[\\w.+-]+@[\\w-]+\\.[\\w.]+"),
            Pattern.compile("(?i)(카톡|카카오톡|kakao|오픈채팅|open\\s?chat)\\s*[:＝=]?\\s*\\S+"),
            Pattern.compile("(?i)(텔레|telegram|t\\.me)\\s*[:＝=]?\\s*\\S+"),
            Pattern.compile("(?i)(insta|인스타)\\s*[:＝=]?\\s*@?\\w{3,}"));

    /**
     * Minimal slur / explicit-term blocklist. Kept short on purpose: an
     * aggressive list produces false positives in Korean, and the real defence
     * is report + review. Extend via configuration, not by growing this.
     */
    private static final Set<String> BLOCKED_TERMS = Set.of(
            "씨발", "병신", "좆", "보지", "자살", "강간", "섹파", "조건만남",
            "fuck", "shit", "bitch", "rape", "nigger", "faggot");

    public String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String value = Normalizer.normalize(raw, Normalizer.Form.NFKC);
        value = INVISIBLE.matcher(value).replaceAll("");
        value = CONTROL.matcher(value).replaceAll(" ");
        value = MULTI_SPACE.matcher(value).replaceAll(" ");
        return value.trim();
    }

    /** @return the normalised nickname, or throws with the specific reason. */
    public String sanitizeNickname(String raw) {
        String value = normalize(raw);
        if (value == null || value.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "닉네임을 입력해주세요.");
        }
        if (!NICKNAME_ALLOWED.matcher(value).matches()) {
            throw new ApiException(
                    ErrorCode.VALIDATION_FAILED, "닉네임은 2~12자의 한글, 영문, 숫자, _만 쓸 수 있어요.");
        }

        String folded = value.toLowerCase(Locale.ROOT).replace("_", "");
        if (RESERVED_NICKNAMES.contains(folded)) {
            throw new ApiException(ErrorCode.NICKNAME_FORBIDDEN);
        }
        if (containsBlockedTerm(value)) {
            throw new ApiException(ErrorCode.NICKNAME_FORBIDDEN);
        }
        return value;
    }

    /** Bios and captions: normalised, screened, and length-capped. */
    public String sanitizeFreeText(String raw, int maxLength, String fieldLabel) {
        String value = normalize(raw);
        if (value == null || value.isEmpty()) {
            return null;
        }
        if (value.length() > maxLength) {
            throw new ApiException(
                    ErrorCode.VALIDATION_FAILED, fieldLabel + "은(는) " + maxLength + "자까지 쓸 수 있어요.");
        }
        if (containsBlockedTerm(value)) {
            throw new ApiException(
                    ErrorCode.VALIDATION_FAILED, "사용할 수 없는 표현이 포함되어 있어요.");
        }
        if (containsContactInfo(value)) {
            throw new ApiException(
                    ErrorCode.VALIDATION_FAILED,
                    "연락처나 외부 아이디는 넣을 수 없어요. 서로 연결된 뒤 대화에서 나눠주세요.");
        }
        return value;
    }

    /** Tags are reduced to a bare word: no '#', no spaces, 12 chars max. */
    public String sanitizeTag(String raw) {
        String value = normalize(raw);
        if (value == null) {
            return null;
        }
        value = value.replaceAll("^#+", "");
        value = TAG_DISALLOWED.matcher(value).replaceAll("");
        if (value.isEmpty()) {
            return null;
        }
        if (value.length() > 12) {
            value = value.substring(0, 12);
        }
        return containsBlockedTerm(value) ? null : value;
    }

    /**
     * Chat messages are screened for blocked terms but NOT for contact info:
     * two people who have mutually consented to talk are exactly who should be
     * allowed to exchange contacts.
     */
    public String sanitizeMessage(String raw) {
        String value = normalize(raw);
        if (value == null || value.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "메시지를 입력해주세요.");
        }
        if (value.length() > 2000) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "메시지가 너무 길어요.");
        }
        return value;
    }

    public boolean containsBlockedTerm(String value) {
        String folded = value.toLowerCase(Locale.ROOT).replaceAll("[\\s._-]", "");
        return BLOCKED_TERMS.stream().anyMatch(folded::contains);
    }

    public boolean containsContactInfo(String value) {
        return CONTACT_PATTERNS.stream().anyMatch(pattern -> pattern.matcher(value).find());
    }
}
