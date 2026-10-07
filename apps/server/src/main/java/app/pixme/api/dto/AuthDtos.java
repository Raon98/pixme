package app.pixme.api.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Auth request/response shapes.
 *
 * <p>Grouped in one file because they are read together and individually
 * trivial; splitting six two-line records across six files adds navigation
 * cost without adding clarity.
 */
public final class AuthDtos {

    private AuthDtos() {}

    public record AppleSignInRequest(
            @NotBlank String identityToken,
            String authorizationCode,
            String fullName,
            String email,
            /** The raw nonce the client generated; verified against the token. */
            String nonce) {}

    public record KakaoSignInRequest(
            @NotBlank String authorizationCode,
            @NotBlank String redirectUri,
            String codeVerifier) {}

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record LogoutRequest(String refreshToken) {}

    public record TokensResponse(String accessToken, String refreshToken, long expiresIn) {}

    public record SignInResponse(TokensResponse tokens, MeResponse user, boolean isNewUser) {}
}
