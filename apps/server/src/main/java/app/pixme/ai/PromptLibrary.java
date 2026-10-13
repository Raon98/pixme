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
               character scale, the degree to which facial features are simplified, the
               silhouette and the standing pose.

               Image B does NOT govern colour, palette size, shading technique, outline
               treatment or pixel density. Those are set by the STYLE section below, and
               where the style section and Image B disagree, the style section wins.

               The result must be the same PIXME avatar system — same build, same
               framing, same level of simplification — rendered in the requested style.
               """;
    }

    /**
     * The fixed construction, stated numerically from the measured reference so
     * it survives a vague model reading of Image B.
     */
    private String construction(CharacterSpec spec, boolean hasMasterReference) {
        return """
               PIXME construction — the build of the character, identical for every
               character. (Colour, palette, shading and outline are NOT part of this
               and are set by the STYLE section.)
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
               - Shading describes form; it never becomes painting. How many shading
                 steps, which palette and whether the silhouette carries an outline are
                 decided by the STYLE section, not here.
               - Large, expressive pixel eyes with a single bright highlight; soft brows;
                 a small simple mouth; subtle cheek blush. The nose is minimal or
                 omitted. This is the simplification LEVEL — the SHAPE of each feature
                 must follow the person in Image A.
               - Readable at small size: the character appears about 72px tall in a
                 crowd and about 300px tall on its own card.

               Output:
               - One centered full-body pixel character. Every pixel outside the
                 character's silhouette must be fully transparent (alpha = 0) —
                 flat, uniform transparency, the same everywhere behind the
                 character, not a gradient and not fading toward any colour.
               - No ground shadow, no backdrop, no frame, no text, no watermark, no UI,
                 no vignette, no glow, no spotlight, no ambient colour wash. The
                 character must be swappable onto any background later, which only
                 works if the area behind it is genuinely empty, not painted to
                 look empty.%s

               Never produce:
               - photorealism, 3D render, or lighting simulation
               - anime or manga illustration, smooth vector art, painted illustration
               - exaggerated chibi proportions (huge head, tiny stub body)
               - any recognisable existing game, film or brand character
               - multiple characters, a scene, or props the person is not carrying
               - any vignette, glow, spotlight, radial gradient, soft-fade halo or
                 ambient colour behind the character — that space must be pure
                 transparent pixels, not a dark or coloured fade
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

    /**
     * How the character is rendered, as opposed to how it is built.
     *
     * <p>Stated at length and in concrete terms on purpose. A one-line hint
     * ("higher saturation") loses to the reference contract and the
     * construction block, which are long, numeric and repeated — the paid
     * styles then all came out looking like the house style, which is the one
     * outcome that makes them not worth buying. Each style names the palette,
     * the shading steps and the outline explicitly so there is nothing left to
     * infer.
     */
    /**
     * The boundary around {@link #styleModifier}.
     *
     * <p>The style sections are written to be loud, because quiet ones lost to
     * the construction block and every paid style came out looking like the
     * house style. Loud has a cost: the model started treating "Y2K" or
     * "arcade" as licence to dress the character for that era — swapping the
     * top, adding a jacket, restyling the hair — so the buyer got someone
     * else's outfit rather than their own in a different rendering. This says,
     * in the same register, exactly how far the style reaches: the technique
     * of drawing, never the subject being drawn.
     */
    private static final String STYLE_SCOPE =
            """
            SCOPE OF THE STYLE SECTION — read this as a hard limit:

            The style controls ONLY how the character is drawn: palette depth,
            number of shading steps, dithering, outline treatment, pixel density
            and overall colour treatment.

            The style NEVER controls what the character is wearing or what their
            hair looks like. Specifically, the style section may not:
            - add, remove, swap or substitute any garment, including jackets,
              overshirts, hoodies, scarves, hats or jewellery;
            - change a garment's type, cut, length, fit, layering or pattern;
            - change the hairstyle, hair length, fringe, parting or hair colour;
            - add era-appropriate or genre-appropriate clothing of any kind.

            Hair and clothing come from Image A and the written description
            below, and nothing in the style section overrides them. Apply the
            style to the person as they actually are: same hair, same clothes,
            drawn differently.""";

    private String styleModifier(PixelStyle style) {
        return switch (style) {
            case PIXME_BASIC ->
                    """
                    STYLE — PIXME house style:
                    - Render exactly as shown in the Master Character Reference.
                    - Limited palette per garment, two shading steps, a darker outline
                      on the silhouette. Restrained and clean.""";
            case Y2K_PIXEL ->
                    """
                    STYLE — Y2K (this must be obvious at a glance):
                    - Vivid, high-saturation colours; push every garment colour well
                      past its real-life saturation.
                    - Glossy specular highlights: a bright, near-white hard-edged
                      highlight on hair, shoulders, bag and shoes.
                    - Cool chrome/silver and candy-pink or electric-blue tint on trims,
                      buckles and small details that are already there. Do not add trims,
                      buckles or details the photo does not show.
                    - Crisp dark outline kept.
                    - Construction and proportions unchanged.""";
            case BIT_16 ->
                    """
                    STYLE — 16-bit console art (this must be obvious at a glance):
                    - Four to five shading steps per garment instead of two: deep
                      shadow, shadow, base, light, highlight.
                    - Rich saturated mid-tones, dithered transitions between steps on
                      large surfaces.
                    - Visibly denser pixel detail: fabric folds, seams and hair strands
                      picked out individually.
                    - Crisp dark outline kept.
                    - Construction and proportions unchanged.""";
            case RETRO_PC ->
                    """
                    STYLE — early home computer (this must be obvious at a glance):
                    - Hard-restricted 16-colour EGA/CGA-like palette. Snap every colour
                      in the photo to its nearest member of that small palette, even
                      when the result is visibly "wrong".
                    - Flat blocky colour fields with ordered/checkerboard dithering
                      instead of smooth shading. Visible colour banding is wanted.
                    - Slightly coarser pixel grid, as if drawn at low resolution.
                    - Crisp dark outline kept.
                    - Construction and proportions unchanged.""";
            case ARCADE ->
                    """
                    STYLE — arcade cabinet sprite (this must be obvious at a glance):
                    - Punchy primary colours, maximum contrast between light and shadow,
                      no muted tones.
                    - Thick, heavy black outline around the whole silhouette and around
                      each major garment block.
                    - Bold simplified shapes; small detail dropped rather than softened.
                    - Construction and proportions unchanged.""";
            case MINI_PIXEL ->
                    """
                    STYLE — mini pixel (this must be obvious at a glance):
                    - Noticeably coarser pixel grid: each pixel block is roughly twice
                      the size used in the reference, so the whole character reads as
                      lower resolution.
                    - Rounder, chunkier shapes; fewer pixels per limb; fine detail
                      merged into solid blocks.
                    - Flat colour with a single shading step.
                    - Crisp dark outline kept.
                    - Construction and proportions unchanged.""";
            case SOFT_PIXEL ->
                    """
                    STYLE — soft pixel (this must be obvious at a glance):
                    - Pastel, desaturated palette throughout: milky, chalky versions of
                      the photo's colours.
                    - Low contrast between base and shadow; shadows are a gentle tint of
                      the base colour, never grey or black.
                    - NO black or dark outline anywhere. Where an outline is needed for
                      readability use a slightly darker shade of the adjacent colour.
                      This overrides any outline instruction above.
                    - Construction and proportions unchanged.""";
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
        sections.add(STYLE_SCOPE);
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
                first, then garment identity (what each item *is*), then the STYLE
                section's palette, shading and outline treatment, then colour fidelity
                within that palette, then facial likeness, then hair, then accessories,
                then mood. Do not improve, restyle or accessorise the outfit — it must
                stay the clothes this person actually wore today.

                Final check before output: the pixels behind the character must be
                fully transparent, with no vignette, glow or colour fade of any kind.
                """
                        .strip());

        // Restated last on purpose: everything between here and the style
        // section argues for consistency, and whichever instruction the model
        // read most recently tends to win. Without this the paid styles came
        // out indistinguishable from the house style.
        sections.add("Render the character in this style, and make the difference "
                + "unmistakable:\n" + styleModifier(style));

        // And immediately after it, the limit — for the same recency reason.
        // Restating the style last made it win; restating it last *without*
        // this made it win too broadly, and the model redressed the character
        // to suit the style instead of only redrawing them in it.
        sections.add(
                "The style above changes only how this is drawn. The hair and every "
                        + "garment stay exactly as described from the photo — same "
                        + "hairstyle, same clothes, nothing added, nothing swapped.");

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
