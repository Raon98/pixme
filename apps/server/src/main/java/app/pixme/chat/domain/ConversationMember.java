package app.pixme.chat.domain;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Per-participant conversation state.
 *
 * <p>{@code unreadCount} lives here rather than being derived from messages:
 * the chat list and the tab badge read it on every poll, and counting unread
 * rows per conversation on each read would be the most expensive query in the
 * app.
 */
@Entity
@Table(name = "conversation_members")
@Getter
@Setter
@NoArgsConstructor
public class ConversationMember {

    @EmbeddedId
    private Key key;

    @Column(name = "last_read_message_id")
    private UUID lastReadMessageId;

    @Column(name = "last_read_at")
    private Instant lastReadAt;

    @Column(name = "unread_count", nullable = false)
    private int unreadCount;

    @Column(name = "muted", nullable = false)
    private boolean muted;

    @Column(name = "left_at")
    private Instant leftAt;

    public ConversationMember(UUID conversationId, UUID userId) {
        this.key = new Key(conversationId, userId);
    }

    public UUID getConversationId() {
        return key.getConversationId();
    }

    public UUID getUserId() {
        return key.getUserId();
    }

    public void markRead(UUID lastMessageId) {
        this.lastReadMessageId = lastMessageId;
        this.lastReadAt = Instant.now();
        this.unreadCount = 0;
    }

    public void incrementUnread() {
        this.unreadCount += 1;
    }

    public boolean hasLeft() {
        return leftAt != null;
    }

    @Embeddable
    @Getter
    @NoArgsConstructor
    public static class Key implements Serializable {

        @Column(name = "conversation_id", nullable = false)
        private UUID conversationId;

        @Column(name = "user_id", nullable = false)
        private UUID userId;

        public Key(UUID conversationId, UUID userId) {
            this.conversationId = conversationId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Key key)) {
                return false;
            }
            return Objects.equals(conversationId, key.conversationId)
                    && Objects.equals(userId, key.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(conversationId, userId);
        }
    }
}
