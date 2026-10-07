package app.pixme.chat.ws;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

/**
 * In-memory map of user → open sockets.
 *
 * <p>Single-node by design for v1. The socket is a latency optimisation layered
 * on a REST source of truth, so a user connected to another instance simply
 * misses the instant push and picks the message up on their next poll or push
 * notification — degraded, not broken. Scaling out means putting a Redis
 * pub/sub fan-out behind this class, and nothing else changes.
 *
 * <p>A user may have several sockets (phone + reconnect in flight), so sends
 * iterate all of them and prune the dead ones.
 */
@Component
public class ChatSessionRegistry {

    private static final Logger log = LoggerFactory.getLogger(ChatSessionRegistry.class);

    private final Map<UUID, Set<WebSocketSession>> sessionsByUser = new ConcurrentHashMap<>();

    public void register(UUID userId, WebSocketSession session) {
        sessionsByUser
                .computeIfAbsent(userId, key -> ConcurrentHashMap.newKeySet())
                .add(session);
    }

    public void unregister(UUID userId, WebSocketSession session) {
        Set<WebSocketSession> sessions = sessionsByUser.get(userId);
        if (sessions == null) {
            return;
        }
        sessions.remove(session);
        if (sessions.isEmpty()) {
            sessionsByUser.remove(userId);
        }
    }

    public boolean isOnline(UUID userId) {
        Set<WebSocketSession> sessions = sessionsByUser.get(userId);
        return sessions != null && !sessions.isEmpty();
    }

    /** Sends to every live socket for a user. Dead sockets are pruned. */
    public void send(UUID userId, String payload) {
        Set<WebSocketSession> sessions = sessionsByUser.get(userId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        for (WebSocketSession session : sessions) {
            if (!session.isOpen()) {
                sessions.remove(session);
                continue;
            }
            try {
                // `sendMessage` is not thread-safe; a per-session monitor is
                // enough because fan-out is the only writer.
                synchronized (session) {
                    session.sendMessage(new TextMessage(payload));
                }
            } catch (IOException | IllegalStateException exception) {
                log.debug("dropping broken socket for user={}", userId);
                sessions.remove(session);
            }
        }
    }

    public int connectionCount() {
        return sessionsByUser.values().stream().mapToInt(Set::size).sum();
    }
}
