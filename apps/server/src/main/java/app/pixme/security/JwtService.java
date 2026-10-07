package app.pixme.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

import javax.crypto.SecretKey;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.config.PixmeProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

/**
 * Access-token minting and verification, plus refresh-token generation.
 *
 * <p>Design notes:
 * <ul>
 *   <li>Access tokens are short-lived, stateless HS256 JWTs. No database read
 *       is needed to authenticate a request.
 *   <li>Refresh tokens are opaque random strings, never JWTs — they are stored
 *       <em>hashed</em> so a database leak cannot be replayed, and they rotate
 *       on every use so a stolen token is detectable (see
 *       {@code REFRESH_TOKEN_REUSED}).
 * </ul>
 */
@Service
public class JwtService {

    private static final String CLAIM_PROFILE_COMPLETED = "pc";

    private final SecretKey key;
    private final PixmeProperties.Auth.Jwt config;
    private final SecureRandom random = new SecureRandom();

    public JwtService(PixmeProperties properties) {
        this.config = properties.auth().jwt();
        byte[] secret = config.secret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException(
                    "pixme.auth.jwt.secret must be at least 32 bytes; refusing to start");
        }
        this.key = Keys.hmacShaKeyFor(secret);
    }

    public String createAccessToken(UUID userId, boolean profileCompleted) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(config.issuer())
                .subject(userId.toString())
                .claim(CLAIM_PROFILE_COMPLETED, profileCompleted)
                .issuedAt(java.util.Date.from(now))
                .expiration(java.util.Date.from(now.plus(config.accessTokenTtl())))
                .signWith(key)
                .compact();
    }

    public AuthPrincipal verifyAccessToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(config.issuer())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            UUID userId = UUID.fromString(claims.getSubject());
            boolean profileCompleted =
                    Boolean.TRUE.equals(claims.get(CLAIM_PROFILE_COMPLETED, Boolean.class));
            return new AuthPrincipal(userId, profileCompleted);
        } catch (ExpiredJwtException exception) {
            throw new ApiException(ErrorCode.TOKEN_EXPIRED);
        } catch (JwtException | IllegalArgumentException exception) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }
    }

    /** 256 bits of entropy, URL-safe. Returned to the client exactly once. */
    public String generateRefreshToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** What we persist. The raw refresh token never touches the database. */
    public String hashRefreshToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte value : hash) {
                builder.append(Character.forDigit((value >> 4) & 0xF, 16));
                builder.append(Character.forDigit(value & 0xF, 16));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    public java.time.Duration accessTokenTtl() {
        return config.accessTokenTtl();
    }

    public java.time.Duration refreshTokenTtl() {
        return config.refreshTokenTtl();
    }
}
