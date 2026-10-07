package app.pixme.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed view of the {@code pixme.*} configuration tree.
 *
 * <p>Every operational knob the service has lives here rather than as a
 * constant in a service class — pricing, limits, retention windows and
 * provider selection all have to be changeable without a code change.
 */
@ConfigurationProperties(prefix = "pixme")
public record PixmeProperties(
        String timezone,
        String minimumSupportedVersion,
        Maintenance maintenance,
        Auth auth,
        Storage storage,
        Ai ai,
        Generation generation,
        Feed feed,
        Square square,
        Push push,
        Purchase purchase,
        Privacy privacy,
        RateLimit rateLimit) {

    public record Maintenance(boolean active, String message) {}

    public record Auth(Jwt jwt, Apple apple, Kakao kakao) {

        public record Jwt(
                String secret,
                String issuer,
                Duration accessTokenTtl,
                Duration refreshTokenTtl) {}

        public record Apple(List<String> clientIds, String jwksUri, String issuer) {}

        public record Kakao(
                String restApiKey,
                String clientSecret,
                String tokenUri,
                String userInfoUri) {}
    }

    public record Storage(
            String provider,
            String region,
            String endpoint,
            String accessKey,
            String secretKey,
            String originalsBucket,
            String charactersBucket,
            String charactersCdnBaseUrl,
            Duration uploadUrlTtl,
            Duration originalViewUrlTtl) {}

    public record Ai(
            String provider,
            String promptVersion,
            Duration requestTimeout,
            int maxAttempts,
            MasterReference masterReference,
            OpenAi openai,
            Flux flux) {

        /**
         * The official character reference sent as "Image B" on every
         * generation, and the source of the fixed character geometry.
         *
         * @param required fail startup when the asset is missing — set true in
         *     production so a bad deploy can't quietly ship drifting characters
         */
        public record MasterReference(
                String resource, String mimeType, String version, boolean required) {}

        public record OpenAi(
                String apiKey,
                String baseUrl,
                String analysisModel,
                String imageModel,
                String moderationModel) {}

        public record Flux(String apiKey, String baseUrl, String imageModel) {}
    }

    /**
     * Free generation is an onboarding grant, not a daily allowance: the first
     * generation, one retry of that first result, and one bonus credit.
     * Everything after that is paid.
     */
    public record Generation(
            int onboardingBonusCredits, int maxPerDay, int maxCandidatesPerDay) {}

    public record Feed(
            int pageSize,
            int maxExposuresPerAuthorPerDay,
            double newUserQuota) {}

    public record Square(
            int pageSize,
            int canvasWidth,
            int canvasHeight,
            int minSeparation,
            int curationSize) {}

    public record Push(String expoApiUrl, String expoAccessToken, boolean enabled) {}

    public record Purchase(ApplePurchase apple, GooglePurchase google, boolean allowSandbox) {

        public record ApplePurchase(
                String bundleId,
                String issuerId,
                String keyId,
                String privateKey,
                String rootCertificatesPath) {}

        public record GooglePurchase(String packageName, String serviceAccountJson) {}
    }

    public record Privacy(Duration originalRetention, Duration deletionGracePeriod) {}

    public record RateLimit(
            int generationPerHour,
            int heartPerMinute,
            int connectPerHour,
            int messagePerMinute,
            int reportPerDay) {}
}
