package app.pixme.api;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import app.pixme.config.PixmeProperties;
import app.pixme.store.StoreService;
import app.pixme.store.domain.StorePlatform;
import app.pixme.store.domain.StoreWebhookEvent;
import app.pixme.store.receipt.AppleReceiptVerifier;
import app.pixme.store.receipt.GoogleReceiptVerifier;
import app.pixme.store.repository.StoreWebhookEventRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Store-to-server notifications — the only way this app learns about a
 * refund, a chargeback, or a family-sharing removal that happens <em>after</em>
 * the purchase was already granted.
 *
 * <p>Permitted without a user token (see {@code SecurityConfig}): the caller
 * is Apple or Google, not a signed-in user, and each payload is authenticated
 * on its own terms instead — a verified JWS signature for Apple, a shared
 * secret token for Google.
 *
 * <p>Always returns 200 for anything that was successfully parsed, even if the
 * notification type was one we ignore. Both stores retry on any non-2xx
 * response, and retrying a notification we deliberately ignore just wastes
 * both sides' time.
 */
@RestController
@RequestMapping("/api/v1/webhooks")
public class WebhookController {

    private static final Logger log = LoggerFactory.getLogger(WebhookController.class);

    /** App Store Server Notifications V2 types that mean "take this purchase back". */
    private static final java.util.Set<String> APPLE_REVOCATION_TYPES =
            java.util.Set.of("REFUND", "REVOKE");

    /**
     * Notifications that carry a new paid period. Nothing else moves
     * `currentPeriodEnd` forward — the scheduled sweeps can only expire a
     * subscription — so without acting here a renewing subscriber keeps being
     * billed while quietly losing PIXME+ and the monthly credits.
     */
    private static final java.util.Set<String> APPLE_RENEWAL_TYPES =
            java.util.Set.of("DID_RENEW", "SUBSCRIBED");

    /** Google RTDN subscriptionNotification.notificationType for an actual revocation (not a plain cancel). */
    private static final int GOOGLE_SUBSCRIPTION_REVOKED = 12;

    private final StoreService storeService;
    private final AppleReceiptVerifier appleVerifier;
    private final GoogleReceiptVerifier googleVerifier;
    private final StoreWebhookEventRepository eventRepository;
    private final ObjectMapper objectMapper;
    private final PixmeProperties.Purchase.GooglePurchase googleConfig;

    public WebhookController(
            StoreService storeService,
            AppleReceiptVerifier appleVerifier,
            GoogleReceiptVerifier googleVerifier,
            StoreWebhookEventRepository eventRepository,
            ObjectMapper objectMapper,
            PixmeProperties properties) {
        this.storeService = storeService;
        this.appleVerifier = appleVerifier;
        this.googleVerifier = googleVerifier;
        this.eventRepository = eventRepository;
        this.objectMapper = objectMapper;
        this.googleConfig = properties.purchase().google();
    }

    /* ----------------------------------------------------------- apple --- */

    public record ApplePayload(String signedPayload) {}

    @PostMapping("/apple")
    public ResponseEntity<Void> apple(@RequestBody ApplePayload body) {
        JsonNode notification = appleVerifier.verifySignedPayload(body.signedPayload());
        if (notification == null) {
            // An unverifiable payload is either a replay/forgery attempt or a
            // key rotation we don't know about yet — either way, not safe to
            // act on, but still 200 so a transient key-rotation hiccup
            // doesn't trigger a retry storm from Apple.
            log.warn("rejected apple server notification: signature did not verify");
            return ResponseEntity.ok().build();
        }

        String notificationId = notification.path("notificationUUID").asText(null);
        String notificationType = notification.path("notificationType").asText("UNKNOWN");

        if (notificationId != null && alreadyHandled(StorePlatform.IOS, notificationId)) {
            return ResponseEntity.ok().build();
        }

        JsonNode data = notification.path("data");
        String signedTransactionInfo = data.path("signedTransactionInfo").asText(null);

        if (APPLE_REVOCATION_TYPES.contains(notificationType) && signedTransactionInfo != null) {
            JsonNode transaction = appleVerifier.verifySignedPayload(signedTransactionInfo);
            if (transaction != null) {
                String transactionId = transaction.path("transactionId").asText(null);
                String originalTransactionId =
                        transaction.path("originalTransactionId").asText(transactionId);
                storeService.revoke(StorePlatform.IOS, transactionId, originalTransactionId);
            } else {
                log.warn("apple revocation notification carried an unverifiable transaction");
            }
        } else if (APPLE_RENEWAL_TYPES.contains(notificationType)
                && signedTransactionInfo != null) {
            JsonNode transaction = appleVerifier.verifySignedPayload(signedTransactionInfo);
            if (transaction != null) {
                String transactionId = transaction.path("transactionId").asText(null);
                String originalTransactionId =
                        transaction.path("originalTransactionId").asText(transactionId);
                long expiresMillis = transaction.path("expiresDate").asLong(0L);
                storeService.renew(
                        StorePlatform.IOS,
                        originalTransactionId,
                        expiresMillis > 0 ? Instant.ofEpochMilli(expiresMillis) : null,
                        true);
            } else {
                log.warn("apple renewal notification carried an unverifiable transaction");
            }
        } else {
            // Billing retries, price consent, etc. — these do not themselves
            // change what the account is entitled to.
            log.info("apple server notification type={} (no action)", notificationType);
        }

        recordEvent(StorePlatform.IOS, notificationId, notificationType, notification);
        return ResponseEntity.ok().build();
    }

