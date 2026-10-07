package app.pixme.api;

import app.pixme.api.dto.AuthDtos;
import app.pixme.auth.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Sign-in, refresh and sign-out. The only unauthenticated write surface. */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final ResponseAssembler assembler;

    public AuthController(AuthService authService, ResponseAssembler assembler) {
        this.authService = authService;
        this.assembler = assembler;
    }

    @PostMapping("/apple")
    public AuthDtos.SignInResponse apple(
            @Valid @RequestBody AuthDtos.AppleSignInRequest request) {
        AuthService.SignInResult result = authService.signInWithApple(
                request.identityToken(), request.nonce(), request.email());
        return toResponse(result);
    }

    @PostMapping("/kakao")
    public AuthDtos.SignInResponse kakao(
            @Valid @RequestBody AuthDtos.KakaoSignInRequest request) {
        AuthService.SignInResult result = authService.signInWithKakao(
                request.authorizationCode(), request.redirectUri(), request.codeVerifier());
        return toResponse(result);
    }

    @PostMapping("/refresh")
    public AuthDtos.TokensResponse refresh(
            @Valid @RequestBody AuthDtos.RefreshRequest request) {
        AuthService.Tokens tokens = authService.refresh(request.refreshToken());
        return new AuthDtos.TokensResponse(
                tokens.accessToken(), tokens.refreshToken(), tokens.expiresInSeconds());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody AuthDtos.LogoutRequest request) {
        authService.signOut(request.refreshToken());
        return ResponseEntity.noContent().build();
    }

    private AuthDtos.SignInResponse toResponse(AuthService.SignInResult result) {
        return new AuthDtos.SignInResponse(
                new AuthDtos.TokensResponse(
                        result.tokens().accessToken(),
                        result.tokens().refreshToken(),
                        result.tokens().expiresInSeconds()),
                assembler.me(result.user()),
                result.isNewUser());
    }
}
