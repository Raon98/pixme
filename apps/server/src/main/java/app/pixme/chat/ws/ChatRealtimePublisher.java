package app.pixme.chat.ws;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import app.pixme.chat.ChatEventPublisher;
import app.pixme.chat.domain.Message;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Pushes chat events to connected sockets.
 *
 * <p>Best-effort: if the recipient has no live socket, nothing happens here and
 * the push notification plus their next fetch cover it. That is why REST stays
 * the source of truth — a dropped frame can never mean a lost message.
 */
@Component
public class ChatRealtimePublisher implements ChatEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(ChatRealtimePublisher.class);

    private final ChatSessionRegistry registry;
    private final ObjectMapper objectMapper;

    public ChatRealtimePublisher(ChatSessionRegistry registry, ObjectMapper objectMapper) {
        this.registry = registry;
        this.objectMapper = objectMapper;
    }

    @Override
    public void onMessageSent(Message message, UUID senderId, UUID recipientId) {
        emit(recipientId, Map.of("type", "MESSAGE", "payload", MessageFrame.of(message)));
    }

    @Override
    public void onRead(UUID conversationId, UUID notifyUserId, UUID lastMessageId, Instant readAt) {
        emit(notifyUserId, Map.of(
                "type", "READ",
                "payload", Map.of(
                        "conversationId", conversationId.toString(),
                        "lastMessageId", lastMessageId.toString(),
                        "readAt", readAt.toString())));
    }

    @Override
    public void onConversationDeactivated(UUID conversationId, UUID userId, UUID peerId) {
        Map<String, Object> frame = Map.of(
                "type", "CONVERSATION_UPDATED",
                "payload", Map.of(
                        "conversationId", conversationId.toString(), "inactive", true));
        emit(userId, frame);
        emit(peerId, frame);
    }

    private void emit(UUID userId, Object frame) {
        if (userId == null || !registry.isOnline(userId)) {
            return;
        }
        try {
            registry.send(userId, objectMapper.writeValueAsString(frame));
        } catch (Exception exception) {
            log.debug("could not serialise socket frame", exception);
        }
    }
}
