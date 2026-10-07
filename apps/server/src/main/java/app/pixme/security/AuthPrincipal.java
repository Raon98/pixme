package app.pixme.security;

import java.util.UUID;

/**
 * The authenticated caller.
 *
 * <p>{@code profileCompleted} is carried in the token so that the "finish your
 * profile first" gate costs no database read on every request. It is refreshed
 * whenever the access token is reissued.
 */
public record AuthPrincipal(UUID userId, boolean profileCompleted) {}
