package app.pixme.connection;

import java.util.UUID;

import app.pixme.connection.domain.Connection;

/**
 * Notification hook for the two connection events.
 *
 * <p>Note what is <em>not</em> here: there is no "someone waved at you, here is
 * who" notification carrying the sender's identity. A one-sided wave is
 * announced only as an anonymous nudge, because revealing the sender before
 * mutual consent would make declining socially costly.
 */
public interface ConnectionNotifier {

    void onConnectionRequested(UUID fromUserId, UUID toUserId);

    void onConnected(Connection connection, UUID conversationId);
}
