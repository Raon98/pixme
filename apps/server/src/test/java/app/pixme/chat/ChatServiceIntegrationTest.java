package app.pixme.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import app.pixme.chat.domain.Conversation;
import app.pixme.connection.ConnectionService;
import app.pixme.support.IntegrationTest;
import app.pixme.support.TestFixtures;
import app.pixme.user.domain.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The client sends every chat message over the socket and REST at once —
 * whichever lands first wins, idempotent on {@code clientMessageId}. This
 * pins that the server actually survives the race rather than 500ing one of
 * the two requests (see {@link MessageWriter}).
 */
@IntegrationTest
class ChatServiceIntegrationTest {

    @Autowired
    private ChatService chatService;

    @Autowired
    private ConnectionService connectionService;

    @Autowired
    private TestFixtures fixtures;

    @Test
    @DisplayName("같은 clientMessageId로 동시에 보내도 메시지는 하나만 저장되고 둘 다 같은 결과를 받는다")
    void concurrentSendWithSameClientMessageIdIsIdempotent() throws InterruptedException {
        User first = fixtures.activeUser("race1");
        User second = fixtures.activeUser("race2");

        connectionService.request(first.getId(), second.getId(), null, null);
        ConnectionService.RequestResult result =
                connectionService.request(second.getId(), first.getId(), null, null);
        Conversation conversation = chatService.getConversation(first.getId(), result.conversationId());

        String clientMessageId = UUID.randomUUID().toString();
        int attempts = 8;
        ExecutorService pool = Executors.newFixedThreadPool(attempts);
        CountDownLatch ready = new CountDownLatch(attempts);
        CountDownLatch go = new CountDownLatch(1);
        List<Exception> failures = new java.util.concurrent.CopyOnWriteArrayList<>();
        List<String> resultIds = new java.util.concurrent.CopyOnWriteArrayList<>();

        for (int i = 0; i < attempts; i++) {
            pool.submit(() -> {
                ready.countDown();
                try {
                    go.await();
                    var message = chatService.send(
                            first.getId(), conversation.getId(), "같은 메시지", clientMessageId);
                    resultIds.add(message.getId().toString());
                } catch (Exception exception) {
                    failures.add(exception);
                }
            });
        }

        ready.await(5, TimeUnit.SECONDS);
        go.countDown();
        pool.shutdown();
        assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

        assertThat(failures).as("no request should 500 on the race").isEmpty();
        assertThat(resultIds).as("every racer agrees on the same winning message id")
                .hasSize(attempts)
                .containsOnly(resultIds.get(0));

        var messages = chatService.messages(first.getId(), conversation.getId(), null, null, 20);
        long matching = messages.stream()
                .filter(message -> clientMessageId.equals(message.getClientMessageId()))
                .count();
        assertThat(matching).as("exactly one row made it into the table").isEqualTo(1);
    }
}
