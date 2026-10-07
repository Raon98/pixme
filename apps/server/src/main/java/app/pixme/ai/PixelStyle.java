package app.pixme.ai;

/**
 * Character art styles.
 *
 * <p>{@code PIXME_BASIC} is the house style and is free for everyone — it is
 * what makes the square look like one world. The others are purchasable
 * variations on the same construction rules (same pixel scale, same
 * proportions), never different universes.
 */
public enum PixelStyle {
    PIXME_BASIC(true),
    Y2K_PIXEL(false),
    BIT_16(false),
    RETRO_PC(false),
    ARCADE(false),
    MINI_PIXEL(false),
    SOFT_PIXEL(false);

    private final boolean free;

    PixelStyle(boolean free) {
        this.free = free;
    }

    public boolean isFree() {
        return free;
    }

    /** Unlock code stored in {@code user_unlocks} when purchased. */
    public String unlockCode() {
        return name();
    }
}
