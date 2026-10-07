package app.pixme.security;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

/**
 * Injects the authenticated {@link AuthPrincipal} into a controller method.
 *
 * <p>A thin alias over {@code @AuthenticationPrincipal} so controller
 * signatures read as product code ({@code @CurrentUser AuthPrincipal me})
 * rather than as Spring Security plumbing.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@AuthenticationPrincipal
public @interface CurrentUser {}
