package app.pixme.chat.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A 1:1 conversation, created only when a connection becomes mutual.
 *
 * <p>One-to-one with {@code connections} (unique index on {@code connection_id})
 * so there is exactly one thread per pair — and so a conversation can never
 * exist without the mutual consent that justifies it.
 */
@Entity
@Table(name = "conversations")
@Getter
@Setter
@NoArgsConstructor
public class Conversation {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "connection_id", nullable = false)
    private UUID connectionId;

    @Column(name = "last_message_at")
    private Instant lastMessageAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static Conversation forConnection(UUID connectionId) {
        Conversation conversation = new Conversation();
        conversation.id = UUID.randomUUID();
        conversation.connectionId = connectionId;
        conversation.createdAt = Instant.now();
        return conversation;
    }
}
