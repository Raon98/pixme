package app.pixme.chat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.chat.domain.Conversation;
import app.pixme.chat.domain.ConversationMember;
import app.pixme.chat.domain.Message;
import app.pixme.chat.repository.ConversationMemberRepository;
import app.pixme.chat.repository.ConversationRepository;
import app.pixme.chat.repository.MessageRepository;
import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.common.RateLimiter;
import app.pixme.common.TextSanitizer;
import app.pixme.config.PixmeProperties;
import app.pixme.connection.domain.Connection;
import app.pixme.connection.repository.ConnectionRepository;
import app.pixme.safety.repository.BlockRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 1:1 chat.
 *
 * <p>Access control is structural rather than a check sprinkled at call sites:
 * a conversation only exists for an active {@link Connection}, and every read
 * and write goes through {@link #requireMembership}. There is no code path that
 * can produce a chat between two people who did not both wave.
 */
@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private static final String SYSTEM_OPENER =
            "PIXME에서 서로 친해지고 싶다는 마음이 통했어요.";

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository memberRepository;
    private final MessageRepository messageRepository;
    private final ConnectionRepository connectionRepository;
    private final BlockRepository blockRepository;
    private final TextSanitizer sanitizer;
    private final RateLimiter rateLimiter;
    private final PixmeProperties properties;
    /** Realtime socket and push both listen; order is irrelevant. */
    private final List<ChatEventPublisher> eventPublishers;
    private final MessageWriter messageWriter;

    public ChatService(
            ConversationRepository conversationRepository,
            ConversationMemberRepository memberRepository,
            MessageRepository messageRepository,
            ConnectionRepository connectionRepository,
            BlockRepository blockRepository,
            TextSanitizer sanitizer,
            RateLimiter rateLimiter,
            PixmeProperties properties,
            List<ChatEventPublisher> eventPublishers,
            MessageWriter messageWriter) {
        this.conversationRepository = conversationRepository;
        this.memberRepository = memberRepository;
        this.messageRepository = messageRepository;
        this.connectionRepository = connectionRepository;
        this.blockRepository = blockRepository;
        this.sanitizer = sanitizer;
        this.rateLimiter = rateLimiter;
        this.properties = properties;
        this.eventPublishers = eventPublishers;
        this.messageWriter = messageWriter;
    }

    /* ------------------------------------------------------------- create */

    /** A wave's attached note, already sanitized, in the order the waves happened. */
    public record OpeningNote(UUID senderId, String message) {}

    /**
     * Creates the conversation for a freshly mutual connection, with the system
     * opener already in place so the thread is never an empty room.
     *
     * <p>Idempotent on {@code connectionId}, which matters because two
     * simultaneous waves can both observe the mutual condition.
     */
    @Transactional
    public Conversation createForConnection(Connection connection) {
        return createForConnection(connection, List.of());
    }

    /**
     * Same as {@link #createForConnection(Connection)}, plus whichever side(s)
     * attached a one-line note to their wave — each becomes a real opening
     * message from its sender, right after the system line, instead of a
     * thread that starts blank.
     */
    @Transactional
    public Conversation createForConnection(Connection connection, List<OpeningNote> notes) {
        Optional<Conversation> existing =
                conversationRepository.findByConnectionId(connection.getId());
        if (existing.isPresent()) {
            return existing.get();
        }

        Conversation conversation = Conversation.forConnection(connection.getId());
        conversationRepository.save(conversation);

        memberRepository.save(new ConversationMember(conversation.getId(), connection.getUserAId()));
        memberRepository.save(new ConversationMember(conversation.getId(), connection.getUserBId()));

        Message opener = Message.system(conversation.getId(), SYSTEM_OPENER);
        messageRepository.save(opener);
        Instant lastMessageAt = opener.getCreatedAt();

        for (OpeningNote note : notes) {
            if (note.message() == null || note.message().isBlank()) {
                continue;
            }
            Message noteMessage =
                    Message.text(conversation.getId(), note.senderId(), note.message(), null);
            messageRepository.save(noteMessage);
            lastMessageAt = noteMessage.getCreatedAt();
        }

        conversation.setLastMessageAt(lastMessageAt);
        conversationRepository.save(conversation);

        return conversation;
    }

    /* --------------------------------------------------------------- read */

    @Transactional(readOnly = true)
    public List<Conversation> conversationsOf(UUID userId) {
        return conversationRepository.findForUser(userId);
    }

    @Transactional(readOnly = true)
    public Conversation getConversation(UUID userId, UUID conversationId) {
        requireMembership(userId, conversationId);
        return conversationRepository
                .findById(conversationId)
                .orElseThrow(() -> ApiException.notFound("대화"));
    }

    @Transactional(readOnly = true)
    public List<Message> messages(
            UUID userId, UUID conversationId, Instant cursorAt, UUID cursorId, int limit) {
        requireMembership(userId, conversationId);
        // An absent cursor means "newest first", expressed as an open upper
        // bound rather than a null parameter — see Cursors.OPEN_TIMESTAMP.
        return messageRepository.findPage(
                conversationId,
                cursorAt == null ? app.pixme.common.Cursors.OPEN_TIMESTAMP : cursorAt,
                cursorId == null ? app.pixme.common.Cursors.OPEN_ID : cursorId,
                PageRequest.of(0, limit));
    }

    @Transactional(readOnly = true)
    public List<Message> latestMessages(List<UUID> conversationIds) {
        return conversationIds.isEmpty()
                ? List.of()
                : messageRepository.findLatestForConversations(conversationIds);
    }

    @Transactional(readOnly = true)
    public List<ConversationMember> membersOf(List<UUID> conversationIds) {
        return conversationIds.isEmpty()
                ? List.of()
                : memberRepository.findByConversationIds(conversationIds);
    }

    @Transactional(readOnly = true)
    public long unreadTotal(UUID userId) {
        return memberRepository.sumUnread(userId);
    }

    /** True when the peer blocked us or left — the composer is disabled. */
    @Transactional(readOnly = true)
    public boolean isInactive(UUID userId, UUID conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId).orElse(null);
        if (conversation == null) {
            return true;
        }
        Connection connection =
                connectionRepository.findById(conversation.getConnectionId()).orElse(null);
        if (connection == null || !connection.isActive()) {
            return true;
        }
        UUID peerId = connection.peerOf(userId);
        return blockRepository.existsBetween(userId, peerId);
    }

    /* --------------------------------------------------------------- send */

    /**
     * Sends a text message.
     *
     * <p>Idempotent on {@code clientMessageId}: if the same id is already
     * stored, the existing message is returned instead of a duplicate. That is
     * what lets the client optimistically send over the socket and fall back to
     * REST without risking two bubbles.
     */
    @Transactional
    public Message send(UUID senderId, UUID conversationId, String rawContent, String clientMessageId) {
        rateLimiter.check(
                "message",
                senderId,
                properties.rateLimit().messagePerMinute(),
                Duration.ofMinutes(1));

        requireMembership(senderId, conversationId);

        if (clientMessageId != null) {
            Optional<Message> duplicate = messageRepository.findByConversationIdAndClientMessageId(
                    conversationId, clientMessageId);
            if (duplicate.isPresent()) {
                return duplicate.get();
            }
        }

        Conversation conversation = conversationRepository
                .findById(conversationId)
                .orElseThrow(() -> ApiException.notFound("대화"));

        Connection connection = connectionRepository
                .findById(conversation.getConnectionId())
                .orElseThrow(() -> new ApiException(ErrorCode.CONVERSATION_INACTIVE));

        if (!connection.isActive()) {
            throw new ApiException(ErrorCode.CONVERSATION_INACTIVE);
        }

        UUID peerId = connection.peerOf(senderId);
        if (blockRepository.existsBetween(senderId, peerId)) {
            throw new ApiException(ErrorCode.CONVERSATION_INACTIVE);
        }

        String content = sanitizer.sanitizeMessage(rawContent);
        Message message = Message.text(conversationId, senderId, content, clientMessageId);

        final Message inserted = insertOrFindWinner(message, conversationId, clientMessageId);
        conversation.setLastMessageAt(inserted.getCreatedAt());
        conversationRepository.save(conversation);

        memberRepository
                .findPeer(conversationId, senderId)
                .ifPresent(peer -> {
                    peer.incrementUnread();
                    memberRepository.save(peer);
                });

        eventPublishers.forEach(publisher -> publisher.onMessageSent(inserted, senderId, peerId));
        return inserted;
    }

    /**
     * In its own transaction on purpose — see {@link MessageWriter}. The
     * client deliberately sends every message over both the socket and REST;
     * whichever lands first wins, idempotent on {@code clientMessageId}, so a
     * lost race here is the expected outcome, not an exceptional one.
     */
    private Message insertOrFindWinner(Message message, UUID conversationId, String clientMessageId) {
        try {
            return messageWriter.insert(message);
        } catch (DataIntegrityViolationException exception) {
            if (clientMessageId == null) {
                throw exception;
            }
            return messageRepository
                    .findByConversationIdAndClientMessageId(conversationId, clientMessageId)
                    .orElseThrow(() -> exception);
        }
    }

    /* --------------------------------------------------------------- read */

    @Transactional
    public void markRead(UUID userId, UUID conversationId, UUID lastMessageId) {
        requireMembership(userId, conversationId);

        Message last = messageRepository.findById(lastMessageId).orElse(null);
        if (last == null || !last.getConversationId().equals(conversationId)) {
            return;
        }

        memberRepository
                .findById(new ConversationMember.Key(conversationId, userId))
                .ifPresent(member -> {
                    member.markRead(lastMessageId);
                    memberRepository.save(member);
                });

        Instant readAt = Instant.now();
        messageRepository.markReadUpTo(conversationId, userId, last.getCreatedAt(), readAt);

        Conversation conversation = conversationRepository.findById(conversationId).orElse(null);
        if (conversation != null) {
            connectionRepository
                    .findById(conversation.getConnectionId())
                    .ifPresent(connection -> eventPublishers.forEach(publisher ->
                            publisher.onRead(
                                    conversationId,
                                    connection.peerOf(userId),
                                    lastMessageId,
                                    readAt)));
        }
    }

    /* --------------------------------------------------------- lifecycle */

    /**
     * Ends every conversation between two users. Called when either blocks the
     * other, or when an account is deleted.
     */
    @Transactional
    public void deactivateBetween(UUID userId, UUID peerId) {
        connectionRepository
                .findBetween(userId, List.of(peerId))
                .forEach(connection -> conversationRepository
                        .findByConnectionId(connection.getId())
                        .ifPresent(conversation -> {
                            eventPublishers.forEach(publisher -> publisher.onConversationDeactivated(
                                    conversation.getId(), userId, peerId));
                            log.info("deactivated conversation={} after block", conversation.getId());
                        }));
    }

    /** Hard-deletes message content for an account being purged. */
    @Transactional
    public void purgeForUser(UUID userId) {
        conversationRepository.findForUser(userId).forEach(conversation -> {
            messageRepository.softDeleteByConversation(conversation.getId(), Instant.now());
            memberRepository
                    .findById(new ConversationMember.Key(conversation.getId(), userId))
                    .ifPresent(member -> {
                        member.setLeftAt(Instant.now());
                        memberRepository.save(member);
                    });
        });
    }

    /* ------------------------------------------------------------ helpers */

    public UUID peerIdOf(UUID userId, UUID conversationId) {
        Conversation conversation = conversationRepository
                .findById(conversationId)
                .orElseThrow(() -> ApiException.notFound("대화"));
        return connectionRepository
                .findById(conversation.getConnectionId())
                .map(connection -> connection.peerOf(userId))
                .orElseThrow(() -> ApiException.notFound("대화 상대"));
    }

    /** The single gate every chat operation passes through. */
    private void requireMembership(UUID userId, UUID conversationId) {
        boolean member = memberRepository
                .findById(new ConversationMember.Key(conversationId, userId))
                .filter(entry -> !entry.hasLeft())
                .isPresent();
        if (!member) {
            throw new ApiException(ErrorCode.NOT_CONNECTED);
        }
    }
}
