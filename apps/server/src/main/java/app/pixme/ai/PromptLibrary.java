package app.pixme.ai;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Component;

/**
 * Versioned prompt construction.
 *
 * <p>Prompts are the product here, so they are versioned and every generation
 * records the version that produced it. That is what makes changing the art
 * direction measurable — re-run stored analyses under a new version and
 * compare — instead of a matter of opinion.
 *
 * <p>{@code PIXME_CHARACTER_V1} is built around two references:
 *
 * <ul>
 *   <li><b>Image A</b>, the user's photo → who the person is and what they
 *       wore. Hair, eye and brow shape, lips, skin tone, every visible garment
 *       with its colour, pattern and layering, bag, glasses, hat, shoes.
 *   <li><b>Image B</b>, the Master Character Reference → how a PIXME is built.
 *       Proportions, head-to-body ratio, scale, pixel density, how far features
 *       are simplified, silhouette, pose, rendering language.
 * </ul>
 *
 * <p>Three rules the prompt is written to enforce, in priority order:
 * <ol>
 *   <li>The outfit must stay recognisably the one in the photo — never
 *       substituted with a generic equivalent.
 *   <li>The face must read as that person — eye shape, brows, lips — rendered
 *       at the reference's level of simplification.
 *   <li>Nothing the photo does not show may be invented.
 * </ol>
 */
@Component
public class PromptLibrary {

    /** Current version. Bump to V2 to change the art direction. */
    public static final String VERSION = "PIXME_CHARACTER_V1";

    /** Retained so older generations can be re-rendered for comparison. */
    public static final String VERSION_LEGACY = "PIXME_V1";

    /* ------------------------------------------------------------ analysis */

    /**
     * System prompt for the vision pass.
     *
     * <p>It asks for facial <em>shape</em> — what a portrait artist needs to
     * make the character recognisable — while still refusing age, ethnicity and
     * attractiveness, none of which the product has any use for.
     */
    public String analysisSystemPrompt() {
        return """
               You are a character-design annotator for a pixel-avatar app. You look at
               one photo and describe the person's face, hair and outfit precisely
               enough that an artist could redraw them as a small pixel character and
               the person would recognise themselves.

               Report ONLY what is clearly visible.

               Rules:
               1. "framing": FULL_BODY only if legs and feet are visible, UPPER_BODY if
                  the frame stops between the waist and the chest, SELFIE for a close
                  head-and-shoulders shot.
               2. Face: describe the SHAPE of the features — face outline, eye shape and
                  size, brow shape, lip shape, skin tone — so the character resembles
                  this specific person. If no face is visible, set "faceVisible" to
                  false and leave the face fields null. Never invent a face.
               3. Clothing: one entry per visible garment. Use "layer" (0 = innermost)
                  so an open jacket over a tee is two entries. Record colour and pattern
                  exactly — "grey with black wavy horizontal stripes" is useful,
                  "patterned top" is not.
               4. If the frame stops at the waist, emit NO BOTTOM garment. If feet are
                  not visible, set "footwear" to null. Never guess.
               5. Colours as plain words, plus approximate hex values in "paletteHints".
               6. Do NOT state the person's age, ethnicity, nationality, body weight or
                  attractiveness. Describe shapes, colours and garments only.
               7. If there is no clear single person, set "personDetected" to false.

               Respond with JSON only, matching this shape exactly:
               {
                 "framing": "SELFIE|UPPER_BODY|FULL_BODY|UNKNOWN",
                 "personDetected": true,
                 "hair": {"length": "", "texture": "", "color": "", "fringe": ""},
                 "face": {"faceVisible": true, "expression": "", "faceShape": "",
                          "eyeShape": "", "eyeSize": "", "eyeColor": "",
                          "browShape": "", "lipShape": "", "skinTone": "",
                          "glasses": false, "glassesStyle": null,
                          "facialHair": false, "facialHairStyle": null},
                 "garments": [{"slot": "TOP|OUTER|BOTTOM|DRESS|HEADWEAR",
                               "type": "", "color": "", "pattern": "",
                               "layer": 0, "fit": ""}],
                 "accessories": [{"type": "", "color": "", "carry": null}],
                 "footwear": {"type": "", "color": ""},
                 "mood": "",
                 "paletteHints": ["#RRGGBB"],
                 "notes": ""
               }
               """;
    }

    public String analysisUserPrompt() {
        return "Annotate this photo for pixel-character generation. JSON only.";
    }

