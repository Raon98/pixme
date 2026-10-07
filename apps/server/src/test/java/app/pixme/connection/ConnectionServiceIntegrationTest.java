package app.pixme.connection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import app.pixme.chat.ChatService;
import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.safety.SafetyService;
import app.pixme.support.IntegrationTest;
import app.pixme.support.TestFixtures;
import app.pixme.user.UserService;
import app.pixme.user.domain.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The relationship model: a wave reveals nothing until it is returned, and the
 * moment it is, a conversation exists.
 */
@IntegrationTest
class ConnectionServiceIntegrationTest {

    @Autowired
    private ConnectionService connectionService;

    @Autowired
    private ChatService chatService;

    @Autowired
    private SafetyService safetyService;

    @Autowired
    private UserService userService;

    @Autowired
    private TestFixtures fixtures;

    @Test
    @DisplayName("한쪽만 보낸 👋 는 REQUESTED 로 남고 상대에게는 아무것도 생기지 않는다")
    void oneSidedWaveStaysPending() {
        User sender = fixtures.activeUser("sendr");
        User target = fixtures.activeUser("targt");

        ConnectionService.RequestResult result =
                connectionService.request(sender.getId(), target.getId(), null);

        assertThat(result.status()).isEqualTo(ConnectionService.RelationStatus.REQUESTED_BY_ME);
        assertThat(result.connection()).isNull();

        // The recipient sees "someone", never a queue naming the sender.
        assertThat(connectionService.relationStatus(target.getId(), sender.getId()))
                .isEqualTo(ConnectionService.RelationStatus.REQUESTED_BY_THEM);
        assertThat(chatService.conversationsOf(target.getId())).isEmpty();
    }

    @Test
    @DisplayName("서로 👋 가 통하면 연결되고 대화가 즉시 만들어진다")
    void mutualWaveCreatesConnectionAndConversation() {
        User first = fixtures.activeUser("mutu1");
        User second = fixtures.activeUser("mutu2");

        connectionService.request(first.getId(), second.getId(), null);
        ConnectionService.RequestResult result =
                connectionService.request(second.getId(), first.getId(), null);

        assertThat(result.status()).isEqualTo(ConnectionService.RelationStatus.CONNECTED);
        assertThat(result.connection()).isNotNull();
        assertThat(result.conversationId()).isNotNull();

        assertThat(chatService.conversationsOf(first.getId())).hasSize(1);
        assertThat(chatService.conversationsOf(second.getId())).hasSize(1);

        // The thread opens with the system message, never as an empty room.
        var messages = chatService.messages(
                first.getId(), result.conversationId(), null, null, 10);
        assertThat(messages).hasSize(1);
        assertThat(messages.get(0).getContent()).contains("마음이 통했어요");

        assertThat(userService.statsOf(first.getId()).getConnectionCount()).isEqualTo(1);
        assertThat(userService.statsOf(second.getId()).getConnectionCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("👋 를 두 번 보내도 상태는 그대로다")
    void repeatedWaveIsIdempotent() {
        User sender = fixtures.activeUser("twice");
        User target = fixtures.activeUser("quiet");

        connectionService.request(sender.getId(), target.getId(), null);
        ConnectionService.RequestResult second =
                connectionService.request(sender.getId(), target.getId(), null);

        assertThat(second.status()).isEqualTo(ConnectionService.RelationStatus.REQUESTED_BY_ME);
        assertThat(second.connection()).isNull();
    }

    @Test
    @DisplayName("자기 자신에게는 보낼 수 없다")
    void cannotWaveAtSelf() {
        User user = fixtures.activeUser("self");

        assertThatThrownBy(() ->
                        connectionService.request(user.getId(), user.getId(), null))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("차단된 사이에는 👋 를 보낼 수 없다")
    void cannotWaveAcrossABlock() {
        User blocker = fixtures.activeUser("blokr");
        User blocked = fixtures.activeUser("blokd");

        safetyService.block(blocker.getId(), blocked.getId());

        // Both directions, so the blocked party cannot infer the block by
        // succeeding where the blocker failed.
        assertThatThrownBy(() ->
                        connectionService.request(blocker.getId(), blocked.getId(), null))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.BLOCKED_BY_PEER);

        assertThatThrownBy(() ->
                        connectionService.request(blocked.getId(), blocker.getId(), null))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.BLOCKED_BY_PEER);
    }

    @Test
    @DisplayName("차단하면 연결이 끊기고 대화도 비활성화된다")
    void blockingSeversAnExistingConnection() {
        User first = fixtures.activeUser("sevr1");
        User second = fixtures.activeUser("sevr2");

        connectionService.request(first.getId(), second.getId(), null);
        var result = connectionService.request(second.getId(), first.getId(), null);
        var conversationId = result.conversationId();

        safetyService.block(first.getId(), second.getId());

        assertThat(connectionService.relationStatus(first.getId(), second.getId()))
                .isEqualTo(ConnectionService.RelationStatus.BLOCKED);
        assertThat(connectionService.activeConnections(first.getId())).isEmpty();
        assertThat(chatService.isInactive(first.getId(), conversationId)).isTrue();

        // And the thread is read-only from here on.
        assertThatThrownBy(() -> chatService.send(
                        first.getId(), conversationId, "안녕", "client-1"))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.CONVERSATION_INACTIVE);
    }

