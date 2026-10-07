package app.pixme.api;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import app.pixme.api.dto.SocialDtos;
import app.pixme.chat.ChatService;
import app.pixme.chat.domain.Conversation;
import app.pixme.chat.domain.ConversationMember;
import app.pixme.chat.domain.Message;
import app.pixme.common.CursorPage;
import app.pixme.common.Cursors;
import app.pixme.security.AuthPrincipal;
import app.pixme.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Chat over REST.
 *
 * <p>The WebSocket is the fast path, but every operation is also available
 * here: a socket that cannot connect (captive portal, background restriction,
 * flaky network) must degrade to a working chat rather than a broken one.
 */
@RestController
@RequestMapping("/api/v1/conversations")
public class ChatController {

    private final ChatService chatService;
    private final ResponseAssembler assembler;

    public ChatController(ChatService chatService, ResponseAssembler assembler) {
        this.chatService = chatService;
        this.assembler = assembler;
    }

    @GetMapping
    public List<SocialDtos.ConversationResponse> conversations(
            @CurrentUser AuthPrincipal principal) {

        List<Conversation> conversations = chatService.conversationsOf(principal.userId());
        if (conversations.isEmpty()) {
            return List.of();
        }

        List<UUID> ids = conversations.stream().map(Conversation::getId).toList();

        Map<UUID, Message> lastMessages = new HashMap<>();
        chatService.latestMessages(ids)
                .forEach(message -> lastMessages.put(message.getConversationId(), message));

        Map<UUID, Integer> unread = new HashMap<>();
        for (ConversationMember member : chatService.membersOf(ids)) {
            if (member.getUserId().equals(principal.userId())) {
                unread.put(member.getConversationId(), member.getUnreadCount());
            }
        }

        List<SocialDtos.ConversationResponse> responses = new ArrayList<>(conversations.size());
        for (Conversation conversation : conversations) {
            UUID peerId = chatService.peerIdOf(principal.userId(), conversation.getId());
            Message last = lastMessages.get(conversation.getId());

            responses.add(new SocialDtos.ConversationResponse(
                    conversation.getId().toString(),
                    assembler.author(principal.userId(), peerId),
                    last == null ? null : assembler.message(last),
                    unread.getOrDefault(conversation.getId(), 0),
                    conversation.getLastMessageAt(),
                    conversation.getCreatedAt(),
                    chatService.isInactive(principal.userId(), conversation.getId())));
        }
        return responses;
    }

    @GetMapping("/{conversationId}")
    public SocialDtos.ConversationResponse conversation(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID conversationId) {

        Conversation conversation =
                chatService.getConversation(principal.userId(), conversationId);
        UUID peerId = chatService.peerIdOf(principal.userId(), conversationId);

        List<Message> latest = chatService.latestMessages(List.of(conversationId));
        int unread = chatService.membersOf(List.of(conversationId)).stream()
                .filter(member -> member.getUserId().equals(principal.userId()))
                .mapToInt(ConversationMember::getUnreadCount)
                .findFirst()
                .orElse(0);

        return new SocialDtos.ConversationResponse(
                conversation.getId().toString(),
                assembler.author(principal.userId(), peerId),
                latest.isEmpty() ? null : assembler.message(latest.get(0)),
                unread,
                conversation.getLastMessageAt(),
                conversation.getCreatedAt(),
                chatService.isInactive(principal.userId(), conversationId));
    }

    @GetMapping("/{conversationId}/messages")
    public CursorPage<SocialDtos.MessageResponse> messages(
            @CurrentUser AuthPrincipal principal,
            @PathVariable UUID conversationId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "40") int limit) {

        int capped = Math.min(Math.max(limit, 1), 100);
        Cursors.Keyset keyset = Cursors.decode(cursor);

        List<Message> messages = chatService.messages(
                principal.userId(),
                conversationId,
                keyset == null ? null : keyset.timestamp(),
                keyset == null ? null : keyset.id(),
                capped + 1);

        boolean hasMore = messages.size() > capped;
        List<Message> page = hasMore ? messages.subList(0, capped) : messages;

        String nextCursor = hasMore && !page.isEmpty()
                ? Cursors.encode(
                        page.get(page.size() - 1).getCreatedAt(), page.get(page.size() - 1).getId())
                : null;

        List<SocialDtos.MessageResponse> responses = new ArrayList<>(page.size());
        page.forEach(message -> responses.add(assembler.message(message)));

        return CursorPage.of(responses, nextCursor);
    }

    @PostMapping("/{conversationId}/messages")
    public SocialDtos.MessageResponse send(
            @CurrentUser AuthPrincipal principal,
            @PathVariable UUID conversationId,
            @Valid @RequestBody SocialDtos.SendMessageRequest request) {

        Message message = chatService.send(
                principal.userId(), conversationId, request.content(), request.clientMessageId());
        return assembler.message(message);
    }

    @PostMapping("/{conversationId}/read")
    public ResponseEntity<Void> markRead(
            @CurrentUser AuthPrincipal principal,
            @PathVariable UUID conversationId,
            @Valid @RequestBody SocialDtos.MarkReadRequest request) {

        chatService.markRead(
                principal.userId(), conversationId, UUID.fromString(request.lastMessageId()));
        return ResponseEntity.noContent().build();
    }
}