    /* ---------------------------------------------------------- google --- */

    public record PubSubEnvelope(PubSubMessage message) {}

    public record PubSubMessage(String data, String messageId) {}

    @PostMapping("/google")
    public ResponseEntity<Void> google(
            @RequestParam(value = "token", required = false) String token,
            @RequestBody PubSubEnvelope envelope) {

        if (googleConfig.webhookToken() == null || googleConfig.webhookToken().isBlank()) {
            log.warn(
                    "PIXME_GOOGLE_WEBHOOK_TOKEN not configured — Google Play revocations are NOT "
                            + "being applied. Do not run production like this.");
            return ResponseEntity.ok().build();
        }
        if (!googleConfig.webhookToken().equals(token)) {
            log.warn("rejected google webhook: bad or missing token");
            return ResponseEntity.ok().build();
        }

        if (envelope.message() == null || envelope.message().data() == null) {
            return ResponseEntity.ok().build();
        }

        String messageId = envelope.message().messageId();
        if (messageId != null && alreadyHandled(StorePlatform.ANDROID, messageId)) {
            return ResponseEntity.ok().build();
        }

        JsonNode payload;
        try {
            byte[] decoded = Base64.getDecoder().decode(envelope.message().data());
            payload = objectMapper.readTree(new String(decoded, StandardCharsets.UTF_8));
        } catch (Exception exception) {
            log.warn("could not decode google pub/sub message", exception);
            return ResponseEntity.ok().build();
        }

        JsonNode subscriptionNotification = payload.path("subscriptionNotification");
        String notificationType = subscriptionNotification.has("notificationType")
                ? "SUBSCRIPTION_" + subscriptionNotification.path("notificationType").asInt(-1)
                : (payload.has("voidedPurchaseNotification") ? "VOIDED_PURCHASE" : "UNKNOWN");

        if (subscriptionNotification.path("notificationType").asInt(-1) == GOOGLE_SUBSCRIPTION_REVOKED) {
            String purchaseToken = subscriptionNotification.path("purchaseToken").asText(null);
            String subscriptionId = subscriptionNotification.path("subscriptionId").asText(null);
            resolveAndRevoke(purchaseToken, subscriptionId);
        } else if (payload.has("voidedPurchaseNotification")) {
            // One-time product refunds on Android arrive through the separate
            // Voided Purchases API (polled, not pushed) rather than RTDN —
            // not handled here yet. Logged loudly so the gap stays visible
            // rather than silently missing these refunds.
            log.warn(
                    "voided purchase notification received but one-time-product revocation via "
                            + "RTDN is not implemented — payload: {}",
                    payload.path("voidedPurchaseNotification"));
        } else {
            log.info("google rtdn type={} (no action)", notificationType);
        }

        recordEvent(StorePlatform.ANDROID, messageId, notificationType, payload);
        return ResponseEntity.ok().build();
    }

    /**
     * Play's RTDN carries a purchase token, not the order id our
     * {@code Purchase}/{@code Subscription} rows are keyed by — so the token
     * has to be exchanged for the order id via the same Play Developer API
     * call the original purchase verification used.
     */
    private void resolveAndRevoke(String purchaseToken, String subscriptionId) {
        if (purchaseToken == null || subscriptionId == null) {
            log.warn("google revocation missing purchaseToken or subscriptionId");
            return;
        }
        var verified = googleVerifier.verify(purchaseToken, subscriptionId);
        if (!verified.valid()) {
            log.warn(
                    "could not resolve order id for revoked google subscription {}", subscriptionId);
            return;
        }
        storeService.revoke(StorePlatform.ANDROID, verified.transactionId(), verified.originalTransactionId());
    }

    private boolean alreadyHandled(StorePlatform platform, String notificationId) {
        return eventRepository.existsByPlatformAndNotificationId(platform, notificationId);
    }

    private void recordEvent(
            StorePlatform platform, String notificationId, String notificationType, JsonNode payload) {
        if (notificationId == null) {
            return;
        }
        eventRepository.save(StoreWebhookEvent.create(
                platform, notificationId, notificationType, payload.toString()));
    }
}
