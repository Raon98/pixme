package app.pixme.ai;

/**
 * The fixed geometry every PIXME character shares.
 *
 * <p>This is the "skeleton" half of the product rule: the person and the outfit
 * change, the construction never does. It is measured from the Master
 * Character Reference at startup (see {@link MasterCharacterReference}) so that
 * replacing the reference image re-fixes the spec — the numbers are never
 * invented here, only defaulted when no reference is present.
 *
 * <p>All ratios are relative to the output canvas, which is square.
 *
 * @param canvasSize            output edge length in pixels
 * @param characterHeightRatio  character height ÷ canvas height
 * @param characterWidthRatio   character width ÷ canvas width (upper bound)
 * @param headRatio             head+hair height ÷ character height
 * @param footBaselineRatio     y of the soles ÷ canvas height
 * @param headroomRatio         empty space above the hair ÷ canvas height
 * @param pixelBlock            device pixels per logical pixel in the reference
 * @param logicalHeight         character height in logical pixels
 */
public record CharacterSpec(
        int canvasSize,
        double characterHeightRatio,
        double characterWidthRatio,
        double headRatio,
        double footBaselineRatio,
        double headroomRatio,
        int pixelBlock,
        int logicalHeight) {

    /**
     * Defaults read off the shipped Master Character Reference.
     *
     * <p>Used only when the reference file is absent, so the service still
     * produces a coherent character family instead of refusing to start. If the
     * reference is swapped, these become stale — the measured values win.
     */
    public static CharacterSpec reference() {
        return new CharacterSpec(
                1024,
                // The reference character fills almost the whole frame: hair at
                // the very top, soles near the bottom.
                0.93,
                0.38,
                // Head including the messy hair volume is just under a third of
                // the body — "slightly oversized", roughly 3.3 heads tall. Not
                // chibi.
                0.31,
                0.96,
                0.02,
                8,
                150);
    }

    /** Character height in output pixels. */
    public int characterHeight() {
        return (int) Math.round(canvasSize * characterHeightRatio);
    }

    /** Maximum character width in output pixels. */
    public int maxCharacterWidth() {
        return (int) Math.round(canvasSize * characterWidthRatio);
    }

    /** Y coordinate of the soles in output pixels. */
    public int footBaseline() {
        return (int) Math.round(canvasSize * footBaselineRatio);
    }

    /** Head-to-body expressed the way the prompt phrases it: "1 : N". */
    public double headToBodyRatio() {
        return (1 - headRatio) / headRatio;
    }

    /** How many heads tall the whole character is. */
    public double headsTall() {
        return 1 / headRatio;
    }
}
