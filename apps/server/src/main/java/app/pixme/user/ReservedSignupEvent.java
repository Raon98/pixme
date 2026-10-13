package app.pixme.user;

import java.util.UUID;

/**
 * Published when an account has become eligible for a reserved assignment —
 * either it was just created, or an email finally arrived for one that had
 * none.
 *
 * <p>An event rather than a direct call so that the work is bound to <em>after
 * commit</em>. The seeded character and subscription rows carry foreign keys to
 * {@code users.id}; applying them from inside the sign-up transaction means the
 * insert is validated against a user row no other transaction can see yet, and
 * the whole assignment fails a constraint check for reasons that have nothing
 * to do with the assignment itself.
 */
public record ReservedSignupEvent(UUID userId) {}
