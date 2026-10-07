package app.pixme.chat.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "messages")
@Getter
@Setter
@NoArgsConstructor
public class Message {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    /** Null for SYSTEM messages. */
    @Column(name = "sender_id")
    private UUID senderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 16)
    private MessageType type = MessageType.TEXT;

    @Column(name = "content", nullable = false, length = 2000)
    private String content;

    /**
     * Client-generated id, unique per conversation. This is what makes sending
     * idempotent across the two delivery paths (WebSocket fast path, REST
     * fallback) — a reconnect mid-send cannot duplicate a bubble.
     */
    @Column(name = "client_message_id", length = 64)
    private String clientMessageId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public static Message text(
            UUID conversationId, UUID senderId, String content, String clientMessageId) {
        Message message = new Message();
        message.id = UUID.randomUUID();
        message.conversationId = conversationId;
        message.senderId = senderId;
        message.type = MessageType.TEXT;
        message.content = content;
        message.clientMessageId = clientMessageId;
        message.createdAt = Instant.now();
        return message;
    }

    public static Message system(UUID conversationId, String content) {
        Message message = new Message();
        message.id = UUID.randomUUID();
        message.conversationId = conversationId;
        message.type = MessageType.SYSTEM;
        message.content = content;
        message.createdAt = Instant.now();
        return message;
    }

    public void markRead() {
        if (this.readAt == null) {
            this.readAt = Instant.now();
        }
    }
}
