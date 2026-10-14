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
        RateLimit rateLimit,
        Connection connection,
        Master master) {

    public record Maintenance(boolean active, String message) {}

    /**
     * Accounts that bypass every paywall: unlimited generation, PIXME+ always
     * active. Two uses — the operator's own account, and a standing account
     * for App Store / Play reviewers so they can reach every paid screen
     * without a real purchase. Matched by the sign-in provider's email, so it
     * follows an account across reinstalls without a DB flag to maintain.
     */
    public record Master(List<String> emails) {

        public Master {
            emails = emails == null ? List.of() : emails;
        }

        public boolean isMaster(String email) {
            if (email == null || email.isBlank()) {
                return false;
            }
            return emails.stream().anyMatch(email::equalsIgnoreCase);
        }
    }

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

        /**
         * @param imageQuality {@code low} · {@code medium} · {@code high}. This
         *     is the single biggest lever on cost per generation, and PIXME's
         *     output is a flat-palette sprite that gets normalised and shown at
         *     72–300px — so the top tier is usually paying for detail the
         *     product throws away. Measure before choosing.
         */
        public record OpenAi(
                String apiKey,
                String baseUrl,
                String analysisModel,
                String imageModel,
                String moderationModel,
                String imageQuality) {}

        public record Flux(String apiKey, String baseUrl, String imageModel) {}
    }

    /**
     * Free generation is an onboarding grant, not a daily allowance: the first
     * generation, one retry of that first result, and one bonus credit.
     * Everything after that is paid.
     */
    public record Generation(
            int onboardingBonusCredits,
            int maxPerDay,
            int maxCandidatesPerDay,
            int globalMaxPerDay) {}

    public record Feed(
            int pageSize,
            int maxExposuresPerAuthorPerDay,
            double newUserQuota) {}

    /**
     * @param feetTopRatio the highest a character's feet may be placed, as a
     *     fraction of canvas height. Not the horizon itself: a character is
     *     anchored at the feet and drawn upwards, so standing exactly on the
     *     skyline puts their whole body in the sky. Must match the client's
     *     {@code FEET_TOP}.
     */
    public record Square(
            int pageSize,
            int canvasWidth,
            int canvasHeight,
            int minSeparation,
            int curationSize,
            double feetTopRatio) {}

    public record Push(String expoApiUrl, String expoAccessToken, boolean enabled) {}

    public record Purchase(ApplePurchase apple, GooglePurchase google, boolean allowSandbox) {

        public record ApplePurchase(
                String bundleId,
                String issuerId,
                String keyId,
                String privateKey,
                String rootCertificatesPath) {}

        public record GooglePurchase(
                String packageName, String serviceAccountJson, String webhookToken) {}
    }

    public record Privacy(Duration originalRetention, Duration deletionGracePeriod) {}

    /**
     * The daily cap on "👋 친해지고 싶어요" — the actual scarcity lever, distinct
     * from {@link RateLimit#connectPerHour()} which exists only to blunt a
     * burst/abuse pattern. This is the number the product cares about: too
     * high and the gesture stops meaning anything, too low and PIXME+'s extra
     * allowance isn't worth paying for.
     */
    public record Connection(int freeWavesPerDay, int plusWavesPerDay) {}

    public record RateLimit(
            int generationPerHour,
            int heartPerMinute,
            int connectPerHour,
            int messagePerMinute,
            int reportPerDay) {}
}
