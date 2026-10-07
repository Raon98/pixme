package app.pixme.api;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import app.pixme.api.dto.SocialDtos;
import app.pixme.chat.ChatService;
import app.pixme.common.CursorPage;
import app.pixme.common.Cursors;
import app.pixme.notification.NotificationService;
import app.pixme.notification.domain.Notification;
import app.pixme.security.AuthPrincipal;
import app.pixme.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final ChatService chatService;
    private final ResponseAssembler assembler;

    public NotificationController(
            NotificationService notificationService,
            ChatService chatService,
            ResponseAssembler assembler) {
        this.notificationService = notificationService;
        this.chatService = chatService;
        this.assembler = assembler;
    }

    @GetMapping
    public CursorPage<SocialDtos.NotificationResponse> list(
            @CurrentUser AuthPrincipal principal,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "30") int limit) {

        int capped = Math.min(Math.max(limit, 1), 60);
        List<Notification> notifications =
                notificationService.page(principal.userId(), cursor, capped + 1);

        boolean hasMore = notifications.size() > capped;
        List<Notification> page = hasMore ? notifications.subList(0, capped) : notifications;

        String nextCursor = hasMore && !page.isEmpty()
                ? Cursors.encode(
                        page.get(page.size() - 1).getCreatedAt(), page.get(page.size() - 1).getId())
                : null;

        List<SocialDtos.NotificationResponse> responses = new ArrayList<>(page.size());
        page.forEach(notification -> responses.add(assembler.notification(notification)));

        return CursorPage.of(responses, nextCursor);
    }

    /**
     * Badge counts for the tab bar.
     *
     * <p>`pendingConnections` is always zero by design — one-sided waves are
     * never surfaced as a queue. The field exists so the client contract does
     * not change if that product decision is revisited.
     */
    @GetMapping("/badge")
    public SocialDtos.NotificationBadgeResponse badge(@CurrentUser AuthPrincipal principal) {
        return new SocialDtos.NotificationBadgeResponse(
                notificationService.unreadCount(principal.userId()),
                chatService.unreadTotal(principal.userId()),
                0);
    }

    @PostMapping("/{notificationId}/read")
    public ResponseEntity<Void> markRead(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID notificationId) {
        notificationService.markRead(principal.userId(), notificationId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(@CurrentUser AuthPrincipal principal) {
        notificationService.markAllRead(principal.userId());
        return ResponseEntity.noContent().build();
    }
}
