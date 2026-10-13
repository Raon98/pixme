package app.pixme.store.domain;

/**
 * Where a decoration is applied. One active item per slot per user, so
 * choosing a new background replaces the previous one instead of stacking two.
 *
 * <p>{@link #POSE} and {@link #EMOTION} exist because the catalog defines
 * them, but their products are inactive until generation can actually render
 * a character in a different pose — they are not layers the client can draw.
 */
public enum DecorationSlot {
    /** Behind the character on a status card. */
    BACKGROUND,
    /** The card's border treatment. */
    FRAME,
    /** The burst played when the card receives a heart. */
    PARTICLE,
    /** Nickname treatment on the card and profile. */
    NICKNAME,
    /** Profile-wide colour theme. */
    THEME,
    /** Needs generation support; products currently inactive. */
    POSE,
    /** Needs generation support; products currently inactive. */
    EMOTION;

    public static DecorationSlot from(String value) {
        for (DecorationSlot slot : values()) {
            if (slot.name().equalsIgnoreCase(value)) {
                return slot;
            }
        }
        return null;
    }
}
