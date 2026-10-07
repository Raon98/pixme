package app.pixme.ai;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * What the model actually saw in the photo.
 *
 * <p>This is the heart of PIXME's promise — "the clothes you really wore" — so
 * analysis is a separate, inspectable step rather than something hidden inside
 * one image-to-image call. Keeping it structured means we can:
 * <ul>
 *   <li>build a deterministic prompt from it,
 *   <li>store it against the generation and diff results across prompt
 *       versions,
 *   <li>and refuse to invent what isn't visible (see {@link #framing()}).
 * </ul>
 *
 * <p>Every field is nullable by design. A selfie legitimately has no bottoms or
 * shoes, and the one thing the generator must never do is make them up.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ImageAnalysis(
        /** SELFIE | UPPER_BODY | FULL_BODY — how much of the person is visible. */
        Framing framing,
        /** False when the image has no clear single person; generation stops. */
        boolean personDetected,
        Hair hair,
        Face face,
        List<Garment> garments,
        List<Accessory> accessories,
        Footwear footwear,
        /** One short phrase: "quiet evening walk", "bright and sporty". */
        String mood,
        /** Dominant colours of the whole outfit, as hex. */
        List<String> paletteHints,
        /** Free-form notes the prompt builder appends verbatim. */
        String notes) {

    public enum Framing {
        SELFIE,
        UPPER_BODY,
        FULL_BODY,
        UNKNOWN
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Hair(
            /** short | medium | long | tied | bun | shaved … */
            String length,
            /** straight | wavy | curly | braided … */
            String texture,
            String color,
            /** bangs | side-part | centre-part | none */
            String fringe) {}

    /**
     * Drawable facial geometry.
     *
     * <p>The character should look like the person — their eye shape, brows and
     * mouth, not a stock face. So this describes <em>shape</em>, which a pixel
     * artist would need, while still refusing to record age, ethnicity or any
     * attractiveness judgement, which nothing in the product uses.
     *
     * <p>How far these features get simplified is fixed by the Master Character
     * Reference, not by this record: shape comes from the photo, simplification
     * level comes from the reference.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Face(
            /** False when no face is visible — then nothing below is invented. */
            boolean faceVisible,
            String expression,
            /** round | oval | long | square | heart */
            String faceShape,
            /** almond | round | upturned | downturned | monolid | hooded */
            String eyeShape,
            /** small | medium | large */
            String eyeSize,
            String eyeColor,
            /** straight | arched | angled | soft | thick | thin */
            String browShape,
            /** thin | full | small | wide */
            String lipShape,
            /** Plain description; the hex belongs in paletteHints. */
            String skinTone,
            boolean glasses,
            String glassesStyle,
            boolean facialHair,
            String facialHairStyle) {}

    /**
     * One visible garment. {@code layer} is what makes layered outfits survive
     * the conversion: an open jacket over a tee has to read as two pieces.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Garment(
            /** TOP | OUTER | BOTTOM | DRESS | HEADWEAR */
            String slot,
            /** "oversized hoodie", "pleated skirt", "straight jeans" */
            String type,
            String color,
            /** solid | striped | checked | graphic | floral … */
            String pattern,
            /** 0 = innermost. Only meaningful within the same slot. */
            int layer,
            /** fitted | regular | oversized | cropped */
            String fit) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Accessory(
            /** BAG | HAT | SCARF | EARRINGS | NECKLACE | WATCH | HEADPHONES … */
            String type,
            String color,
            /** shoulder | crossbody | handheld | backpack — bags only. */
            String carry) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Footwear(String type, String color) {}

    public static ImageAnalysis noPerson() {
        return new ImageAnalysis(
                Framing.UNKNOWN, false, null, null, List.of(), List.of(), null, null, List.of(), null);
    }

    public boolean showsLowerBody() {
        return framing == Framing.FULL_BODY;
    }

    public boolean showsFootwear() {
        return framing == Framing.FULL_BODY && footwear != null;
    }
}
