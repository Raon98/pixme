package app.pixme.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import javax.imageio.ImageIO;

import app.pixme.config.PixmeProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

/**
 * One real, manually-triggered call against the live OpenAI API, using the
 * production {@link OpenAiImageProvider} and {@link PromptLibrary} code
 * exactly as the app uses them — not a hand-rolled curl stand-in.
 *
 * <p>Skipped entirely (not failed) unless an API key is present in the
 * environment, so it never runs in CI or a normal {@code mvn test}. Run it
 * explicitly:
 *
 * <pre>
 * export $(grep -v '^#' .env | xargs) &amp;&amp; \
 *   mvn -q -Dtest=OpenAiLiveVerificationManualCheck test
 * </pre>
 *
 * <p>Never prints the key itself — only whether one was found and which env
 * var supplied it.
 */
class OpenAiLiveVerificationManualCheck {

    @Test
    void realGenerationAgainstOpenAi() throws IOException {
        String fromPixmeVar = System.getenv("PIXME_OPENAI_API_KEY");
        String fromGenericVar = System.getenv("OPENAI_API_KEY");
        String apiKey = (fromPixmeVar != null && !fromPixmeVar.isBlank())
                ? fromPixmeVar
                : fromGenericVar;

        System.out.println("PIXME_OPENAI_API_KEY: "
                + (fromPixmeVar != null && !fromPixmeVar.isBlank() ? "configured" : "not configured"));
        System.out.println("OPENAI_API_KEY (fallback): "
                + (fromGenericVar != null && !fromGenericVar.isBlank() ? "configured" : "not configured"));

        assumeTrue(
                apiKey != null && !apiKey.isBlank(),
                "No API key in environment (neither PIXME_OPENAI_API_KEY nor OPENAI_API_KEY) — skipping live call.");

        String usedVarName = (fromPixmeVar != null && !fromPixmeVar.isBlank())
                ? "PIXME_OPENAI_API_KEY"
                : "OPENAI_API_KEY (fallback)";
        System.out.println("Key source: " + usedVarName);

        String model = envOr("PIXME_OPENAI_IMAGE_MODEL", "gpt-image-1");
        String quality = envOr("PIXME_OPENAI_IMAGE_QUALITY", "medium");
        System.out.println("Model: " + model);
        System.out.println("Quality: " + quality);

        // --- Master Character Reference (Image B) — real file, real measurement ---
        Path referencePath = Path.of(
                "src/main/resources/pixme/master-character-v1.png");
        assertThat(Files.exists(referencePath))
                .as("Master Character Reference must exist at " + referencePath.toAbsolutePath())
                .isTrue();
        byte[] masterReference = Files.readAllBytes(referencePath);
        CharacterSpec spec = MasterCharacterReference.measure(masterReference);
        System.out.println("Master Reference: OK (" + referencePath.toAbsolutePath() + ")");
        System.out.println("Measured spec: " + spec);

        // --- User test photo (Image A) ---
        Path userPhotoPath = Path.of(envOr("PIXME_VERIFY_INPUT", "/tmp/pixme-test-input.jpg"));
        assertThat(Files.exists(userPhotoPath))
                .as("Test user photo must exist at " + userPhotoPath)
                .isTrue();
        byte[] userPhoto = Files.readAllBytes(userPhotoPath);
        System.out.println("User image: OK (" + userPhotoPath + ", " + userPhoto.length + " bytes)");

        PixmeProperties.Ai.OpenAi openAiConfig = new PixmeProperties.Ai.OpenAi(
                apiKey,
                "https://api.openai.com/v1",
                "gpt-5",
                model,
                "omni-moderation-latest",
                quality);
        PixmeProperties.Ai aiConfig = new PixmeProperties.Ai(
                "openai",
                PromptLibrary.VERSION,
                Duration.ofSeconds(90),
                2,
                new PixmeProperties.Ai.MasterReference(
                        "classpath:pixme/master-character-v1.png", "image/png", "PIXME_MASTER_V1", false),
                openAiConfig,
                new PixmeProperties.Ai.Flux(null, null, null));
        PixmeProperties properties = new PixmeProperties(
                "Asia/Seoul", "1.0.0", null, null, null, aiConfig,
                null, null, null, null, null, null, null, null, null);

        // Style is overridable so the same photo can be run through a second
        // style without editing this file — the only honest way to show a
        // before/after where the clothes really are unchanged.
        PixelStyle style = PixelStyle.valueOf(envOr("PIXME_VERIFY_STYLE", "PIXME_BASIC"));
        System.out.println("Style: " + style);

        PromptLibrary prompts = new PromptLibrary();
        OpenAiImageProvider provider = new OpenAiImageProvider(properties, prompts, new ObjectMapper());

        // Confirm PIXME_CHARACTER_V1 is what actually builds the request prompt.
        String promptPreview = prompts.characterPrompt(
                ImageAnalysis.noPerson(), style, spec, true);
        System.out.println("Prompt version in use: " + PromptLibrary.VERSION);
        System.out.println("Prompt preview (first 200 chars): "
                + promptPreview.substring(0, Math.min(200, promptPreview.length())));

        GenerationRequest request = new GenerationRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                userPhoto,
                "image/jpeg",
                masterReference,
                "image/png",
                spec,
                style,
                null, // force a real vision analysis pass, exactly like production
                PromptLibrary.VERSION,
                System.nanoTime());

        assertThat(request.hasMasterReference())
                .as("Both images must be present in the request")
                .isTrue();

        Instant start = Instant.now();
        GeneratedCharacter result = provider.generateCharacter(request);
        Duration latency = Duration.between(start, Instant.now());

        assertThat(result.image()).isNotEmpty();
        assertThat(result.model()).isEqualTo(model);

        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(result.image()));
        assertThat(decoded).as("result must be a decodable image").isNotNull();

        Path outputDir = Path.of("tmp");
        Files.createDirectories(outputDir);
        Path outputPath = Path.of(
                envOr("PIXME_VERIFY_OUTPUT", outputDir.resolve("pixme-api-verification.png").toString()));
        Files.write(outputPath, result.image());

        System.out.println("OpenAI API: OK");
        System.out.println("Used model: " + result.model());
        System.out.println("Used quality: " + quality);
        System.out.println("Result format: " + result.mimeType());
        System.out.println("Result dimensions: " + decoded.getWidth() + "x" + decoded.getHeight());
        System.out.println("Latency: " + latency.toMillis() + "ms");
        System.out.println("Saved to: " + outputPath.toAbsolutePath());
        System.out.println("File exists after write: " + Files.exists(outputPath));
        System.out.println("Analysis person detected: " + result.analysis().personDetected());
    }

    private static String envOr(String name, String fallback) {
        String value = System.getenv(name);
        return (value == null || value.isBlank()) ? fallback : value;
    }
}
