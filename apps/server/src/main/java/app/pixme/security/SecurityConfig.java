package app.pixme.security;

import java.util.List;

import app.pixme.common.ApiErrorResponse;
import app.pixme.common.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * API security.
 *
 * <p>Stateless, token-only, deny-by-default. The public surface is deliberately
 * tiny: sign-in, token refresh, the remote app config (needed before login to
 * show the maintenance/update gate) and health.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final ObjectMapper objectMapper;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter, ObjectMapper objectMapper) {
        this.jwtFilter = jwtFilter;
        this.objectMapper = objectMapper;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .anonymous(anonymous -> anonymous.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/v1/auth/**",
                                "/api/v1/system/config",
                                "/actuator/health",
                                "/actuator/health/**")
                        .permitAll()
                        // The chat socket authenticates from its own handshake
                        // query parameter (RN's WebSocket cannot send headers).
                        .requestMatchers("/ws/**")
                        .permitAll()
                        // Store webhooks are authenticated by signature, not by
                        // a user token.
                        .requestMatchers(HttpMethod.POST, "/api/v1/webhooks/**")
                        .permitAll()
                        // Profile setup must be reachable before the profile is
                        // complete; everything else requires a finished profile.
                        .requestMatchers(
                                HttpMethod.GET, "/api/v1/users/me", "/api/v1/interests",
                                "/api/v1/users/nickname-availability")
                        .hasAnyRole("USER", "PENDING_PROFILE")
                        .requestMatchers(
                                HttpMethod.PATCH, "/api/v1/users/me")
                        .hasAnyRole("USER", "PENDING_PROFILE")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/users/me")
                        .hasAnyRole("USER", "PENDING_PROFILE")
                        .anyRequest()
                        .hasRole("USER"))
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint((request, response, exception) ->
                                write(response, ErrorCode.UNAUTHORIZED))
                        .accessDeniedHandler((request, response, exception) ->
                                write(response, ErrorCode.FORBIDDEN)))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private void write(jakarta.servlet.http.HttpServletResponse response, ErrorCode code)
            throws java.io.IOException {
        response.setStatus(code.status().value());
        response.setContentType("application/json;charset=UTF-8");
        objectMapper.writeValue(
                response.getOutputStream(), ApiErrorResponse.of(code, code.defaultMessage(), null));
    }

    /**
     * The native app does not need CORS. This exists for the local web build of
     * the Expo app and for internal tools, and is intentionally not a wildcard
     * with credentials.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of("http://localhost:*", "https://*.pixme.app"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
}
