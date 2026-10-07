package app.pixme.ai;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Component;

/**
 * Versioned prompt construction.
 *
 * <p>Prompts are the product here, not an implementation detail, so they are
 * versioned ({@code PIXME_V1}) and every generation stores the version that
 * produced it. That is what makes it possible to change the art direction and
 * then compare before/after on real inputs instead of guessing.
 *
 * <p>Two hard rules encoded below, both of which the whole concept depends on:
 * <ol>
 *   <li><b>Preserve, don't reinterpret.</b> The character must wear what the
 *       person wore. Hair, layers, colours, patterns and accessories are
 *       described explicitly from the analysis instead of left to the model's
 *       taste.
 *   <li><b>Never invent what isn't visible.</b> If the photo stops at the
 *       waist, the prompt says so and forbids inventing legs, trousers or
 *       shoes. A selfie yields a bust-framed character, not a fabricated
 *       full-body outfit.
 * </ol>
 */
@Component
public class PromptLibrary {

    public static final String VERSION_V1 = "PIXME_V1";

    /* ------------------------------------------------------------ analysis */

    /**
     * System prompt for the vision pass. Deliberately asks for garments and
     * framing only — no age, ethnicity, body-shape or attractiveness
     * judgements, which the product has no use for and should not collect.
     */
    public String analysisSystemPrompt() {
        return """
               You are a wardrobe and hairstyle annotator for a pixel-avatar app.

               Look at the photo and report ONLY what is clearly visible. Your output
               is used to redraw the person as a small pixel character wearing the
               same outfit, so accuracy about clothing matters more than detail about
               the person.

               Rules:
               1. Set "framing" to FULL_BODY only if legs and feet are visible,
                  UPPER_BODY if the frame stops between the waist and the chest,
                  SELFIE if it is a close head-and-shoulders shot.
               2. Only include a garment if you can see it. If the frame stops at the
                  waist, do NOT include a BOTTOM garment. If feet are not visible, set
                  "footwear" to null. Never guess.
               3. For layered clothing, emit one garment per visible piece and use
                  "layer" (0 = innermost) so an open jacket over a tee is two entries.
               4. Describe colours as plain words plus an approximate hex in
                  "paletteHints".
               5. Do NOT describe the person's age, ethnicity, body shape,
                  attractiveness, or any identifying feature beyond hairstyle,
                  glasses, facial hair and expression.
               6. If there is no clear single person, set "personDetected" to false
                  and leave everything else empty.

               Respond with JSON only, matching this shape exactly:
               {
                 "framing": "SELFIE|UPPER_BODY|FULL_BODY|UNKNOWN",
                 "personDetected": true,
                 "hair": {"length": "", "texture": "", "color": "", "fringe": ""},
                 "face": {"expression": "", "glasses": false, "glassesStyle": null,
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
     * The house style. Shared by every style variant so that a crowd in the
     * square reads as one world — which is the single most important visual
     * property of the product.
     */
    private static final String BASE_ART_DIRECTION =
            """
            Draw an ORIGINAL pixel-art character sprite, redrawn from scratch.

            Construction (identical for every PIXME character):
            - Single character, front-facing, standing, calm neutral pose, arms down.
            - Slightly oversized head, compact body. Roughly 1 : 2.6 head-to-body.
            - Clean, deliberate pixel edges. Every pixel placed on one consistent grid.
            - Limited palette: at most 4 shades per garment, flat fills with one
              simple shadow tone. No gradients, no dithering noise, no soft blur.
            - Cute but not childish. Modern, slightly Y2K sensibility.
            - Readable silhouette at small size; the character appears 72px tall in a
              crowd and 300px tall on its own card.
            - Fully transparent background. No ground shadow, no frame, no backdrop,
              no text, no watermark, no logo, no UI.
            - Centred in a square canvas with even margins.

            Never produce:
            - photorealism, 3D render, or any lighting simulation
            - anime or manga illustration, smooth vector art, painted art
            - exaggerated chibi proportions (huge head, tiny stub body)
            - any recognisable existing game, film or brand character
            - multiple characters, props the person is not holding, or a scene
            """;

    private String styleModifier(PixelStyle style) {
        return switch (style) {
            case PIXME_BASIC ->
                    "Style: the PIXME house style. Medium pixel scale, soft but saturated "
                            + "palette, 1px darker outline, warm neutral skin shading.";
            case Y2K_PIXEL ->
                    "Style: Y2K pixel. Higher saturation, slightly glossy highlights, "
                            + "bolder 1px outline, cool metallic accents.";
            case BIT_16 ->
                    "Style: 16-bit era. Finer pixel grid, one extra shading step per "
                            + "garment, richer mid-tones, still flat fills.";
            case RETRO_PC ->
                    "Style: early PC display. Restricted 16-colour palette, visible "
                            + "coarse pixels, slight colour banding, no anti-aliasing.";
            case ARCADE ->
                    "Style: arcade cabinet. High contrast, strong black outline, "
                            + "punchy primary colours on a dark-friendly palette.";
            case MINI_PIXEL ->
                    "Style: mini pixel. Smaller overall sprite, rounder shapes, "
                            + "simplified features, fewer pixels per limb.";
            case SOFT_PIXEL ->
                    "Style: soft pixel. Pastel palette, low contrast, gentle shading, "
                            + "no hard black outline.";
        };
    }

    /**
     * Builds the generation prompt from the analysis.
     *
     * <p>The garment description is assembled in layer order and the framing
     * clause is explicit about what must <em>not</em> be drawn — that negative
     * instruction is what stops the model from confidently inventing jeans and
     * sneakers for a selfie.
     */
    public String characterPrompt(ImageAnalysis analysis, PixelStyle style) {
        List<String> sections = new ArrayList<>();
        sections.add(BASE_ART_DIRECTION.strip());
        sections.add(styleModifier(style));
        sections.add("Reproduce this exact appearance:");

        if (analysis.hair() != null) {
            sections.add("- Hair: " + describeHair(analysis.hair()));
        }
        if (analysis.face() != null) {
            sections.add("- Face: " + describeFace(analysis.face()));
        }

        List<String> tops = describeGarments(analysis, "OUTER", "TOP", "DRESS");
        if (!tops.isEmpty()) {
            sections.add("- Worn on top, outermost last: " + String.join("; ", tops));
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
            sections.add("- Accessories: " + String.join("; ", accessories));
        }

        if (analysis.showsFootwear()) {
            ImageAnalysis.Footwear footwear = analysis.footwear();
            sections.add("- Shoes: "
                    + join(footwear.color(), footwear.type() == null ? "shoes" : footwear.type()));
        }

        if (analysis.paletteHints() != null && !analysis.paletteHints().isEmpty()) {
            sections.add("- Keep these outfit colours: "
                    + String.join(", ", analysis.paletteHints()));
        }

        if (analysis.mood() != null && !analysis.mood().isBlank()) {
            sections.add("- Overall feeling to convey: " + analysis.mood());
        }

        sections.add(framingClause(analysis));

        if (analysis.notes() != null && !analysis.notes().isBlank()) {
            sections.add("- Additional detail: " + analysis.notes());
        }

        sections.add(
                "Priority order if anything conflicts: garment identity and colour first, "
                        + "then hair, then accessories, then mood. Do not improve, restyle or "
                        + "accessorise the outfit — it must stay the clothes this person "
                        + "actually wore today.");

        return String.join("\n", sections);
    }

    /**
     * The anti-invention clause. Framing is the one place where being
     * permissive produces a wrong result the user will immediately notice
     * ("I wasn't wearing that"), so each case is spelled out.
     */
    private String framingClause(ImageAnalysis analysis) {
        return switch (analysis.framing() == null ? ImageAnalysis.Framing.UNKNOWN : analysis.framing()) {
            case FULL_BODY ->
                    "Framing: draw the full body from head to feet, standing, the whole "
                            + "outfit visible.";
            case UPPER_BODY ->
                    "Framing: the source photo only shows the upper body. Draw the "
                            + "character from the head to just below the hips and fade the "
                            + "sprite out there. Do NOT invent trousers, skirts, legs or "
                            + "shoes that were not visible.";
            case SELFIE ->
                    "Framing: the source photo is a close selfie. Draw a bust — head, "
                            + "shoulders and the visible part of the top only. Do NOT invent "
                            + "a lower body, legs, bottoms or shoes.";
            case UNKNOWN ->
                    "Framing: only draw the parts of the body that were described above. "
                            + "Do NOT invent any garment that was not listed.";
        };
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
        if (hair.fringe() != null && !hair.fringe().isBlank() && !"none".equalsIgnoreCase(hair.fringe())) {
            text += ", " + hair.fringe();
        }
        return text.trim();
    }

    private String describeFace(ImageAnalysis.Face face) {
        List<String> parts = new ArrayList<>();
        if (face.expression() != null && !face.expression().isBlank()) {
            parts.add(face.expression() + " expression");
        }
        if (face.glasses()) {
            parts.add(face.glassesStyle() == null ? "glasses" : face.glassesStyle() + " glasses");
        }
        if (face.facialHair()) {
            parts.add(face.facialHairStyle() == null ? "facial hair" : face.facialHairStyle());
        }
        // Simple, readable features — this is a 72px sprite, not a portrait.
        parts.add("simple two-pixel eyes and a minimal mouth");
        return String.join(", ", parts);
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
                    if (garment.fit() != null && !garment.fit().isBlank()) {
                        text.append(garment.fit()).append(' ');
                    }
                    if (garment.color() != null && !garment.color().isBlank()) {
                        text.append(garment.color()).append(' ');
                    }
                    if (garment.pattern() != null
                            && !garment.pattern().isBlank()
                            && !"solid".equalsIgnoreCase(garment.pattern())) {
                        text.append(garment.pattern()).append(' ');
                    }
                    text.append(garment.type() == null ? "garment" : garment.type());
                    result.add(text.toString().trim());
                });
        return result;
    }

    private String join(String a, String b) {
        if (a == null || a.isBlank()) {
            return b;
        }
        return a + " " + b;
    }
}
