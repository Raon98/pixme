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
     * Slur / explicit-term blocklist, grouped by why each term is here. Kept
     * to clearly dehumanizing or explicit terms on purpose — a list aggressive
     * enough to catch every possible phrasing produces false positives in
     * Korean (common syllables inside ordinary words), and the real backstop
     * for anything that slips through is report + review, not this list.
     * Extend via configuration if this keeps growing, not by hand-editing it
     * indefinitely.
     */
    private static final Set<String> BLOCKED_TERMS = Set.of(
            // profanity
            "씨발", "병신", "좆",
            "ㅅㅂ", "ㅄ", "ㅂㅅ", "ㅈㄴ",
            "fuck", "shit", "bitch",
            // sexual / solicitation — this is not a dating app, and these are
            // exactly the words that turn a nickname or bio into one
            "보지", "자지", "섹스", "섹파", "조건만남", "성매매", "매춘", "떡치자", "몸캠",
            "sex", "porn", "nude",
            // self-harm / violent
            "자살", "강간", "rape",
            // dehumanizing slurs — ethnicity, disability, age, gender
            "짱깨", "쪽바리", "왜놈", "흑형", "애자", "장애자",
            "급식충", "맘충", "한남충", "김치녀", "틀딱",
            "nigger", "faggot");

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

    /**
     * Leetspeak/repetition tricks that dodge a bare substring match: digits
     * standing in for lookalike letters ({@code 시1발}), and a character
     * repeated to break up the word ({@code ㅅㅂㅂㅂ}, {@code 시이발}). Applied on
     * top of the existing separator-stripping fold, not instead of it.
     *
     * <p>Deliberately not attempting full Hangul jamo decomposition (ㅅ+ㅣ+ㅂ
     * from 씨), since Korean consonant-only typing (ㅅㅂ, ㅄ) already passes
     * through untouched by NFKC and is cheap to blocklist directly instead —
     * see {@link #BLOCKED_TERMS}.
     */
    private static final Pattern LEET_DIGIT = Pattern.compile("[1](?=[가-힣a-z])");
    private static final Pattern REPEATED_CHAR = Pattern.compile("(.)\\1{1,}");

    public boolean containsBlockedTerm(String value) {
        String base = value.toLowerCase(Locale.ROOT).replaceAll("[\\s._-]", "");
        String folded = LEET_DIGIT.matcher(base).replaceAll("이");
        String collapsed = REPEATED_CHAR.matcher(folded).replaceAll("$1");
        return BLOCKED_TERMS.stream()
                .anyMatch(term -> folded.contains(term) || collapsed.contains(term));
    }

    public boolean containsContactInfo(String value) {
        return CONTACT_PATTERNS.stream().anyMatch(pattern -> pattern.matcher(value).find());
    }
}
