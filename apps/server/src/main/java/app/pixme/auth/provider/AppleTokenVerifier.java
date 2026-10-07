package app.pixme.auth.provider;

import java.net.URI;
import java.time.Duration;
import java.util.Date;
import java.util.List;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.config.PixmeProperties;
import app.pixme.user.domain.AuthProvider;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.JWKSourceBuilder;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.nimbusds.jwt.proc.ConfigurableJWTProcessor;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Verifies an Apple identity token.
 *
 * <p>This is a security boundary, so every check is explicit rather than
 * trusting the token's contents:
 * <ul>
 *   <li><b>Signature</b> against Apple's published JWKS (cached and
 *       auto-refreshed — re-fetching per sign-in would both be slow and let
 *       Apple rate-limit us out of logins).
 *   <li><b>Issuer</b> must be Apple.
 *   <li><b>Audience</b> must be one of our bundle ids. Without this, a token
 *       minted for <em>any other</em> app would authenticate here.
 *   <li><b>Expiry</b>, with no clock skew allowance beyond the default.
 *   <li><b>Nonce</b> must equal the raw nonce the client generated. This is what
 *       prevents replay of a token captured from another session.
 * </ul>
 */
@Component
public class AppleTokenVerifier {

    private static final Logger log = LoggerFactory.getLogger(AppleTokenVerifier.class);

    private final PixmeProperties.Auth.Apple config;
    private final ConfigurableJWTProcessor<SecurityContext> processor;

    public AppleTokenVerifier(PixmeProperties properties) {
        this.config = properties.auth().apple();

        var jwkSource = buildJwkSource(config.jwksUri());

        DefaultJWTProcessor<SecurityContext> jwtProcessor = new DefaultJWTProcessor<>();
        jwtProcessor.setJWSKeySelector(
                new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, jwkSource));
        this.processor = jwtProcessor;
    }

    private static com.nimbusds.jose.jwk.source.JWKSource<SecurityContext> buildJwkSource(
            String jwksUri) {
        try {
            return JWKSourceBuilder.<SecurityContext>create(URI.create(jwksUri).toURL())
                    .retrying(true)
                    // Apple rotates these keys rarely; re-fetching per sign-in
                    // would be slow and invites rate limiting on the login path.
                    .cache(Duration.ofHours(6).toMillis(), Duration.ofMinutes(5).toMillis())
                    .build();
        } catch (java.net.MalformedURLException exception) {
            throw new IllegalStateException("invalid pixme.auth.apple.jwks-uri", exception);
        }
    }

    /**
     * @param expectedNonce the <em>raw</em> nonce the client generated (it sent
     *     Apple the SHA-256 of this value)
     */
    public SocialIdentity verify(String identityToken, String expectedNonce) {
        try {
            SignedJWT jwt = SignedJWT.parse(identityToken);
            JWTClaimsSet claims = processor.process(jwt, null);

            if (!config.issuer().equals(claims.getIssuer())) {
                throw new ApiException(ErrorCode.INVALID_PROVIDER_TOKEN);
            }

            List<String> audience = claims.getAudience();
            if (audience == null
                    || audience.stream().noneMatch(config.clientIds()::contains)) {
                log.warn("apple token rejected: audience {} not in {}", audience, config.clientIds());
                throw new ApiException(ErrorCode.INVALID_PROVIDER_TOKEN);
            }

            Date expiry = claims.getExpirationTime();
            if (expiry == null || expiry.before(new Date())) {
                throw new ApiException(ErrorCode.INVALID_PROVIDER_TOKEN);
            }

            if (expectedNonce != null && !expectedNonce.isBlank()) {
                String tokenNonce = claims.getStringClaim("nonce");
                String hashedExpected = sha256Hex(expectedNonce);
                // Apple echoes back whichever form the client supplied, so
                // accept either the raw value or its hash.
                boolean nonceMatches = expectedNonce.equals(tokenNonce)
                        || hashedExpected.equalsIgnoreCase(tokenNonce);
                if (!nonceMatches) {
                    log.warn("apple token rejected: nonce mismatch");
                    throw new ApiException(ErrorCode.INVALID_PROVIDER_TOKEN);
                }
            }

            String subject = claims.getSubject();
            if (subject == null || subject.isBlank()) {
                throw new ApiException(ErrorCode.INVALID_PROVIDER_TOKEN);
            }

            String email = claims.getStringClaim("email");
            return new SocialIdentity(AuthProvider.APPLE, subject, email, null);

        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            log.warn("apple token verification failed", exception);
            throw new ApiException(ErrorCode.INVALID_PROVIDER_TOKEN);
        }
    }

    private static String sha256Hex(String value) {
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte current : hash) {
                builder.append(Character.forDigit((current >> 4) & 0xF, 16));
                builder.append(Character.forDigit(current & 0xF, 16));
            }
            return builder.toString();
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
