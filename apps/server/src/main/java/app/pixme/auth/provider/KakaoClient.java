package app.pixme.auth.provider;

import java.time.Duration;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.config.PixmeProperties;
import app.pixme.user.domain.AuthProvider;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Kakao OAuth code exchange.
 *
 * <p>The app performs only the browser authorize step and sends us the
 * authorization code; the code→token exchange happens here. That is the whole
 * reason for this shape: the Kakao client secret stays on the server and never
 * ships inside the bundle, and the Kakao access token never reaches the
 * client either — it is used once to read the user id and then discarded.
 */
@Component
public class KakaoClient {

    private static final Logger log = LoggerFactory.getLogger(KakaoClient.class);

    private final PixmeProperties.Auth.Kakao config;
    private final RestClient client;

    public KakaoClient(PixmeProperties properties) {
        this.config = properties.auth().kakao();

        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.client = RestClient.builder().requestFactory(factory).build();
    }

    public SocialIdentity exchange(String authorizationCode, String redirectUri, String codeVerifier) {
        String accessToken = requestAccessToken(authorizationCode, redirectUri, codeVerifier);
        return fetchIdentity(accessToken);
    }

    private String requestAccessToken(
            String authorizationCode, String redirectUri, String codeVerifier) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", config.restApiKey());
        form.add("redirect_uri", redirectUri);
        form.add("code", authorizationCode);
        if (config.clientSecret() != null && !config.clientSecret().isBlank()) {
            form.add("client_secret", config.clientSecret());
        }
        if (codeVerifier != null && !codeVerifier.isBlank()) {
            form.add("code_verifier", codeVerifier);
        }

        try {
            JsonNode response = client.post()
                    .uri(config.tokenUri())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);

            String accessToken = response == null ? null : response.path("access_token").asText(null);
            if (accessToken == null || accessToken.isBlank()) {
                throw new ApiException(ErrorCode.INVALID_PROVIDER_TOKEN);
            }
            return accessToken;
        } catch (ApiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            // Never log the code or the form — it is a bearer-equivalent secret.
            log.warn("kakao token exchange failed: {}", exception.getClass().getSimpleName());
            throw new ApiException(ErrorCode.INVALID_PROVIDER_TOKEN);
        }
    }

    private SocialIdentity fetchIdentity(String accessToken) {
        try {
            JsonNode response = client.get()
                    .uri(config.userInfoUri())
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null || response.path("id").isMissingNode()) {
                throw new ApiException(ErrorCode.INVALID_PROVIDER_TOKEN);
            }

            String providerUserId = response.path("id").asText();
            JsonNode account = response.path("kakao_account");
            String email = account.path("email").asText(null);
            String nickname = account.path("profile").path("nickname").asText(null);

            return new SocialIdentity(AuthProvider.KAKAO, providerUserId, email, nickname);
        } catch (ApiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            log.warn("kakao user lookup failed: {}", exception.getClass().getSimpleName());
            throw new ApiException(ErrorCode.INVALID_PROVIDER_TOKEN);
        }
    }
}
