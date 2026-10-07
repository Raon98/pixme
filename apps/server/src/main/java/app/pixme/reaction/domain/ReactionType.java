package app.pixme.reaction.domain;

/**
 * Only one reaction type exists, and that is a product decision rather than an
 * unfinished enum: the heart has to stay a single, unambiguous "오늘 PIXME
 * 좋다". Adding a second lightweight reaction would turn it into a rating.
 */
public enum ReactionType {
    HEART
}
