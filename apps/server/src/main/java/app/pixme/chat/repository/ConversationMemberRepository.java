package app.pixme.chat.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.chat.domain.ConversationMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConversationMemberRepository
        extends JpaRepository<ConversationMember, ConversationMember.Key> {

    List<ConversationMember> findByKeyConversationId(UUID conversationId);

    @Query("""
            select m from ConversationMember m
            where m.key.conversationId in :conversationIds
            """)
    List<ConversationMember> findByConversationIds(
            @Param("conversationIds") Collection<UUID> conversationIds);

    @Query("""
            select m from ConversationMember m
            where m.key.conversationId = :conversationId and m.key.userId <> :userId
            """)
    Optional<ConversationMember> findPeer(
            @Param("conversationId") UUID conversationId, @Param("userId") UUID userId);

    /** Total unread across all conversations — the chat tab badge. */
    @Query("""
            select coalesce(sum(m.unreadCount), 0) from ConversationMember m
            where m.key.userId = :userId and m.leftAt is null
            """)
    long sumUnread(@Param("userId") UUID userId);
}