    /* ---------------------------------------------------------- generation */

    /**
     * The two-reference instruction, stated before anything else so it frames
     * everything that follows. Wording follows the product brief closely.
     */
    private String referenceContract(boolean hasMasterReference) {
        if (!hasMasterReference) {
            // Degraded path: no Image B available. Say so explicitly rather
            // than silently producing a different character family.
            return """
                   Draw an ORIGINAL full-body pixel character from the user photo,
                   following the PIXME construction described below exactly.
                   """;
        }
        return """
               You are given two images.

               Image A is the user's photo.
               Image B is the PIXME Master Character Reference.

               Use Image A as the identity and outfit reference, and use Image B as the
               strict visual standard.

               From Image A, preserve the person's visible hairstyle, hair colour, eye
               shape, brow shape, lip shape, facial impression, skin tone, clothing,
               clothing colours, patterns, layers, bags, glasses, hats, accessories and
               shoes.

               From Image B, strictly preserve the body proportions, head-to-body ratio,
               character scale, pixel density, the degree to which facial features are
               simplified, the silhouette, the standing pose and the overall visual
               language.

               The result must look like the exact same PIXME avatar system with only
               the person and the outfit changed. Style consistency is more important
               than creative variation. Do not create a new character style.
               """;
    }

    /**
     * The fixed construction, stated numerically from the measured reference so
     * it survives a vague model reading of Image B.
     */
    private String construction(CharacterSpec spec, boolean hasMasterReference) {
        return """
               PIXME construction — identical for every character, never varied:
               - One single character, full body, front-facing (or very slightly
                 turned), relaxed standing pose, arms down at the sides, hands may rest
                 in pockets.
               - Slightly oversized head: head including hair is about %.0f%% of the
                 total height, roughly %.1f heads tall. Cute, not chibi, not realistic.
               - The character fills about %.0f%% of the canvas height, is centred
                 horizontally, with the soles sitting on the lower baseline and a small
                 margin of empty space above the hair.
               - Clean, deliberate pixel edges on one consistent grid. No anti-aliasing,
                 no blur, no soft gradients.
               - Limited palette per garment with simple shading for folds and volume,
                 plus a darker outline on the silhouette. Shading is restrained: it
                 describes form, it does not become painting.
               - Large, expressive pixel eyes with a single bright highlight; soft brows;
                 a small simple mouth; subtle cheek blush. The nose is minimal or
                 omitted. This is the simplification LEVEL — the SHAPE of each feature
                 must follow the person in Image A.
               - Readable at small size: the character appears about 72px tall in a
                 crowd and about 300px tall on its own card.

               Output:
               - One centered full-body pixel character on a FULLY TRANSPARENT
                 background.
               - No ground shadow, no backdrop, no frame, no text, no watermark, no UI.%s

               Never produce:
               - photorealism, 3D render, or lighting simulation
               - anime or manga illustration, smooth vector art, painted illustration
               - exaggerated chibi proportions (huge head, tiny stub body)
               - any recognisable existing game, film or brand character
               - multiple characters, a scene, or props the person is not carrying
               """
                .formatted(
                        spec.headRatio() * 100,
                        spec.headsTall(),
                        spec.characterHeightRatio() * 100,
                        // Only meaningful when the reference is actually sent:
                        // it is exported on a flat background with a ground
                        // shadow, neither of which is part of the standard.
                        hasMasterReference
                                ? "\n                 (Image B is exported on a flat background with a shadow"
                                        + " — that is not\n                 part of the standard. Do not reproduce it.)"
                                : "");
    }

    private String styleModifier(PixelStyle style) {
        return switch (style) {
            case PIXME_BASIC ->
                    "Style: the PIXME house style exactly as shown in the Master Character "
                            + "Reference. Do not deviate.";
            case Y2K_PIXEL ->
                    "Style variation: Y2K. Higher saturation, slightly glossy highlights, "
                            + "cool metallic accents. Construction and proportions unchanged.";
            case BIT_16 ->
                    "Style variation: 16-bit. One extra shading step per garment, richer "
                            + "mid-tones. Construction and proportions unchanged.";
            case RETRO_PC ->
                    "Style variation: early PC display. Restricted 16-colour palette, "
                            + "visible colour banding. Construction and proportions unchanged.";
            case ARCADE ->
                    "Style variation: arcade. High contrast, strong outline, punchy "
                            + "primaries. Construction and proportions unchanged.";
            case MINI_PIXEL ->
                    "Style variation: mini pixel. Coarser grid, rounder shapes, fewer "
                            + "pixels per limb. Construction and proportions unchanged.";
            case SOFT_PIXEL ->
                    "Style variation: soft pixel. Pastel palette, low contrast, no hard "
                            + "black outline. Construction and proportions unchanged.";
        };
    }