    @Test
    @DisplayName("👋 를 취소하면 대기 상태가 사라진다")
    void cancellingClearsPendingState() {
        User sender = fixtures.activeUser("cancl");
        User target = fixtures.activeUser("recvr");

        connectionService.request(sender.getId(), target.getId(), null);
        connectionService.cancel(sender.getId(), target.getId());

        assertThat(connectionService.relationStatus(sender.getId(), target.getId()))
                .isEqualTo(ConnectionService.RelationStatus.NONE);
        assertThat(connectionService.relationStatus(target.getId(), sender.getId()))
                .isEqualTo(ConnectionService.RelationStatus.NONE);
    }

    @Test
    @DisplayName("연결되지 않은 사람에게는 메시지를 보낼 수 없다")
    void cannotMessageWithoutAConnection() {
        User first = fixtures.activeUser("nomsg");
        User second = fixtures.activeUser("nomsg2");

        connectionService.request(first.getId(), second.getId(), null);
        var connected = connectionService.request(second.getId(), first.getId(), null);

        User outsider = fixtures.activeUser("outsd");

        assertThatThrownBy(() -> chatService.send(
                        outsider.getId(), connected.conversationId(), "끼어들기", "c1"))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.NOT_CONNECTED);
    }

    @Test
    @DisplayName("메시지는 clientMessageId 로 중복 없이 저장된다")
    void messageSendIsIdempotentOnClientId() {
        User first = fixtures.activeUser("dup1");
        User second = fixtures.activeUser("dup2");

        connectionService.request(first.getId(), second.getId(), null);
        var connected = connectionService.request(second.getId(), first.getId(), null);

        var firstSend = chatService.send(
                first.getId(), connected.conversationId(), "안녕!", "client-abc");
        var retried = chatService.send(
                first.getId(), connected.conversationId(), "안녕!", "client-abc");

        assertThat(retried.getId()).isEqualTo(firstSend.getId());

        // One system opener + one text message.
        assertThat(chatService.messages(
                        first.getId(), connected.conversationId(), null, null, 10))
                .hasSize(2);
    }

    @Test
    @DisplayName("읽음 처리는 상대의 안 읽은 수를 0으로 만든다")
    void markReadClearsUnreadCount() {
        User sender = fixtures.activeUser("read1");
        User reader = fixtures.activeUser("read2");

        connectionService.request(sender.getId(), reader.getId(), null);
        var connected = connectionService.request(reader.getId(), sender.getId(), null);

        var message = chatService.send(
                sender.getId(), connected.conversationId(), "자니?", "client-xyz");

        assertThat(chatService.unreadTotal(reader.getId())).isEqualTo(1);

        chatService.markRead(reader.getId(), connected.conversationId(), message.getId());

        assertThat(chatService.unreadTotal(reader.getId())).isZero();
        assertThat(chatService.unreadTotal(sender.getId())).isZero();
    }

    @Test
    @DisplayName("연결 축하 화면은 한 번만 보여주면 된다")
    void acknowledgementIsPerUser() {
        User first = fixtures.activeUser("ack1");
        User second = fixtures.activeUser("ack2");

        connectionService.request(first.getId(), second.getId(), null);
        var result = connectionService.request(second.getId(), first.getId(), null);
        var connection = result.connection();

        assertThat(connection.isAcknowledgedBy(first.getId())).isFalse();
        connectionService.acknowledge(first.getId(), connection.getId());

        List<app.pixme.connection.domain.Connection> connections =
                connectionService.activeConnections(first.getId());
        assertThat(connections).hasSize(1);
        assertThat(connections.get(0).isAcknowledgedBy(first.getId())).isTrue();
        // The other side still has their own celebration to see.
        assertThat(connections.get(0).isAcknowledgedBy(second.getId())).isFalse();
    }
}
