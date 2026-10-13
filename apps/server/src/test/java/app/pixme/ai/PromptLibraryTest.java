package app.pixme.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The prompt is the product here, so these tests pin the three behaviours the
 * concept depends on: the outfit survives, the face resembles the person, and
 * nothing invisible is invented.
 */
class PromptLibraryTest {

    private final PromptLibrary prompts = new PromptLibrary();
    private final CharacterSpec spec = CharacterSpec.reference();

    /** The real example: the photo that produced the Master Reference. */
    private ImageAnalysis stripedOutfit(ImageAnalysis.Framing framing) {
        return new ImageAnalysis(
                framing,
                true,
                new ImageAnalysis.Hair("medium", "messy", "dark brown", "bangs"),
                new ImageAnalysis.Face(
                        true,
                        "calm",
                        "oval",
                        "almond",
                        "large",
                        "dark brown",
                        "straight",
                        "small",
                        "light",
                        false,
                        null,
                        false,
                        null),
                List.of(
                        new ImageAnalysis.Garment(
                                "TOP", "collared knit top", "grey", "black wavy stripes", 0, "regular"),
                        new ImageAnalysis.Garment(
                                "BOTTOM", "wide-leg trousers", "black", "solid", 0, "oversized")),
                List.of(new ImageAnalysis.Accessory("BAG", "black", "backpack")),
                framing == ImageAnalysis.Framing.FULL_BODY
                        ? new ImageAnalysis.Footwear("sneakers", "black")
                        : null,
                "quiet weekday",
                List.of("#8A8A8A", "#1A1A1A"),
                null);
    }

    @Test
    @DisplayName("두 레퍼런스의 역할이 프롬프트에 명시된다")
    void statesTheTwoReferenceContract() {
        String prompt = prompts.characterPrompt(
                stripedOutfit(ImageAnalysis.Framing.FULL_BODY), PixelStyle.PIXME_BASIC, spec, true);

        assertThat(prompt).contains("Image A is the user's photo");
        assertThat(prompt).contains("Image B is the PIXME Master Character Reference");
        assertThat(prompt).contains("identity and outfit reference");
        assertThat(prompt).contains("strict visual standard");
        // The reference owns the build, not the rendering. It used to own both
        // ("do not create a new character style"), which left every paid style
        // looking like the free one.
        assertThat(prompt).contains("Image B does NOT govern colour");
        assertThat(prompt).contains("the style section wins");
    }

    @Test
    @DisplayName("유료 스타일은 팔레트·셰이딩·외곽선을 구체적으로 지시한다")
    void paidStylesStateTheirOwnRendering() {
        ImageAnalysis analysis = stripedOutfit(ImageAnalysis.Framing.FULL_BODY);

        for (PixelStyle style : PixelStyle.values()) {
            if (style == PixelStyle.PIXME_BASIC) continue;

            String prompt = prompts.characterPrompt(analysis, style, spec, true);
            // Stated twice: once in place, once last, because the instructions
            // in between all argue for consistency with the reference.
            assertThat(prompt)
                    .as("style %s is restated last", style)
                    .contains("make the difference unmistakable");
            assertThat(prompt)
                    .as("style %s is spelled out", style)
                    .contains("obvious at a glance");
        }
    }

    @Test
    @DisplayName("소프트 픽셀은 외곽선 규칙을 덮어쓴다")
    void softPixelOverridesTheOutline() {
        String prompt = prompts.characterPrompt(
                stripedOutfit(ImageAnalysis.Framing.FULL_BODY),
                PixelStyle.SOFT_PIXEL,
                spec,
                true);

        assertThat(prompt).contains("NO black or dark outline");
        assertThat(prompt).contains("overrides any outline instruction above");
    }

    @Test
    @DisplayName("실제 착장이 generic으로 치환되지 않도록 못 박는다")
    void forbidsGenericSubstitution() {
        String prompt = prompts.characterPrompt(
                stripedOutfit(ImageAnalysis.Framing.FULL_BODY), PixelStyle.PIXME_BASIC, spec, true);

        // The actual garments, with their colours and patterns.
        assertThat(prompt).contains("grey black wavy stripes collared knit top");
        assertThat(prompt).contains("black wide-leg trousers");
        assertThat(prompt).contains("black backpack");
        assertThat(prompt).contains("black sneakers");
        assertThat(prompt).contains("Do not replace any garment with a generic equivalent");
    }

