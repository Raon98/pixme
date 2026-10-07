package app.pixme.ai;

/**
 * Result of the pre-generation image screen.
 *
 * <p>Run <em>before</em> anything is charged, so a rejected photo never costs
 * the user a credit. {@code reason} is for our logs and moderation — the user
 * only ever sees the neutral "이 사진으로는 만들기 어려워요" copy.
 */
public record SafetyVerdict(boolean allowed, Category category, String reason) {

    public enum Category {
        OK,
        SEXUAL,
        VIOLENCE,
        SELF_HARM,
        MINOR_SAFETY,
        /** Someone else's ID card, document, screen full of personal data, … */
        PERSONAL_DATA,
        /** No usable person in frame. */
        NO_PERSON,
        /** The screen itself failed; treated as a soft failure, not a rejection. */
        UNAVAILABLE
    }

    public static SafetyVerdict ok() {
        return new SafetyVerdict(true, Category.OK, null);
    }

    public static SafetyVerdict rejected(Category category, String reason) {
        return new SafetyVerdict(false, category, reason);
    }

    /**
     * Used when the moderation call itself fails. We fail <em>open</em> here:
     * the generation prompt is itself heavily constrained, the output is a
     * stylised pixel character rather than a photo, and report/block cover the
     * tail. Blocking every upload during a provider outage would be worse.
     */
    public static SafetyVerdict unavailable(String reason) {
        return new SafetyVerdict(true, Category.UNAVAILABLE, reason);
    }
}
