package app.pixme.chat.ws;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import app.pixme.chat.ChatService;
import app.pixme.common.ApiException;
import app.pixme.security.AuthPrincipal;
import app.pixme.security.JwtService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * The chat socket.
 *
 * <p>Plain JSON frames rather than STOMP: the realtime surface is one feature
 * with a handful of frame types, so a broker protocol would add a dependency
 * and a handshake for no benefit.
 *
 * <p>Authentication happens in the handshake query string because React
 * Native's {@code WebSocket} cannot set an {@code Authorization} header. The
 * token is a short-lived access token, the URL is never logged, and an invalid
 * token closes the socket immediately rather than leaving it half-open.
 */
@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);

    private static final String ATTRIBUTE_USER_ID = "pixme.userId";

    private final JwtService jwtService;
    private final ChatService chatService;
    private final ChatSessionRegistry registry;
    private final ObjectMapper objectMapper;

    public ChatWebSocketHandler(
            JwtService jwtService,
            ChatService chatService,
            ChatSessionRegistry registry,
            ObjectMapper objectMapper) {
        this.jwtService = jwtService;
        this.chatService = chatService;
        this.registry = registry;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String token = extractToken(session.getUri());
        if (token == null) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("missing token"));
            return;
        }

        AuthPrincipal principal;
        try {
            principal = jwtService.verifyAccessToken(token);
        } catch (ApiException exception) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("invalid token"));
            return;
        }

        if (!principal.profileCompleted()) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("profile incomplete"));
            return;
        }

        session.getAttributes().put(ATTRIBUTE_USER_ID, principal.userId());
        registry.register(principal.userId(), session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message)
            throws Exception {

        UUID userId = (UUID) session.getAttributes().get(ATTRIBUTE_USER_ID);
        if (userId == null) {
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }

        JsonNode frame;
        try {
            frame = objectMapper.readTree(message.getPayload());
        } catch (Exception exception) {
            sendError(session, "BAD_FRAME", "알 수 없는 메시지 형식이에요.");
            return;
        }

        String type = frame.path("type").asText("");
        JsonNode payload = frame.path("payload");

        switch (type) {
            case "PING" -> send(session, Map.of("type", "PONG"));

            case "SEND" -> handleSend(session, userId, payload);

            case "READ" -> handleRead(userId, payload);

            // Subscription is implicit — a user receives frames for all of
            // their conversations — so this is accepted and ignored for
            // forward compatibility with a future multi-room model.
            case "SUBSCRIBE" -> {}

            default -> sendError(session, "UNKNOWN_TYPE", "지원하지 않는 요청이에요.");
        }
    }

    private void handleSend(WebSocketSession session, UUID userId, JsonNode payload) {
        try {
            UUID conversationId = UUID.fromString(payload.path("conversationId").asText());
            String clientMessageId = payload.path("clientMessageId").asText(null);
            String content = payload.path("content").asText("");

            var message = chatService.send(userId, conversationId, content, clientMessageId);

            // ACK carries the canonical message so the client can reconcile its
            // optimistic bubble with the real id.
            send(session, Map.of(
                    "type", "ACK",
                    "payload", Map.of(
                            "clientMessageId", clientMessageId == null ? "" : clientMessageId,
                            "message", MessageFrame.of(message))));

        } catch (ApiException exception) {
            sendError(session, exception.code().name(), exception.getMessage());
        } catch (RuntimeException exception) {
            log.warn("socket send failed for user={}", userId, exception);
            sendError(session, "INTERNAL_ERROR", "메시지를 보내지 못했어요.");
        }
    }

    private void handleRead(UUID userId, JsonNode payload) {
        try {
            UUID conversationId = UUID.fromString(payload.path("conversationId").asText());
            UUID lastMessageId = UUID.fromString(payload.path("lastMessageId").asText());
            chatService.markRead(userId, conversationId, lastMessageId);
        } catch (RuntimeException exception) {
            log.debug("socket read-receipt ignored: {}", exception.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        UUID userId = (UUID) session.getAttributes().get(ATTRIBUTE_USER_ID);
        if (userId != null) {
            registry.unregister(userId, session);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception)
            throws Exception {
        log.debug("socket transport error: {}", exception.getMessage());
        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    /* ------------------------------------------------------------ helpers */

    private String extractToken(URI uri) {
        if (uri == null || uri.getQuery() == null) {
            return null;
        }
        for (String parameter : uri.getQuery().split("&")) {
            List<String> parts = List.of(parameter.split("=", 2));
            if (parts.size() == 2 && "token".equals(parts.get(0))) {
                return java.net.URLDecoder.decode(
                        parts.get(1), java.nio.charset.StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    private void send(WebSocketSession session, Object frame) {
        try {
            synchronized (session) {
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(frame)));
            }
        } catch (Exception exception) {
            log.debug("could not write socket frame", exception);
        }
    }

    private void sendError(WebSocketSession session, String code, String message) {
        send(session, Map.of("type", "ERROR", "payload", Map.of("code", code, "message", message)));
    }
}
