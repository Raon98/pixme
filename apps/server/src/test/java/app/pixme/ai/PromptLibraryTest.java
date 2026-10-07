package app.pixme.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The prompt is the product here, so these tests pin the two behaviours the
 * whole concept depends on: the outfit is preserved, and nothing invisible is
 * invented.
 */
class PromptLibraryTest {

    private final PromptLibrary prompts = new PromptLibrary();

    @Test
    @DisplayName("전신 사진이면 하의와 신발까지 프롬프트에 담긴다")
    void includesLowerBodyForFullBodyPhotos() {
        ImageAnalysis analysis = new ImageAnalysis(
                ImageAnalysis.Framing.FULL_BODY,
                true,
                new ImageAnalysis.Hair("medium", "wavy", "dark brown", "bangs"),
                new ImageAnalysis.Face("calm", true, "round", false, null),
                List.of(
                        new ImageAnalysis.Garment("TOP", "t-shirt", "white", "solid", 0, "regular"),
                        new ImageAnalysis.Garment("OUTER", "denim jacket", "indigo", "solid", 1, "oversized"),
                        new ImageAnalysis.Garment("BOTTOM", "straight jeans", "blue", "solid", 0, "regular")),
                List.of(new ImageAnalysis.Accessory("BAG", "black", "crossbody")),
                new ImageAnalysis.Footwear("sneakers", "white"),
                "quiet evening walk",
                List.of("#2E2B26"),
                null);

        String prompt = prompts.characterPrompt(analysis, PixelStyle.PIXME_BASIC);

        assertThat(prompt).contains("straight jeans");
        assertThat(prompt).contains("white sneakers");
        assertThat(prompt).contains("full body");
        // Layer order must be preserved: the jacket goes over the tee.
        assertThat(prompt.indexOf("t-shirt")).isLessThan(prompt.indexOf("denim jacket"));
    }

    @Test
    @DisplayName("셀카면 하의를 '만들어내지 말라'고 명시한다")
    void forbidsInventingLowerBodyForSelfies() {
        ImageAnalysis analysis = new ImageAnalysis(
                ImageAnalysis.Framing.SELFIE,
                true,
                new ImageAnalysis.Hair("short", "straight", "black", "none"),
                new ImageAnalysis.Face("smiling", false, null, false, null),
                List.of(new ImageAnalysis.Garment("TOP", "hoodie", "grey", "solid", 0, "oversized")),
                List.of(),
                null,
                null,
                List.of(),
                null);

        String prompt = prompts.characterPrompt(analysis, PixelStyle.PIXME_BASIC);

        assertThat(prompt).contains("hoodie");
        assertThat(prompt).contains("Do NOT invent");
        assertThat(prompt).doesNotContain("Worn below");
        assertThat(prompt).doesNotContain("Shoes:");
    }

    @Test
    @DisplayName("상반신 사진은 엉덩이 아래로 그리지 않는다")
    void fadesOutUpperBodyFraming() {
        ImageAnalysis analysis = new ImageAnalysis(
                ImageAnalysis.Framing.UPPER_BODY,
                true,
                null,
                null,
                List.of(new ImageAnalysis.Garment("TOP", "knit sweater", "cream", "solid", 0, "regular")),
                List.of(),
                null,
                null,
                List.of(),
                null);

        String prompt = prompts.characterPrompt(analysis, PixelStyle.PIXME_BASIC);

        assertThat(prompt).contains("upper body");
        assertThat(prompt).contains("Do NOT invent trousers");
    }

    @Test
    @DisplayName("모든 스타일이 같은 세계관 규칙을 공유한다")
    void everyStyleSharesTheHouseConstruction() {
        ImageAnalysis analysis = new ImageAnalysis(
                ImageAnalysis.Framing.FULL_BODY, true, null, null, List.of(), List.of(),
                null, null, List.of(), null);

        for (PixelStyle style : PixelStyle.values()) {
            String prompt = prompts.characterPrompt(analysis, style);
            assertThat(prompt).as("style %s", style).contains("Fully transparent background");
            assertThat(prompt).as("style %s", style).contains("Slightly oversized head");
            assertThat(prompt).as("style %s", style).contains("photorealism, 3D render");
            assertThat(prompt).as("style %s", style).contains("one consistent grid");
        }
    }

    @Test
    @DisplayName("착장 보존이 다른 요소보다 우선한다고 명시한다")
    void statesPriorityOrder() {
        ImageAnalysis analysis = new ImageAnalysis(
                ImageAnalysis.Framing.FULL_BODY, true, null, null, List.of(), List.of(),
                null, null, List.of(), null);

        assertThat(prompts.characterPrompt(analysis, PixelStyle.PIXME_BASIC))
                .contains("garment identity and colour first");
    }

    @Test
    @DisplayName("분석 프롬프트는 외모·인종 묘사를 금지한다")
    void analysisPromptForbidsPersonalDescription() {
        String prompt = prompts.analysisSystemPrompt();
        assertThat(prompt).contains("Do NOT describe the person's age, ethnicity, body shape");
        assertThat(prompt).contains("Never guess");
    }
}
