package app.pixme.chat.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.chat.domain.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    Optional<Conversation> findByConnectionId(UUID connectionId);

    /**
     * The user's conversation list, newest activity first. Conversations with
     * no messages yet sort by creation, which is what puts brand-new
     * connections at the top of the "새로운 연결" rail.
     */
    @Query("""
            select c from Conversation c, ConversationMember m
            where m.key.conversationId = c.id
              and m.key.userId = :userId
              and m.leftAt is null
            order by coalesce(c.lastMessageAt, c.createdAt) desc
            """)
    List<Conversation> findForUser(@Param("userId") UUID userId);
}
