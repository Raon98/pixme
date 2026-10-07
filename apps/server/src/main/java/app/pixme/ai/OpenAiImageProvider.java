package app.pixme.ai;

import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.config.PixmeProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

/**
 * OpenAI-backed provider.
 *
 * <p>Three calls, in this order: moderation (free of charge to the user —
 * nothing is debited if it fails), vision analysis, then image generation.
 * Splitting analysis from rendering is what lets "다시 만들어보기" reuse the
 * outfit description instead of re-reading the photo, and is what makes the
 * outfit reproducible across prompt versions.
 */
@Component
public class OpenAiImageProvider implements PixelImageProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenAiImageProvider.class);

    private final PixmeProperties.Ai config;
    private final PromptLibrary prompts;
    private final ObjectMapper objectMapper;
    private final RestClient client;

    public OpenAiImageProvider(
            PixmeProperties properties, PromptLibrary prompts, ObjectMapper objectMapper) {
        this.config = properties.ai();
        this.prompts = prompts;
        this.objectMapper = objectMapper;

        Duration timeout = config.requestTimeout();
        this.client = RestClient.builder()
                .baseUrl(config.openai().baseUrl())
                .defaultHeader("Authorization", "Bearer " + config.openai().apiKey())
                .requestFactory(AiHttp.requestFactory(timeout))
                .build();
    }

    @Override
    public String name() {
        return "openai";
    }

    /* -------------------------------------------------------------- safety */

    @Override
    public SafetyVerdict checkSafety(byte[] image, String mimeType) {
        try {
            JsonNode response = client.post()
                    .uri("/moderations")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "model", config.openai().moderationModel(),
                            "input", List.of(Map.of(
                                    "type", "image_url",
                                    "image_url", Map.of("url", dataUrl(image, mimeType))))))
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null) {
                return SafetyVerdict.unavailable("empty moderation response");
            }

            JsonNode result = response.path("results").path(0);
            if (!result.path("flagged").asBoolean(false)) {
                return SafetyVerdict.ok();
            }

            JsonNode categories = result.path("categories");
            if (categories.path("sexual/minors").asBoolean(false)) {
                return SafetyVerdict.rejected(
                        SafetyVerdict.Category.MINOR_SAFETY, "sexual/minors");
            }
            if (categories.path("sexual").asBoolean(false)) {
                return SafetyVerdict.rejected(SafetyVerdict.Category.SEXUAL, "sexual");
            }
            if (categories.path("violence/graphic").asBoolean(false)
                    || categories.path("violence").asBoolean(false)) {
                return SafetyVerdict.rejected(SafetyVerdict.Category.VIOLENCE, "violence");
            }
            if (categories.path("self-harm").asBoolean(false)) {
                return SafetyVerdict.rejected(SafetyVerdict.Category.SELF_HARM, "self-harm");
            }
            return SafetyVerdict.rejected(
                    SafetyVerdict.Category.SEXUAL, "flagged: " + categories);
        } catch (RuntimeException exception) {
            // Never block an upload because moderation was unreachable.
            log.warn("moderation call failed", exception);
            return SafetyVerdict.unavailable(exception.getMessage());
        }
    }

    /* ------------------------------------------------------------ analysis */

    @Override
    public ImageAnalysis analyzeImage(byte[] image, String mimeType) {
        try {
            JsonNode response = client.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "model", config.openai().analysisModel(),
                            "response_format", Map.of("type", "json_object"),
                            "messages", List.of(
                                    Map.of("role", "system", "content", prompts.analysisSystemPrompt()),
                                    Map.of(
                                            "role",
                                            "user",
                                            "content",
                                            List.of(
                                                    Map.of("type", "text", "text", prompts.analysisUserPrompt()),
                                                    Map.of(
                                                            "type", "image_url",
                                                            "image_url",
                                                            Map.of(
                                                                    "url", dataUrl(image, mimeType),
                                                                    "detail", "high")))))))
                    .retrieve()
                    .body(JsonNode.class);

            String content = response == null
                    ? null
                    : response.path("choices").path(0).path("message").path("content").asText(null);

            if (content == null || content.isBlank()) {
                throw new ApiException(ErrorCode.INTERNAL_ERROR, "analysis returned no content");
            }

            ImageAnalysis analysis = objectMapper.readValue(content, ImageAnalysis.class);
            return analysis.personDetected() ? analysis : ImageAnalysis.noPerson();
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            log.warn("image analysis failed", exception);
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "이미지를 분석하지 못했어요.");
        }
    }

    /* ---------------------------------------------------------- generation */

    @Override
    public GeneratedCharacter generateCharacter(GenerationRequest request) {
        ImageAnalysis analysis = request.analysis() != null
                ? request.analysis()
                : analyzeImage(request.sourceImage(), request.sourceMimeType());

        if (!analysis.personDetected()) {
            throw new ApiException(ErrorCode.UNSAFE_IMAGE, "사진에서 사람을 찾지 못했어요.");
        }
        return render(request, analysis);
    }

    @Override
    public GeneratedCharacter generateVariant(GenerationRequest request) {
        ImageAnalysis analysis = request.analysis();
        if (analysis == null) {
            return generateCharacter(request);
        }
        return render(request, analysis);
    }

    /**
     * Renders the character.
     *
     * <p>When the Master Character Reference is installed this uses the
     * <em>edits</em> endpoint with two image inputs — the user's photo and the
     * reference — because that is the only way to give the model the house
     * style as a picture rather than as an adjective. Text alone does not hold a
     * character family together across thousands of renders.
     *
     * <p>Without the reference it falls back to text-only generation, which
     * still works but drifts; the service logs a warning at startup in that
     * case.
     */
    private GeneratedCharacter render(GenerationRequest request, ImageAnalysis analysis) {
        String prompt = prompts.characterPrompt(
                analysis, request.style(), request.spec(), request.hasMasterReference());

        try {
            JsonNode response = request.hasMasterReference()
                    ? renderWithReferences(request, prompt)
                    : renderFromPromptOnly(request, prompt);

            String base64 = response == null
                    ? null
                    : response.path("data").path(0).path("b64_json").asText(null);

            if (base64 == null || base64.isBlank()) {
                throw new ApiException(ErrorCode.INTERNAL_ERROR, "이미지 생성 응답이 비어 있어요.");
            }

            return new GeneratedCharacter(
                    Base64.getDecoder().decode(base64),
                    "image/png",
                    name(),
                    config.openai().imageModel(),
                    request.promptVersion(),
                    analysis);
        } catch (ApiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            log.warn("image generation failed for generation={}", request.generationId(), exception);
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "픽셀 캐릭터를 만들지 못했어요.");
        }
    }

    /** Image A (the photo) + Image B (the reference), as multipart. */
    private JsonNode renderWithReferences(GenerationRequest request, String prompt) {
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("model", config.openai().imageModel());
        form.add("prompt", prompt);
        form.add("n", "1");
        form.add("size", "1024x1024");
        // Transparency is non-negotiable: characters composite onto feed cards
        // and onto the square scene.
        form.add("background", "transparent");
        form.add("output_format", "png");
        form.add("quality", "high");

        // Order matters — the prompt refers to them as Image A and Image B.
        form.add("image[]", namedPart(request.sourceImage(), "image-a-user-photo", request.sourceMimeType()));
        form.add(
                "image[]",
                namedPart(
                        request.masterReference(),
                        "image-b-pixme-master-reference",
                        request.masterReferenceMimeType()));

        return client.post()
                .uri("/images/edits")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(form)
                .retrieve()
                .body(JsonNode.class);
    }

    private JsonNode renderFromPromptOnly(GenerationRequest request, String prompt) {
        return client.post()
                .uri("/images/generations")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "model", config.openai().imageModel(),
                        "prompt", prompt,
                        "n", 1,
                        "size", "1024x1024",
                        "background", "transparent",
                        "output_format", "png",
                        "quality", "high"))
                .retrieve()
                .body(JsonNode.class);
    }

    private ByteArrayResource namedPart(byte[] content, String filename, String mimeType) {
        String extension = switch (mimeType == null ? "" : mimeType) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
        return new ByteArrayResource(content) {
            @Override
            public String getFilename() {
                return filename + extension;
            }
        };
    }

    private static String dataUrl(byte[] image, String mimeType) {
        return "data:" + mimeType + ";base64," + Base64.getEncoder().encodeToString(image);
    }
}
