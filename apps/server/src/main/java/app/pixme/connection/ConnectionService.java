package app.pixme.connection;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.chat.ChatService;
import app.pixme.chat.domain.Conversation;
import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.common.RateLimiter;
import app.pixme.config.PixmeProperties;
import app.pixme.connection.domain.Connection;
import app.pixme.connection.domain.ConnectionRequest;
import app.pixme.connection.domain.ConnectionRequestStatus;
import app.pixme.connection.repository.ConnectionRepository;
import app.pixme.connection.repository.ConnectionRequestRepository;
import app.pixme.safety.repository.BlockRepository;
import app.pixme.user.domain.User;
import app.pixme.user.domain.UserStats;
import app.pixme.user.repository.UserRepository;
import app.pixme.user.repository.UserStatsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "👋 친해지고 싶어요" and the mutual connection it can become.
 *
 * <p>The asymmetry is the product: a one-sided wave reveals nothing to the
 * recipient — there is no inbox of pending requests to triage, because that
 * would turn a light gesture into an obligation and leak who is interested in
 * whom. Only when both sides have waved does anything become visible, and at
 * that moment the conversation is created atomically with the connection.
 */
@Service
public class ConnectionService {

    private static final Logger log = LoggerFactory.getLogger(ConnectionService.class);

    private final ConnectionRequestRepository requestRepository;
    private final ConnectionRepository connectionRepository;
    private final UserRepository userRepository;
    private final UserStatsRepository statsRepository;
    private final BlockRepository blockRepository;
    private final ChatService chatService;
    private final RateLimiter rateLimiter;
    private final PixmeProperties properties;
    private final ConnectionNotifier notifier;

    public ConnectionService(
            ConnectionRequestRepository requestRepository,
            ConnectionRepository connectionRepository,
            UserRepository userRepository,
            UserStatsRepository statsRepository,
            BlockRepository blockRepository,
            ChatService chatService,
            RateLimiter rateLimiter,
            PixmeProperties properties,
            ConnectionNotifier notifier) {
        this.requestRepository = requestRepository;
        this.connectionRepository = connectionRepository;
        this.userRepository = userRepository;
        this.statsRepository = statsRepository;
        this.blockRepository = blockRepository;
        this.chatService = chatService;
        this.rateLimiter = rateLimiter;
        this.properties = properties;
        this.notifier = notifier;
    }

    /** Relationship between the viewer and someone else, as the client sees it. */
    public enum RelationStatus {
        NONE,
        REQUESTED_BY_ME,
        REQUESTED_BY_THEM,
        CONNECTED,
        BLOCKED
    }

    public record RequestResult(RelationStatus status, Connection connection, UUID conversationId) {}

    /* ------------------------------------------------------------ request */

    @Transactional
    public RequestResult request(UUID fromUserId, UUID toUserId, UUID sourceDailyStatusId) {
        if (fromUserId.equals(toUserId)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "자신에게는 보낼 수 없어요.");
        }

        rateLimiter.check(
                "connect", fromUserId, properties.rateLimit().connectPerHour(), Duration.ofHours(1));

        if (blockRepository.existsBetween(fromUserId, toUserId)) {
            throw new ApiException(ErrorCode.BLOCKED_BY_PEER);
        }

        User target = userRepository
                .findActiveById(toUserId)
                .orElseThrow(() -> ApiException.notFound("사용자"));
        if (!target.isActive()) {
            throw new ApiException(ErrorCode.BLOCKED_BY_PEER);
        }

        // Already connected? Return the existing thread instead of erroring —
        // the client uses this to jump straight into the conversation.
        Optional<Connection> existingConnection = findConnection(fromUserId, toUserId);
        if (existingConnection.isPresent() && existingConnection.get().isActive()) {
            Conversation conversation = chatService.createForConnection(existingConnection.get());
            return new RequestResult(
                    RelationStatus.CONNECTED, existingConnection.get(), conversation.getId());
        }

        Optional<ConnectionRequest> mine =
                requestRepository.findByFromUserIdAndToUserId(fromUserId, toUserId);
        Optional<ConnectionRequest> theirs =
                requestRepository.findByFromUserIdAndToUserId(toUserId, fromUserId);

        // Mutual: both sides have now waved.
        if (theirs.isPresent() && theirs.get().isPending()) {
            ConnectionRequest incoming = theirs.get();
            ConnectionRequest outgoing = mine.orElseGet(
                    () -> ConnectionRequest.create(fromUserId, toUserId, sourceDailyStatusId));

            incoming.setStatus(ConnectionRequestStatus.CONNECTED);
            outgoing.setStatus(ConnectionRequestStatus.CONNECTED);
            requestRepository.save(incoming);
            requestRepository.save(outgoing);

            Connection connection = createConnection(fromUserId, toUserId);
            Conversation conversation = chatService.createForConnection(connection);

            bumpConnectionCount(fromUserId);
            bumpConnectionCount(toUserId);

            notifier.onConnected(connection, conversation.getId());
            log.info("connection created between {} and {}", fromUserId, toUserId);

            return new RequestResult(RelationStatus.CONNECTED, connection, conversation.getId());
        }

