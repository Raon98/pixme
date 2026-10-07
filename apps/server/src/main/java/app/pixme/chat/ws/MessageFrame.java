package app.pixme.chat.ws;

import java.time.Instant;

import app.pixme.chat.domain.Message;

/**
 * Wire shape of a message on the socket.
 *
 * <p>Defined here rather than reusing the REST assembler's DTO on purpose: the
 * socket layer must not depend on the API layer. It previously did, which
 * created a dependency cycle (assembler → connection → chat → socket →
 * assembler). Keeping the realtime payload self-contained also means a change
 * to a REST response can't silently change the socket protocol.
 */
public record MessageFrame(
        String id,
        String conversationId,
        String senderId,
        String type,
        String content,
        Instant createdAt,
        Instant readAt) {

    public static MessageFrame of(Message message) {
        return new MessageFrame(
                message.getId().toString(),
                message.getConversationId().toString(),
                message.getSenderId() == null ? null : message.getSenderId().toString(),
                message.getType().name(),
                message.getContent(),
                message.getCreatedAt(),
                message.getReadAt());
    }
}
