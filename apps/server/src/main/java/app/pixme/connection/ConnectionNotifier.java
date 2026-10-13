package app.pixme.connection;

import java.util.UUID;

import app.pixme.connection.domain.Connection;

/**
 * Notification hook for connection events.
 *
 * <p>Note what is <em>not</em> here: there is no "someone waved at you"
 * notification at all, not even an anonymous one. Revealing a wave by push —
 * who, how many, or just "someone" — would turn a light, reversible gesture
 * into a social event the recipient has to react to. Instead, a sender's card
 * is surfaced higher in the recipient's own feed ({@code FeedRanker}), so the
 * only way to learn about a wave is to happen to see it there, the same way
 * you'd notice anything else about today's PIXMEs.
 */
public interface ConnectionNotifier {

    void onConnected(Connection connection, UUID conversationId);
}
