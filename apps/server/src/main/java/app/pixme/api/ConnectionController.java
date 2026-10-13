package app.pixme.api;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import app.pixme.api.dto.SocialDtos;
import app.pixme.chat.ChatService;
import app.pixme.connection.ConnectionService;
import app.pixme.connection.domain.Connection;
import app.pixme.security.AuthPrincipal;
import app.pixme.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class ConnectionController {

    private final ConnectionService connectionService;
    private final ChatService chatService;
    private final ResponseAssembler assembler;

    public ConnectionController(
            ConnectionService connectionService,
            ChatService chatService,
            ResponseAssembler assembler) {
        this.connectionService = connectionService;
        this.chatService = chatService;
        this.assembler = assembler;
    }

    @PostMapping("/users/{userId}/connect")
    public SocialDtos.ConnectResponse connect(
            @CurrentUser AuthPrincipal principal,
            @PathVariable UUID userId,
            @RequestParam(required = false) UUID sourceDailyStatusId,
            @RequestParam(required = false) String message) {

        ConnectionService.RequestResult result =
                connectionService.request(principal.userId(), userId, sourceDailyStatusId, message);

        return new SocialDtos.ConnectResponse(
                result.status().name(),
                result.connection() == null
                        ? null
                        : toResponse(principal.userId(), result.connection(), result.conversationId()));
    }

    @DeleteMapping("/users/{userId}/connect")
    public SocialDtos.ConnectResponse cancel(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID userId) {
        ConnectionService.RequestResult result =
                connectionService.cancel(principal.userId(), userId);
        return new SocialDtos.ConnectResponse(result.status().name(), null);
    }

    @GetMapping("/connections")
    public SocialDtos.ConnectionListResponse list(@CurrentUser AuthPrincipal principal) {
        List<SocialDtos.ConnectionResponse> connections = new ArrayList<>();

        for (Connection connection : connectionService.activeConnections(principal.userId())) {
            UUID conversationId = chatService.createForConnection(connection).getId();
            connections.add(toResponse(principal.userId(), connection, conversationId));
        }

        // `pendingIncoming` is intentionally always empty: a one-sided wave is
        // never revealed to the recipient. The field exists so the client
        // contract stays stable if that product decision is ever revisited.
        return new SocialDtos.ConnectionListResponse(List.of(), connections);
    }

    @PostMapping("/connections/{connectionId}/acknowledge")
    public ResponseEntity<Void> acknowledge(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID connectionId) {
        connectionService.acknowledge(principal.userId(), connectionId);
        return ResponseEntity.noContent().build();
    }

    private SocialDtos.ConnectionResponse toResponse(
            UUID viewerId, Connection connection, UUID conversationId) {
        UUID peerId = connection.peerOf(viewerId);
        return new SocialDtos.ConnectionResponse(
                connection.getId().toString(),
                assembler.author(viewerId, peerId),
                conversationId == null ? null : conversationId.toString(),
                connection.getConnectedAt(),
                connection.isAcknowledgedBy(viewerId));
    }
}