    /**
     * Builds the generation prompt from the analysis and the measured spec.
     *
     * <p>The outfit is assembled in layer order, the face is described
     * shape-by-shape, and the framing clause states explicitly what must
     * <em>not</em> be drawn — that negative instruction is what stops the model
     * confidently inventing jeans and sneakers for a selfie.
     */
    public String characterPrompt(
            ImageAnalysis analysis, PixelStyle style, CharacterSpec spec, boolean hasMasterReference) {

        List<String> sections = new ArrayList<>();
        sections.add(referenceContract(hasMasterReference).strip());
        sections.add(construction(spec, hasMasterReference).strip());
        sections.add(styleModifier(style));
        sections.add("Reproduce this exact person and outfit:");

        if (analysis.hair() != null) {
            sections.add("- Hair: " + describeHair(analysis.hair()));
        }
        if (analysis.face() != null) {
            sections.add(describeFace(analysis.face()));
        }

        List<String> tops = describeGarments(analysis, "OUTER", "TOP", "DRESS");
        if (!tops.isEmpty()) {
            sections.add("- Worn on top, innermost first: " + String.join("; ", tops));
        }

        List<String> bottoms = describeGarments(analysis, "BOTTOM");
        if (!bottoms.isEmpty()) {
            sections.add("- Worn below: " + String.join("; ", bottoms));
        }

        List<String> headwear = describeGarments(analysis, "HEADWEAR");
        if (!headwear.isEmpty()) {
            sections.add("- On the head: " + String.join("; ", headwear));
        }

        if (analysis.accessories() != null && !analysis.accessories().isEmpty()) {
            List<String> accessories = new ArrayList<>();
            for (ImageAnalysis.Accessory accessory : analysis.accessories()) {
                StringBuilder text = new StringBuilder();
                if (accessory.color() != null) {
                    text.append(accessory.color()).append(' ');
                }
                text.append(accessory.type() == null
                        ? "accessory"
                        : accessory.type().toLowerCase(Locale.ROOT));
                if (accessory.carry() != null) {
                    text.append(" (").append(accessory.carry()).append(")");
                }
                accessories.add(text.toString());
            }
            sections.add("- Accessories, all of which must be visible: "
                    + String.join("; ", accessories));
        }

        if (analysis.showsFootwear()) {
            ImageAnalysis.Footwear footwear = analysis.footwear();
            sections.add("- Shoes: "
                    + join(footwear.color(), footwear.type() == null ? "shoes" : footwear.type()));
        }

        if (analysis.paletteHints() != null && !analysis.paletteHints().isEmpty()) {
            sections.add("- Keep these colours: " + String.join(", ", analysis.paletteHints()));
        }

        if (analysis.mood() != null && !analysis.mood().isBlank()) {
            sections.add("- Overall feeling: " + analysis.mood());
        }

        sections.add(framingClause(analysis));

        if (analysis.notes() != null && !analysis.notes().isBlank()) {
            sections.add("- Additional detail: " + analysis.notes());
        }

        sections.add(
                """
                Do not replace any garment with a generic equivalent. If the photo shows
                a grey collared top with black wavy stripes, a black backpack and black
                wide-leg trousers, all four must still be recognisable in the result,
                simplified into pixels but not substituted.

                Priority if anything conflicts: PIXME construction and proportions
                first, then garment identity and colour, then facial likeness, then
                hair, then accessories, then mood. Do not improve, restyle or
                accessorise the outfit — it must stay the clothes this person actually
                wore today.
                """
                        .strip());

        return String.join("\n\n", sections);
    }

