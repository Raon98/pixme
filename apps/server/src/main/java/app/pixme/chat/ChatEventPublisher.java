package app.pixme.chat;

import java.time.Instant;
import java.util.UUID;

import app.pixme.chat.domain.Message;

/**
 * Fan-out hook for realtime delivery and push.
 *
 * <p>An interface so {@link ChatService} stays free of WebSocket and push
 * concerns: the socket layer and the notification service both implement it,
 * and neither is required for chat to be correct — REST polling alone still
 * works.
 */
public interface ChatEventPublisher {

    void onMessageSent(Message message, UUID senderId, UUID recipientId);

    void onRead(UUID conversationId, UUID notifyUserId, UUID lastMessageId, Instant readAt);

    void onConversationDeactivated(UUID conversationId, UUID userId, UUID peerId);
}
