package app.pixme.security;

import java.io.IOException;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import app.pixme.common.ApiErrorResponse;
import app.pixme.common.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Reads the bearer token and populates the security context.
 *
 * <p>An invalid or expired token is answered immediately with the same JSON
 * envelope the rest of the API uses, including the distinct
 * {@code TOKEN_EXPIRED} code — the app relies on that code to decide between
 * "refresh and retry" and "sign in again".
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER = "Bearer ";

    private final JwtService jwtService;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(JwtService jwtService, ObjectMapper objectMapper) {
        this.jwtService = jwtService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith(BEARER)) {
            chain.doFilter(request, response);
            return;
        }

        String token = header.substring(BEARER.length()).trim();
        try {
            AuthPrincipal principal = jwtService.verifyAccessToken(token);

            // Users who haven't finished profile setup get a restricted role so
            // that social endpoints can be closed to them declaratively.
            var authorities = principal.profileCompleted()
                    ? List.of(new SimpleGrantedAuthority("ROLE_USER"))
                    : List.of(new SimpleGrantedAuthority("ROLE_PENDING_PROFILE"));

            var authentication =
                    new UsernamePasswordAuthenticationToken(principal, token, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (ApiException exception) {
            SecurityContextHolder.clearContext();
            response.setStatus(exception.code().status().value());
            response.setContentType("application/json;charset=UTF-8");
            objectMapper.writeValue(
                    response.getOutputStream(),
                    ApiErrorResponse.of(exception.code(), exception.getMessage(), null));
            return;
        }

        chain.doFilter(request, response);
    }
}
