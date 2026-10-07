package app.pixme.store.receipt;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

import app.pixme.config.PixmeProperties;
import app.pixme.store.domain.StorePlatform;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Verifies a Google Play purchase token against the Play Developer API.
 *
 * <p>Unlike StoreKit 2, Play gives the client an opaque purchase token with no
 * signature of its own, so verification <em>must</em> be a server-to-server
 * call — there is nothing offline to check. This class therefore:
 *
 * <ol>
 *   <li>mints a short-lived OAuth access token by signing a JWT assertion with
 *       the service-account key (cached until shortly before expiry, so a
 *       purchase doesn't pay for a token round trip),
 *   <li>calls the products or subscriptions endpoint depending on the SKU,
 *   <li>and maps Play's state codes onto granted / pending / invalid.
 * </ol>
 *
 * <p>Pending is a real and common state on Play (slow payment methods), and
 * treating it as a grant is how people get free credits.
 */
@Component
public class GoogleReceiptVerifier implements ReceiptVerifier {

    private static final Logger log = LoggerFactory.getLogger(GoogleReceiptVerifier.class);

    private static final String TOKEN_URI = "https://oauth2.googleapis.com/token";
    private static final String SCOPE = "https://www.googleapis.com/auth/androidpublisher";
    private static final String API_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3";

    private final PixmeProperties.Purchase.GooglePurchase config;
    private final boolean allowSandbox;
    private final ObjectMapper objectMapper;
    private final RestClient client;

    private volatile String cachedAccessToken;
    private volatile Instant cachedTokenExpiry = Instant.EPOCH;

    public GoogleReceiptVerifier(PixmeProperties properties, ObjectMapper objectMapper) {
        this.config = properties.purchase().google();
        this.allowSandbox = properties.purchase().allowSandbox();
        this.objectMapper = objectMapper;

        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofSeconds(15));
        this.client = RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public StorePlatform platform() {
        return StorePlatform.ANDROID;
    }

    /**
     * @param receipt the Play purchase token
     * @param expectedStoreProductId the SKU; also decides which endpoint to call
     */
    @Override
    public VerifiedPurchase verify(String receipt, String expectedStoreProductId) {
        if (config.serviceAccountJson() == null || config.serviceAccountJson().isBlank()) {
            log.error("Google service account not configured; cannot verify Play purchases");
            return VerifiedPurchase.invalid("google credentials missing");
        }

        try {
            String accessToken = accessToken();
            boolean subscription = expectedStoreProductId != null
                    && expectedStoreProductId.contains("plus");

            String uri = subscription
                    ? "%s/applications/%s/purchases/subscriptions/%s/tokens/%s"
                            .formatted(API_BASE, config.packageName(), expectedStoreProductId, receipt)
                    : "%s/applications/%s/purchases/products/%s/tokens/%s"
                            .formatted(API_BASE, config.packageName(), expectedStoreProductId, receipt);

            JsonNode response = client.get()
                    .uri(uri)
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null) {
                return VerifiedPurchase.invalid("empty response from Play");
            }

            return subscription
                    ? mapSubscription(response, expectedStoreProductId, receipt)
                    : mapProduct(response, expectedStoreProductId, receipt);

        } catch (Exception exception) {
            log.warn("google receipt verification failed", exception);
            return VerifiedPurchase.invalid(exception.getClass().getSimpleName());
        }
    }

    private VerifiedPurchase mapProduct(JsonNode response, String productId, String token) {
        // purchaseState: 0 = purchased, 1 = cancelled, 2 = pending
        int purchaseState = response.path("purchaseState").asInt(1);
        boolean testPurchase = response.has("purchaseType")
                && response.path("purchaseType").asInt(-1) == 0;

        if (testPurchase && !allowSandbox) {
            return VerifiedPurchase.invalid("test purchase rejected in production");
        }

        String orderId = response.path("orderId").asText(token);

        return switch (purchaseState) {
            case 0 -> new VerifiedPurchase(
                    true, orderId, orderId, productId, false, null, false, testPurchase, null);
            case 2 -> new VerifiedPurchase(
                    true, orderId, orderId, productId, true, null, false, testPurchase, "pending");
            default -> VerifiedPurchase.invalid("purchaseState=" + purchaseState);
        };
    }

    private VerifiedPurchase mapSubscription(JsonNode response, String productId, String token) {
        long expiryMillis = response.path("expiryTimeMillis").asLong(0);
        Instant expiresAt = expiryMillis > 0 ? Instant.ofEpochMilli(expiryMillis) : null;

        // paymentState: 0 = pending, 1 = received, 2 = free trial, 3 = pending upgrade
        int paymentState = response.path("paymentState").asInt(-1);
        boolean autoRenewing = response.path("autoRenewing").asBoolean(false);
        String orderId = response.path("orderId").asText(token);
        boolean testPurchase = response.has("purchaseType")
                && response.path("purchaseType").asInt(-1) == 0;

        if (testPurchase && !allowSandbox) {
            return VerifiedPurchase.invalid("test subscription rejected in production");
        }
        if (paymentState == 0) {
            return new VerifiedPurchase(
                    true, orderId, orderId, productId, true, expiresAt, autoRenewing, testPurchase, "pending");
        }
        if (paymentState != 1 && paymentState != 2) {
            return VerifiedPurchase.invalid("paymentState=" + paymentState);
        }

        return new VerifiedPurchase(
                true, orderId, orderId, productId, false, expiresAt, autoRenewing, testPurchase, null);
    }

    /**
     * Service-account OAuth, cached.
     *
     * <p>Signs a JWT assertion with the private key from the service-account
     * JSON and exchanges it for an access token. Refreshed a minute before
     * expiry so a purchase never waits on a token that just lapsed.
     */
    private String accessToken() throws Exception {
        if (cachedAccessToken != null && cachedTokenExpiry.isAfter(Instant.now().plusSeconds(60))) {
            return cachedAccessToken;
        }

        JsonNode credentials = objectMapper.readTree(config.serviceAccountJson());
        String clientEmail = credentials.path("client_email").asText();
        String privateKeyPem = credentials.path("private_key").asText();

        PrivateKey privateKey = parsePrivateKey(privateKeyPem);
        Instant now = Instant.now();

        String assertion = Jwts.builder()
                .issuer(clientEmail)
                .audience()
                .add(TOKEN_URI)
                .and()
                .claim("scope", SCOPE)
                .issuedAt(java.util.Date.from(now))
                .expiration(java.util.Date.from(now.plus(Duration.ofMinutes(55))))
                .signWith(privateKey, Jwts.SIG.RS256)
                .compact();

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
        form.add("assertion", assertion);

        JsonNode response = client.post()
                .uri(TOKEN_URI)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(JsonNode.class);

        if (response == null || !response.has("access_token")) {
            throw new IllegalStateException("google token exchange returned no access_token");
        }

        cachedAccessToken = response.path("access_token").asText();
        cachedTokenExpiry = Instant.now().plusSeconds(response.path("expires_in").asLong(3600));
        return cachedAccessToken;
    }

    private PrivateKey parsePrivateKey(String pem) throws Exception {
        String base64 = pem.replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] encoded = Base64.getDecoder().decode(base64.getBytes(StandardCharsets.US_ASCII));
        return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(encoded));
    }

    /** Acknowledges a Play purchase so it isn't auto-refunded after 3 days. */
    public void acknowledge(String productId, String purchaseToken, boolean subscription) {
        try {
            String accessToken = accessToken();
            String uri = subscription
                    ? "%s/applications/%s/purchases/subscriptions/%s/tokens/%s:acknowledge"
                            .formatted(API_BASE, config.packageName(), productId, purchaseToken)
                    : "%s/applications/%s/purchases/products/%s/tokens/%s:acknowledge"
                            .formatted(API_BASE, config.packageName(), productId, purchaseToken);

            client.post()
                    .uri(uri)
                    .header("Authorization", "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of())
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception exception) {
            log.warn("google acknowledge failed for {}", productId, exception);
        }
    }
}