    /** The anti-invention clause. */
    private String framingClause(ImageAnalysis analysis) {
        String base = switch (analysis.framing() == null
                ? ImageAnalysis.Framing.UNKNOWN
                : analysis.framing()) {
            case FULL_BODY ->
                    "Framing: the photo shows the full body. Draw the character head to "
                            + "feet with the whole outfit visible.";
            case UPPER_BODY ->
                    "Framing: the photo only shows the upper body. Still draw a full-body "
                            + "character in the standard PIXME pose, but give the lower half "
                            + "plain, neutral clothing in a colour drawn from the visible "
                            + "palette. Do NOT invent a specific garment, pattern or "
                            + "footwear that was not visible, and do not draw attention to "
                            + "the lower half.";
            case SELFIE ->
                    "Framing: the photo is a close selfie. Still draw a full-body character "
                            + "in the standard PIXME pose, but keep everything below the "
                            + "visible top plain and neutral. Do NOT invent a specific "
                            + "garment, pattern or footwear that was not visible.";
            case UNKNOWN ->
                    "Framing: draw only the garments described above. Keep anything not "
                            + "described plain and neutral, and invent no specific garment.";
        };

        // The square needs every character to be a full-body sprite of the same
        // height; a bust would break both the crowd and the normaliser. So the
        // resolution for a selfie is "neutral below", not "crop".
        return base;
    }

    private String describeHair(ImageAnalysis.Hair hair) {
        List<String> parts = new ArrayList<>();
        if (hair.length() != null) {
            parts.add(hair.length());
        }
        if (hair.texture() != null) {
            parts.add(hair.texture());
        }
        if (hair.color() != null) {
            parts.add(hair.color());
        }
        String text = String.join(" ", parts) + " hair";
        if (hair.fringe() != null
                && !hair.fringe().isBlank()
                && !"none".equalsIgnoreCase(hair.fringe())) {
            text += ", " + hair.fringe();
        }
        return text.trim();
    }

    /**
     * Describes the face so the character resembles the person, while pinning
     * the simplification level to the reference.
     */
    private String describeFace(ImageAnalysis.Face face) {
        if (!face.faceVisible()) {
            return "- Face: not visible in the photo. Use the Master Character "
                    + "Reference's neutral face unchanged. Do NOT invent a specific likeness.";
        }

        List<String> parts = new ArrayList<>();
        if (notBlank(face.faceShape())) {
            parts.add(face.faceShape() + " face shape");
        }
        if (notBlank(face.eyeShape()) || notBlank(face.eyeSize())) {
            parts.add(trim((face.eyeSize() == null ? "" : face.eyeSize() + " ")
                    + (face.eyeShape() == null ? "" : face.eyeShape()) + " eyes"));
        }
        if (notBlank(face.eyeColor())) {
            parts.add(face.eyeColor() + " irises");
        }
        if (notBlank(face.browShape())) {
            parts.add(face.browShape() + " brows");
        }
        if (notBlank(face.lipShape())) {
            parts.add(face.lipShape() + " lips");
        }
        if (notBlank(face.skinTone())) {
            parts.add(face.skinTone() + " skin");
        }
        if (notBlank(face.expression())) {
            parts.add(face.expression() + " expression");
        }
        if (face.glasses()) {
            parts.add(face.glassesStyle() == null ? "glasses" : face.glassesStyle() + " glasses");
        }
        if (face.facialHair()) {
            parts.add(face.facialHairStyle() == null ? "facial hair" : face.facialHairStyle());
        }

        return "- Face, which must resemble this person: "
                + String.join(", ", parts)
                + ". Render these at exactly the Master Character Reference's level of "
                + "simplification — same eye rendering technique and highlight, same mouth "
                + "size, same amount of detail — but with this person's shapes.";
    }

    private List<String> describeGarments(ImageAnalysis analysis, String... slots) {
        List<String> result = new ArrayList<>();
        if (analysis.garments() == null) {
            return result;
        }
        List<String> wanted = List.of(slots);
        analysis.garments().stream()
                .filter(garment -> garment.slot() != null && wanted.contains(garment.slot()))
                .sorted((a, b) -> Integer.compare(a.layer(), b.layer()))
                .forEach(garment -> {
                    StringBuilder text = new StringBuilder();
                    if (notBlank(garment.fit())) {
                        text.append(garment.fit()).append(' ');
                    }
                    if (notBlank(garment.color())) {
                        text.append(garment.color()).append(' ');
                    }
                    if (notBlank(garment.pattern())
                            && !"solid".equalsIgnoreCase(garment.pattern())) {
                        text.append(garment.pattern()).append(' ');
                    }
                    text.append(garment.type() == null ? "garment" : garment.type());
                    result.add(text.toString().trim());
                });
        return result;
    }

    private boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private String trim(String value) {
        return value.replaceAll("\\s+", " ").trim();
    }

    private String join(String a, String b) {
        return a == null || a.isBlank() ? b : a + " " + b;
    }
}
