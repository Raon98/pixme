package app.pixme.auth.provider;

import app.pixme.user.domain.AuthProvider;

/**
 * The minimum we accept from an identity provider.
 *
 * <p>Deliberately minimal: a stable id, and optionally an email. PIXME does no
 * identity verification and has no use for a legal name, phone number or
 * birth date from the provider — the user supplies a nickname and a birth date
 * themselves. Collecting less is both the privacy position and less to leak.
 */
public record SocialIdentity(
        AuthProvider provider, String providerUserId, String email, String displayName) {}
