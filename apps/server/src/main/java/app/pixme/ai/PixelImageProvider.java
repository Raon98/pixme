package app.pixme.ai;

/**
 * The AI seam.
 *
 * <p>PIXME must not be structurally married to one image vendor: models change
 * fast, pricing changes faster, and the art direction has to survive both. So
 * the whole integration is these four methods, selected by
 * {@code pixme.ai.provider}, and no caller outside this package knows which
 * vendor is in use.
 *
 * <p>Implementations must be stateless and thread-safe.
 */
public interface PixelImageProvider {

    /** Value of {@code pixme.ai.provider} this implementation answers to. */
    String name();

    /**
     * Screens the uploaded photo before anything is charged or generated.
     * Implementations should return {@link SafetyVerdict#unavailable} rather
     * than throwing when the moderation endpoint itself is down.
     */
    SafetyVerdict checkSafety(byte[] image, String mimeType);

    /**
     * Reads the photo into a structured description of hair, garments,
     * accessories and framing.
     *
     * <p>Contract: describe only what is visible. If the frame stops at the
     * waist, {@code garments} must contain no BOTTOM entry — the generator
     * relies on absence to avoid inventing clothes the person wasn't wearing.
     */
    ImageAnalysis analyzeImage(byte[] image, String mimeType);

    /** Produces the character. */
    GeneratedCharacter generateCharacter(GenerationRequest request);

    /**
     * Re-renders from an existing analysis — "다시 만들어보기" and future style
     * re-renders. Cheaper and more consistent than re-analysing, and it keeps
     * the outfit identical while the rendering varies.
     */
    GeneratedCharacter generateVariant(GenerationRequest request);
}
