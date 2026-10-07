package app.pixme.api.dto;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class SocialDtos {

    private SocialDtos() {}

    /* -------------------------------------------------------- connection */

    public record ConnectResponse(String status, ConnectionResponse connection) {}

    public record ConnectionResponse(
            String id,
            PixelDtos.AuthorResponse peer,
            String conversationId,
            Instant connectedAt,
            boolean acknowledged) {}

    public record ConnectionListResponse(
            List<PendingConnectionResponse> pendingIncoming, List<ConnectionResponse> connections) {}

    public record PendingConnectionResponse(
            String userId, String nickname, String characterImageUrl, Instant requestedAt) {}

    /* --------------------------------------------------------------- chat */

    public record ConversationResponse(
            String id,
            PixelDtos.AuthorResponse peer,
            MessageResponse lastMessage,
            int unreadCount,
            Instant lastMessageAt,
            Instant createdAt,
            boolean inactive) {}

    public record MessageResponse(
            String id,
            String conversationId,
            String senderId,
            String type,
            String content,
            Instant createdAt,
            Instant readAt) {}

    public record SendMessageRequest(
            @NotBlank String clientMessageId,
            String type,
            @NotBlank @Size(max = 2000) String content) {}

    public record MarkReadRequest(@NotBlank String lastMessageId) {}

    /* ------------------------------------------------------ notifications */

    public record NotificationResponse(
            String id,
            String type,
            String title,
            String body,
            String imageUrl,
            String deepLink,
            Instant readAt,
            Instant createdAt) {}

    public record NotificationBadgeResponse(
            long unreadNotifications, long unreadMessages, long pendingConnections) {}

    /* ------------------------------------------------------------- safety */

    public record CreateReportRequest(
            @NotBlank String targetType,
            @NotBlank String targetId,
            @NotBlank String reason,
            @Size(max = 500) String detail,
            boolean alsoBlock) {}
}