    @Test
    @DisplayName("얼굴은 그 사람을 닮게, 단순화 수준은 레퍼런스를 따른다")
    void facesFollowThePersonAtTheReferenceSimplification() {
        String prompt = prompts.characterPrompt(
                stripedOutfit(ImageAnalysis.Framing.FULL_BODY), PixelStyle.PIXME_BASIC, spec, true);

        assertThat(prompt).contains("Face, which must resemble this person");
        assertThat(prompt).contains("almond eyes");
        assertThat(prompt).contains("straight brows");
        assertThat(prompt).contains("oval face shape");
        // …but the rendering technique is pinned to the reference.
        assertThat(prompt).contains("level of simplification");
    }

    @Test
    @DisplayName("얼굴이 안 보이면 임의로 만들어내지 않는다")
    void doesNotInventAFaceThatIsNotVisible() {
        ImageAnalysis analysis = new ImageAnalysis(
                ImageAnalysis.Framing.UPPER_BODY,
                true,
                null,
                new ImageAnalysis.Face(
                        false, null, null, null, null, null, null, null, null,
                        false, null, false, null),
                List.of(new ImageAnalysis.Garment("TOP", "hoodie", "grey", "solid", 0, "oversized")),
                List.of(),
                null,
                null,
                List.of(),
                null);

        String prompt = prompts.characterPrompt(analysis, PixelStyle.PIXME_BASIC, spec, true);

        assertThat(prompt).contains("not visible in the photo");
        assertThat(prompt).contains("Do NOT invent a specific likeness");
    }

    @Test
    @DisplayName("셀카여도 전신을 그리되 안 보이는 옷은 상상하지 않는다")
    void selfieStillProducesAFullBodyWithoutInventingGarments() {
        String prompt = prompts.characterPrompt(
                stripedOutfit(ImageAnalysis.Framing.SELFIE), PixelStyle.PIXME_BASIC, spec, true);

        // Every character in the square must be a full-body sprite of the same
        // height, so a selfie yields neutral lower half — not a cropped bust.
        assertThat(prompt).contains("Still draw a full-body character");
        assertThat(prompt).contains("plain and neutral");
        assertThat(prompt).contains("Do NOT invent a specific garment");
        assertThat(prompt).doesNotContain("Shoes:");
    }

    @Test
    @DisplayName("레이어 순서가 보존된다")
    void preservesLayerOrder() {
        ImageAnalysis analysis = new ImageAnalysis(
                ImageAnalysis.Framing.FULL_BODY,
                true,
                null,
                null,
                List.of(
                        new ImageAnalysis.Garment("OUTER", "denim jacket", "indigo", "solid", 1, "oversized"),
                        new ImageAnalysis.Garment("TOP", "t-shirt", "white", "solid", 0, "regular")),
                List.of(),
                null,
                null,
                List.of(),
                null);

        String prompt = prompts.characterPrompt(analysis, PixelStyle.PIXME_BASIC, spec, true);

        assertThat(prompt.indexOf("t-shirt")).isLessThan(prompt.indexOf("denim jacket"));
    }

    @Test
    @DisplayName("모든 스타일이 같은 뼈대 규격을 공유한다")
    void everyStyleSharesTheFixedConstruction() {
        ImageAnalysis analysis = stripedOutfit(ImageAnalysis.Framing.FULL_BODY);

        for (PixelStyle style : PixelStyle.values()) {
            String prompt = prompts.characterPrompt(analysis, style, spec, true);
            assertThat(prompt).as("style %s", style).contains("fully transparent (alpha = 0)");
            assertThat(prompt).as("style %s", style).contains("no vignette, no glow");
            assertThat(prompt).as("style %s", style).contains("Slightly oversized head");
            assertThat(prompt).as("style %s", style).contains("one consistent grid");
            assertThat(prompt).as("style %s", style).contains("photorealism, 3D render");
            if (style != PixelStyle.PIXME_BASIC) {
                // Variations may change palette, never construction.
                assertThat(prompt).as("style %s", style).contains("proportions unchanged");
            }
        }
    }