        if (mine.isPresent() && mine.get().isPending()) {
            // Already waved; idempotent.
            return new RequestResult(RelationStatus.REQUESTED_BY_ME, null, null);
        }

        ConnectionRequest request = mine.map(existing -> {
                    existing.setStatus(ConnectionRequestStatus.REQUESTED);
                    existing.setSourceDailyStatusId(sourceDailyStatusId);
                    return existing;
                })
                .orElseGet(() -> ConnectionRequest.create(fromUserId, toUserId, sourceDailyStatusId));
        requestRepository.save(request);

        notifier.onConnectionRequested(fromUserId, toUserId);
        return new RequestResult(RelationStatus.REQUESTED_BY_ME, null, null);
    }

    @Transactional
    public RequestResult cancel(UUID fromUserId, UUID toUserId) {
        requestRepository
                .findByFromUserIdAndToUserId(fromUserId, toUserId)
                .filter(ConnectionRequest::isPending)
                .ifPresent(request -> {
                    request.setStatus(ConnectionRequestStatus.CANCELLED);
                    requestRepository.save(request);
                });
        return new RequestResult(relationStatus(fromUserId, toUserId), null, null);
    }

    /* --------------------------------------------------------------- read */

    @Transactional(readOnly = true)
    public RelationStatus relationStatus(UUID viewerId, UUID otherId) {
        if (viewerId.equals(otherId)) {
            return RelationStatus.NONE;
        }
        if (blockRepository.existsBetween(viewerId, otherId)) {
            return RelationStatus.BLOCKED;
        }
        if (findConnection(viewerId, otherId).filter(Connection::isActive).isPresent()) {
            return RelationStatus.CONNECTED;
        }
        if (requestRepository
                .findByFromUserIdAndToUserId(viewerId, otherId)
                .filter(ConnectionRequest::isPending)
                .isPresent()) {
            return RelationStatus.REQUESTED_BY_ME;
        }
        if (requestRepository
                .findByFromUserIdAndToUserId(otherId, viewerId)
                .filter(ConnectionRequest::isPending)
                .isPresent()) {
            return RelationStatus.REQUESTED_BY_THEM;
        }
        return RelationStatus.NONE;
    }

    @Transactional(readOnly = true)
    public List<Connection> activeConnections(UUID userId) {
        return connectionRepository.findActiveFor(userId);
    }

    @Transactional(readOnly = true)
    public List<UUID> peerIds(UUID userId) {
        return connectionRepository.findPeerIds(userId);
    }

    @Transactional
    public void acknowledge(UUID userId, UUID connectionId) {
        connectionRepository
                .findById(connectionId)
                .filter(connection -> connection.involves(userId))
                .ifPresent(connection -> {
                    connection.acknowledge(userId);
                    connectionRepository.save(connection);
                });
    }

    /* ---------------------------------------------------------- lifecycle */

    /**
     * Ends the connection between two users and shuts down their conversation.
     * Called when either side blocks, and when an account is deleted.
     */
    @Transactional
    public void sever(UUID userId, UUID peerId) {
        findConnection(userId, peerId).ifPresent(connection -> {
            if (connection.isActive()) {
                connection.end();
                connectionRepository.save(connection);
                adjustConnectionCount(userId, -1);
                adjustConnectionCount(peerId, -1);
            }
        });

        requestRepository
                .findByFromUserIdAndToUserId(userId, peerId)
                .ifPresent(request -> {
                    request.setStatus(ConnectionRequestStatus.BLOCKED);
                    requestRepository.save(request);
                });
        requestRepository
                .findByFromUserIdAndToUserId(peerId, userId)
                .ifPresent(request -> {
                    request.setStatus(ConnectionRequestStatus.BLOCKED);
                    requestRepository.save(request);
                });

        chatService.deactivateBetween(userId, peerId);
    }

    /* ------------------------------------------------------------ helpers */

    /** Looks up a pair using the same canonical ordering the table enforces. */
    private Optional<Connection> findConnection(UUID first, UUID second) {
        boolean firstIsLower = Connection.compareUuids(first, second) < 0;
        UUID a = firstIsLower ? first : second;
        UUID b = firstIsLower ? second : first;
        return connectionRepository.findByUserAIdAndUserBId(a, b);
    }

    /**
     * Inserts the connection, tolerating the race where both users' requests
     * complete simultaneously — the unique index on the ordered pair rejects
     * the loser, which then simply reads the winner's row.
     */
    private Connection createConnection(UUID first, UUID second) {
        try {
            return connectionRepository.saveAndFlush(Connection.between(first, second));
        } catch (DataIntegrityViolationException exception) {
            return findConnection(first, second)
                    .orElseThrow(() -> new ApiException(ErrorCode.INTERNAL_ERROR));
        }
    }

    private void bumpConnectionCount(UUID userId) {
        adjustConnectionCount(userId, 1);
    }

    private void adjustConnectionCount(UUID userId, int delta) {
        UserStats stats = statsRepository
                .findById(userId)
                .orElseGet(() -> statsRepository.save(UserStats.createFor(userId)));
        stats.addConnections(delta);
        statsRepository.save(stats);
    }
}
