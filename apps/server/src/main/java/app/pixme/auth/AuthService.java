package app.pixme.auth;

import java.time.Instant;
import java.util.UUID;

import app.pixme.auth.domain.RefreshToken;
import app.pixme.auth.provider.AppleTokenVerifier;
import app.pixme.auth.provider.KakaoClient;
import app.pixme.auth.provider.SocialIdentity;
import app.pixme.auth.repository.RefreshTokenRepository;
import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.security.JwtService;
import app.pixme.user.UserService;
import app.pixme.user.domain.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sign-in, token refresh and sign-out.
 *
 * <p>PIXME has no passwords and no identity verification — no PASS, no phone
 * verification, no real-name or ID check. Two social providers, one tap. The
 * safety model is reporting, blocking and content screening rather than
 * identity collection, which both lowers the barrier to the first PIXME and
 * means we hold far less sensitive data.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final AppleTokenVerifier appleVerifier;
    private final KakaoClient kakaoClient;
    private final UserService userService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;

    public AuthService(
            AppleTokenVerifier appleVerifier,
            KakaoClient kakaoClient,
            UserService userService,
            RefreshTokenRepository refreshTokenRepository,
            JwtService jwtService) {
        this.appleVerifier = appleVerifier;
        this.kakaoClient = kakaoClient;
        this.userService = userService;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
    }

    public record Tokens(String accessToken, String refreshToken, long expiresInSeconds) {}

    public record SignInResult(User user, Tokens tokens, boolean isNewUser) {}

    /* ------------------------------------------------------------ sign in */

    @Transactional
    public SignInResult signInWithApple(
            String identityToken, String nonce, String emailFallback) {
        SocialIdentity identity = appleVerifier.verify(identityToken, nonce);
        // Apple only returns the email on first consent; prefer the verified
        // claim and fall back to what the client forwarded.
        String email = identity.email() != null ? identity.email() : emailFallback;
        return completeSignIn(
                new SocialIdentity(
                        identity.provider(), identity.providerUserId(), email, identity.displayName()));
    }

    @Transactional
    public SignInResult signInWithKakao(
            String authorizationCode, String redirectUri, String codeVerifier) {
        SocialIdentity identity =
                kakaoClient.exchange(authorizationCode, redirectUri, codeVerifier);
        return completeSignIn(identity);
    }

    /** Native Kakao SDK path — see {@link KakaoClient#identityFromAccessToken}. */
    @Transactional
    public SignInResult signInWithKakaoAccessToken(String accessToken) {
        SocialIdentity identity = kakaoClient.identityFromAccessToken(accessToken);
        return completeSignIn(identity);
    }

    private SignInResult completeSignIn(SocialIdentity identity) {
        UserService.Resolution resolution = userService.findOrCreate(identity);
        User user = resolution.user();

        if (user.isSuspended(Instant.now())) {
            throw new ApiException(ErrorCode.ACCOUNT_SUSPENDED);
        }

        Tokens tokens = issueTokens(user);
        log.info(
                "sign-in provider={} user={} new={}",
                identity.provider(),
                user.getId(),
                resolution.created());
        return new SignInResult(user, tokens, resolution.created());
    }

    /* ------------------------------------------------------------ refresh */

    /**
     * Rotates the refresh token.
     *
     * <p>A token presented after it has already been exchanged can only mean it
     * was captured, so that case revokes every session for the account rather
     * than quietly issuing new tokens to whoever asked.
     */
    @Transactional
    public Tokens refresh(String rawRefreshToken) {
        String hash = jwtService.hashRefreshToken(rawRefreshToken);
        RefreshToken stored = refreshTokenRepository
                .findByTokenHash(hash)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));

        Instant now = Instant.now();

        if (stored.isReplayed()) {
            refreshTokenRepository.revokeAllForUser(stored.getUserId(), now);
            log.warn("refresh token replay detected for user={}", stored.getUserId());
            throw new ApiException(ErrorCode.REFRESH_TOKEN_REUSED);
        }

        if (!stored.isUsable(now)) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }

        User user = userService.requireActive(stored.getUserId());
        Tokens tokens = issueTokens(user);

        stored.rotateTo(UUID.randomUUID());
        refreshTokenRepository.save(stored);

        return tokens;
    }

    /* ----------------------------------------------------------- sign out */

    @Transactional
    public void signOut(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository
                .findByTokenHash(jwtService.hashRefreshToken(rawRefreshToken))
                .ifPresent(token -> {
                    token.revoke();
                    refreshTokenRepository.save(token);
                });
    }

    @Transactional
    public void revokeAllSessions(UUID userId) {
        refreshTokenRepository.revokeAllForUser(userId, Instant.now());
    }

    /* ------------------------------------------------------------ helpers */

    private Tokens issueTokens(User user) {
        boolean profileCompleted = userService.isProfileCompleted(user.getId());
        String accessToken = jwtService.createAccessToken(user.getId(), profileCompleted);

        String rawRefresh = jwtService.generateRefreshToken();
        RefreshToken refreshToken = RefreshToken.issue(
                user.getId(),
                jwtService.hashRefreshToken(rawRefresh),
                Instant.now().plus(jwtService.refreshTokenTtl()));
        refreshTokenRepository.save(refreshToken);

        return new Tokens(
                accessToken, rawRefresh, jwtService.accessTokenTtl().toSeconds());
    }
}
