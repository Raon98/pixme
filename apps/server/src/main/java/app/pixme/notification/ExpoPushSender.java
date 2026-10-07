package app.pixme.notification;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import app.pixme.config.PixmeProperties;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Expo Push delivery.
 *
 * <p>Expo is the right trade for v1: one endpoint for both APNs and FCM, no
 * certificate plumbing, and the app already uses Expo's notification module.
 * The {@link PushSender} seam means moving to direct APNs/FCM later is one new
 * class.
 *
 * <p>Two operational details that matter: Expo accepts at most 100 messages per
 * request, and it reports dead tokens as {@code DeviceNotRegistered} — which we
 * surface so the caller can retire them rather than pushing to them forever.
 */
@Component
public class ExpoPushSender implements PushSender {

    private static final Logger log = LoggerFactory.getLogger(ExpoPushSender.class);
    private static final int BATCH_SIZE = 100;

    private final PixmeProperties.Push config;
    private final RestClient client;

    public ExpoPushSender(PixmeProperties properties) {
        this.config = properties.push();

        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofSeconds(15));

        RestClient.Builder builder = RestClient.builder()
                .baseUrl(config.expoApiUrl())
                .requestFactory(factory)
                .defaultHeader("accept", "application/json");

        if (config.expoAccessToken() != null && !config.expoAccessToken().isBlank()) {
            builder.defaultHeader("Authorization", "Bearer " + config.expoAccessToken());
        }
        this.client = builder.build();
    }

    @Override
    public List<String> send(List<PushMessage> messages) {
        if (!config.enabled() || messages.isEmpty()) {
            return List.of();
        }

        List<String> invalidTokens = new ArrayList<>();

        for (int start = 0; start < messages.size(); start += BATCH_SIZE) {
            List<PushMessage> batch =
                    messages.subList(start, Math.min(messages.size(), start + BATCH_SIZE));
            invalidTokens.addAll(sendBatch(batch));
        }
        return invalidTokens;
    }

    private List<String> sendBatch(List<PushMessage> batch) {
        List<Map<String, Object>> payload = new ArrayList<>(batch.size());
        for (PushMessage message : batch) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("to", message.token());
            entry.put("title", message.title());
            entry.put("body", message.body());
            entry.put("data", message.data());
            entry.put("sound", message.playSound() ? "default" : null);
            entry.put("channelId", message.channelId());
            // Hearts and reminders are not worth waking a device for.
            entry.put("priority", message.playSound() ? "high" : "normal");
            payload.add(entry);
        }

        try {
            JsonNode response = client.post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(JsonNode.class);

            return collectInvalidTokens(response, batch);
        } catch (RuntimeException exception) {
            // Push is best-effort. A delivery failure must never fail the
            // product action that triggered it.
            log.warn("expo push batch failed ({} messages)", batch.size(), exception);
            return List.of();
        }
    }

    private List<String> collectInvalidTokens(JsonNode response, List<PushMessage> batch) {
        List<String> invalid = new ArrayList<>();
        if (response == null) {
            return invalid;
        }

        JsonNode data = response.path("data");
        for (int index = 0; index < data.size() && index < batch.size(); index++) {
            JsonNode ticket = data.get(index);
            if (!"error".equals(ticket.path("status").asText())) {
                continue;
            }
            String errorCode = ticket.path("details").path("error").asText("");
            if ("DeviceNotRegistered".equals(errorCode)) {
                invalid.add(batch.get(index).token());
            } else {
                log.debug("push ticket error: {}", ticket);
            }
        }
        return invalid;
    }
}