    @Test
    @DisplayName("규격 수치가 프롬프트에 숫자로 들어간다")
    void injectsTheMeasuredGeometry() {
        String prompt = prompts.characterPrompt(
                stripedOutfit(ImageAnalysis.Framing.FULL_BODY), PixelStyle.PIXME_BASIC, spec, true);

        // Stated numerically so a vague reading of Image B cannot drift.
        assertThat(prompt).contains("%.0f%%".formatted(spec.headRatio() * 100));
        assertThat(prompt).contains("%.1f heads tall".formatted(spec.headsTall()));
        assertThat(prompt).contains("%.0f%% of the canvas height".formatted(
                spec.characterHeightRatio() * 100));
    }

    @Test
    @DisplayName("레퍼런스의 배경과 그림자는 규격이 아니라고 못 박는다")
    void excludesTheReferenceBackgroundFromTheStandard() {
        String prompt = prompts.characterPrompt(
                stripedOutfit(ImageAnalysis.Framing.FULL_BODY), PixelStyle.PIXME_BASIC, spec, true);

        // The shipped reference is exported on a flat background with a ground
        // shadow; copying that would break compositing in the feed and square.
        assertThat(prompt).contains("that is not");
        assertThat(prompt).contains("No ground shadow");
    }

    @Test
    @DisplayName("레퍼런스가 없으면 그 사실을 프롬프트에 반영한다")
    void degradesHonestlyWithoutTheReference() {
        String prompt = prompts.characterPrompt(
                stripedOutfit(ImageAnalysis.Framing.FULL_BODY), PixelStyle.PIXME_BASIC, spec, false);

        assertThat(prompt).doesNotContain("Image B");
        // The construction is still stated in full, so output stays coherent.
        assertThat(prompt).contains("Slightly oversized head");
    }

    @Test
    @DisplayName("분석 프롬프트는 얼굴 '형태'는 받고 나이·인종은 거부한다")
    void analysisPromptAsksForShapeNotProfiling() {
        String prompt = prompts.analysisSystemPrompt();

        assertThat(prompt).contains("eye shape");
        assertThat(prompt).contains("brow shape");
        assertThat(prompt).contains("lip shape");
        assertThat(prompt).contains("the person would recognise themselves");
        assertThat(prompt).contains("Do NOT state the person's age, ethnicity");
        assertThat(prompt).contains("Never invent a face");
        assertThat(prompt).contains("Never guess");
    }

    @Test
    @DisplayName("스타일은 그리는 방식만 바꾸고 옷·헤어는 못 건드린다")
    void styleMayNotRedressTheCharacter() {
        ImageAnalysis analysis = stripedOutfit(ImageAnalysis.Framing.FULL_BODY);

        for (PixelStyle style : PixelStyle.values()) {
            String prompt = prompts.characterPrompt(analysis, style, spec, true);

            assertThat(prompt)
                    .as("%s states the scope limit", style)
                    .contains("SCOPE OF THE STYLE SECTION")
                    .contains("The style NEVER controls what the character is wearing")
                    .contains("change the hairstyle, hair length, fringe, parting or hair colour")
                    .contains("add era-appropriate or genre-appropriate clothing of any kind");

            // The style is restated last so it wins on recency; the limit has to
            // come after it, or the restatement reopens what this closed.
            assertThat(prompt.lastIndexOf("The style above changes only how this is drawn"))
                    .as("%s closes the scope after the final style restatement", style)
                    .isGreaterThan(prompt.lastIndexOf("make the difference"));
        }
    }

    @Test
    @DisplayName("어떤 스타일도 없는 옷을 지어내라고 말하지 않는다")
    void noStyleInventsGarments() {
        ImageAnalysis analysis = stripedOutfit(ImageAnalysis.Framing.FULL_BODY);

        for (PixelStyle style : PixelStyle.values()) {
            String prompt = prompts.characterPrompt(analysis, style, spec, true);

            assertThat(prompt)
                    .as("%s does not license adding anything to the outfit", style)
                    .doesNotContain("accents added");
        }
    }
}
