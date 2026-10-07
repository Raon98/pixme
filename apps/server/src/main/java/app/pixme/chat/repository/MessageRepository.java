package app.pixme.chat.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.chat.domain.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    Optional<Message> findByConversationIdAndClientMessageId(
            UUID conversationId, String clientMessageId);

    /** Newest-first keyset page; the UI renders inverted. */
    @Query("""
            select m from Message m
            where m.conversationId = :conversationId
              and m.deletedAt is null
              and (m.createdAt < :cursorCreatedAt
                   or (m.createdAt = :cursorCreatedAt and m.id < :cursorId))
            order by m.createdAt desc, m.id desc
            """)
    List<Message> findPage(
            @Param("conversationId") UUID conversationId,
            @Param("cursorCreatedAt") Instant cursorCreatedAt,
            @Param("cursorId") UUID cursorId,
            Pageable pageable);

    /**
     * Last message per conversation, batched for the chat list.
     *
     * <p>Native because {@code DISTINCT ON} has no JPQL equivalent and the
     * portable alternatives are worse: a correlated subquery per conversation
     * is N+1, and {@code max(id)} is wrong here because ids are UUIDs, not
     * monotonic — "latest" must be decided by {@code created_at}.
     */
    @Query(
            value = """
                    select distinct on (conversation_id) *
                    from messages
                    where conversation_id in (:conversationIds)
                      and deleted_at is null
                    order by conversation_id, created_at desc, id desc
                    """,
            nativeQuery = true)
    List<Message> findLatestForConversations(
            @Param("conversationIds") Collection<UUID> conversationIds);

    @Modifying
    @Query("""
            update Message m set m.readAt = :readAt
            where m.conversationId = :conversationId
              and m.senderId <> :readerId
              and m.readAt is null
              and m.createdAt <= :upTo
            """)
    int markReadUpTo(
            @Param("conversationId") UUID conversationId,
            @Param("readerId") UUID readerId,
            @Param("upTo") Instant upTo,
            @Param("readAt") Instant readAt);

    @Modifying
    @Query("update Message m set m.deletedAt = :now where m.conversationId = :conversationId")
    void softDeleteByConversation(
            @Param("conversationId") UUID conversationId, @Param("now") Instant now);
}
