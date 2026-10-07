package app.pixme.config;

import app.pixme.chat.ws.ChatWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Registers the chat socket at {@code /ws/chat}.
 *
 * <p>Authentication is handled inside the handler from a query parameter rather
 * than by a handshake interceptor, because React Native's WebSocket cannot send
 * headers — see {@link ChatWebSocketHandler}. Origins are left open because the
 * client is a native app with no browser origin; the token is the only
 * credential that matters.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final ChatWebSocketHandler chatHandler;

    public WebSocketConfig(ChatWebSocketHandler chatHandler) {
        this.chatHandler = chatHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(chatHandler, "/ws/chat").setAllowedOriginPatterns("*");
    }
}
