package app.pixme.ai;

import java.time.Duration;
import java.util.Base64;
import java.util.Map;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.config.PixmeProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * FLUX (Black Forest Labs) provider — the second implementation, which exists
 * to prove the seam is real.
 *
 * <p>It differs from the OpenAI one in two ways worth noting:
 * <ul>
 *   <li>FLUX Kontext is image-to-image, so the source photo is passed alongside
 *       the prompt. It tends to preserve garment shape better; the prompt still
 *       carries the analysis so colours and layers don't drift.
 *   <li>Generation is asynchronous — submit, then poll — so this implementation
 *       blocks on its own poll loop and surfaces a timeout as a normal failure
 *       (which triggers the automatic credit refund upstream).
 * </ul>
 *
 * <p>It delegates moderation and analysis to the configured OpenAI provider,
 * because BFL exposes neither; that is a composition detail, not a dependency
 * of the interface.
 */
@Component
public class FluxImageProvider implements PixelImageProvider {

    private static final Logger log = LoggerFactory.getLogger(FluxImageProvider.class);
    private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

    private final PixmeProperties.Ai config;
    private final PromptLibrary prompts;
    private final OpenAiImageProvider analysisDelegate;
    private final RestClient client;

    public FluxImageProvider(
            PixmeProperties properties,
            PromptLibrary prompts,
            OpenAiImageProvider analysisDelegate,
            ObjectMapper objectMapper) {
        this.config = properties.ai();
        this.prompts = prompts;
        this.analysisDelegate = analysisDelegate;
        this.client = RestClient.builder()
                .baseUrl(config.flux().baseUrl())
                .defaultHeader("x-key", config.flux().apiKey())
                .requestFactory(AiHttp.requestFactory(config.requestTimeout()))
                .build();
    }

    @Override
    public String name() {
        return "flux";
    }

    @Override
    public SafetyVerdict checkSafety(byte[] image, String mimeType) {
        return analysisDelegate.checkSafety(image, mimeType);
    }

    @Override
    public ImageAnalysis analyzeImage(byte[] image, String mimeType) {
        return analysisDelegate.analyzeImage(image, mimeType);
    }

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
        return request.analysis() == null
                ? generateCharacter(request)
                : render(request, request.analysis());
    }

    private GeneratedCharacter render(GenerationRequest request, ImageAnalysis analysis) {
        String prompt = prompts.characterPrompt(
                analysis, request.style(), request.spec(), request.hasMasterReference());

        Map<String, Object> body = new java.util.HashMap<>();
        body.put("prompt", prompt);
        // input_image is the user's photo; Kontext keeps garment shape from it
        // well, while the prompt holds colours and layering steady.
        body.put("input_image", Base64.getEncoder().encodeToString(request.sourceImage()));
        if (request.hasMasterReference()) {
            // Second reference slot carries the house style as a picture.
            body.put(
                    "input_image_2",
                    Base64.getEncoder().encodeToString(request.masterReference()));
        }
        body.put("aspect_ratio", "1:1");
        body.put("output_format", "png");
        body.put("seed", request.seed());
        body.put("safety_tolerance", 2);
        body.put("prompt_upsampling", false);

        try {
            JsonNode submitted = client.post()
                    .uri("/" + config.flux().imageModel())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);

            String pollingUrl = submitted == null ? null : submitted.path("polling_url").asText(null);
            if (pollingUrl == null || pollingUrl.isBlank()) {
                throw new ApiException(ErrorCode.INTERNAL_ERROR, "생성 작업을 시작하지 못했어요.");
            }

            byte[] image = poll(pollingUrl, request.generationId().toString());
            return new GeneratedCharacter(
                    image,
                    "image/png",
                    name(),
                    config.flux().imageModel(),
                    request.promptVersion(),
                    analysis);
        } catch (ApiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            log.warn("flux generation failed for generation={}", request.generationId(), exception);
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "픽셀 캐릭터를 만들지 못했어요.");
        }
    }

    private byte[] poll(String pollingUrl, String generationId) {
        long deadline = System.currentTimeMillis() + config.requestTimeout().toMillis();

        while (System.currentTimeMillis() < deadline) {
            JsonNode status = RestClient.create()
                    .get()
                    .uri(pollingUrl)
                    .header("x-key", config.flux().apiKey())
                    .retrieve()
                    .body(JsonNode.class);

            String state = status == null ? "" : status.path("status").asText("");

            switch (state) {
                case "Ready" -> {
                    String url = status.path("result").path("sample").asText(null);
                    if (url == null) {
                        throw new ApiException(ErrorCode.INTERNAL_ERROR, "결과 이미지가 없어요.");
                    }
                    byte[] bytes = RestClient.create().get().uri(url).retrieve().body(byte[].class);
                    if (bytes == null || bytes.length == 0) {
                        throw new ApiException(ErrorCode.INTERNAL_ERROR, "결과 이미지를 받지 못했어요.");
                    }
                    return bytes;
                }
                case "Error", "Content Moderated", "Request Moderated" -> {
                    log.info("flux rejected generation={} state={}", generationId, state);
                    throw new ApiException(ErrorCode.UNSAFE_IMAGE);
                }
                default -> sleep();
            }
        }
        throw new ApiException(ErrorCode.INTERNAL_ERROR, "생성 시간이 초과됐어요.");
    }

    private void sleep() {
        try {
            Thread.sleep(POLL_INTERVAL.toMillis());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "생성이 중단됐어요.");
        }
    }
}
