package app.pixme.connection;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.chat.ChatService;
import app.pixme.chat.domain.Conversation;
import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.common.RateLimiter;
import app.pixme.common.ServiceClock;
import app.pixme.common.TextSanitizer;
import app.pixme.config.PixmeProperties;
import app.pixme.connection.domain.Connection;
import app.pixme.connection.domain.ConnectionRequest;
import app.pixme.connection.domain.ConnectionRequestStatus;
import app.pixme.connection.repository.ConnectionRepository;
import app.pixme.connection.repository.ConnectionRequestRepository;
import app.pixme.safety.repository.BlockRepository;
import app.pixme.store.StoreService;
import app.pixme.user.MasterAccountService;
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
    private final StoreService storeService;
    private final MasterAccountService masterAccountService;
    private final ServiceClock clock;
    private final TextSanitizer sanitizer;
    private final ConnectionWriter connectionWriter;

    public ConnectionService(
            ConnectionRequestRepository requestRepository,
            ConnectionRepository connectionRepository,
            UserRepository userRepository,
            UserStatsRepository statsRepository,
            BlockRepository blockRepository,
            ChatService chatService,
            RateLimiter rateLimiter,
            PixmeProperties properties,
            ConnectionNotifier notifier,
            StoreService storeService,
            MasterAccountService masterAccountService,
            ServiceClock clock,
            TextSanitizer sanitizer,
            ConnectionWriter connectionWriter) {
        this.requestRepository = requestRepository;
        this.connectionRepository = connectionRepository;
        this.userRepository = userRepository;
        this.statsRepository = statsRepository;
        this.blockRepository = blockRepository;
        this.chatService = chatService;
        this.rateLimiter = rateLimiter;
        this.properties = properties;
        this.notifier = notifier;
        this.storeService = storeService;
        this.masterAccountService = masterAccountService;
        this.clock = clock;
        this.sanitizer = sanitizer;
        this.connectionWriter = connectionWriter;
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
    public RequestResult request(
            UUID fromUserId, UUID toUserId, UUID sourceDailyStatusId, String message) {
        if (fromUserId.equals(toUserId)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "자신에게는 보낼 수 없어요.");
        }

        String sanitizedMessage =
                message == null || message.isBlank()
                        ? null
                        : sanitizer.sanitizeFreeText(message, 140, "메시지");

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

        boolean mineWasPending = mine.isPresent() && mine.get().isPending();

        if (!mineWasPending) {
            // Every other branch below either returns early (idempotent) or
            // is this user's own tap newly spending today's allowance — so
            // the quota gate sits here, once, rather than duplicated in both
            // the mutual-match and one-sided branches.
            requireDailyWaveQuota(fromUserId);
        }

        // Mutual: both sides have now waved.
        if (theirs.isPresent() && theirs.get().isPending()) {
            ConnectionRequest incoming = theirs.get();
            boolean outgoingIsNew = mine.isEmpty();
            ConnectionRequest outgoing = mine.orElseGet(() ->
                    ConnectionRequest.create(fromUserId, toUserId, sourceDailyStatusId, null));
            if (outgoingIsNew) {
                outgoing.setMessage(sanitizedMessage);
            }

            incoming.setStatus(ConnectionRequestStatus.CONNECTED);
            outgoing.setStatus(ConnectionRequestStatus.CONNECTED);
            requestRepository.save(incoming);
            requestRepository.save(outgoing);

            Connection connection = createConnection(fromUserId, toUserId);
            // In the order the waves actually happened, so a reply reads
            // after the original rather than the two talking past each other.
            List<ChatService.OpeningNote> notes = incoming.getCreatedAt().isBefore(outgoing.getCreatedAt())
                    ? List.of(
                            new ChatService.OpeningNote(incoming.getFromUserId(), incoming.getMessage()),
                            new ChatService.OpeningNote(outgoing.getFromUserId(), outgoing.getMessage()))
                    : List.of(
                            new ChatService.OpeningNote(outgoing.getFromUserId(), outgoing.getMessage()),
                            new ChatService.OpeningNote(incoming.getFromUserId(), incoming.getMessage()));
            Conversation conversation = chatService.createForConnection(connection, notes);

            bumpConnectionCount(fromUserId);
            bumpConnectionCount(toUserId);

            notifier.onConnected(connection, conversation.getId());
            log.info("connection created between {} and {}", fromUserId, toUserId);

            return new RequestResult(RelationStatus.CONNECTED, connection, conversation.getId());
        }

        if (mineWasPending) {
            // Already waved; idempotent.
            return new RequestResult(RelationStatus.REQUESTED_BY_ME, null, null);
        }

        ConnectionRequest request = mine.map(existing -> {
                    existing.setStatus(ConnectionRequestStatus.REQUESTED);
                    existing.setSourceDailyStatusId(sourceDailyStatusId);
                    existing.setMessage(sanitizedMessage);
                    return existing;
                })
                .orElseGet(() -> ConnectionRequest.create(
                        fromUserId, toUserId, sourceDailyStatusId, sanitizedMessage));
        requestRepository.save(request);

        // No notification here, deliberately — see ConnectionNotifier. The
        // recipient learns about this wave only by seeing the sender's card
        // surfaced in their own feed (FeedRanker), never through a push.
        return new RequestResult(RelationStatus.REQUESTED_BY_ME, null, null);
    }

    /**
     * The real scarcity control (see {@link PixmeProperties.Connection}).
     * {@code connectPerHour} above is flood protection, not this — it is high
     * enough that a normal user never notices it; this is low enough that
     * they do, and PIXME+ raising it is the point.
     */
    private void requireDailyWaveQuota(UUID fromUserId) {
        if (masterAccountService.isMaster(fromUserId)) {
            return;
        }
        int limit = storeService.isPlusActive(fromUserId)
                ? properties.connection().plusWavesPerDay()
                : properties.connection().freeWavesPerDay();
        Instant startOfToday = clock.today().atStartOfDay(clock.zone()).toInstant();
        long sentToday = requestRepository.countByFromUserIdAndCreatedAtAfter(fromUserId, startOfToday);
        if (sentToday >= limit) {
            throw new ApiException(ErrorCode.DAILY_WAVE_LIMIT);
        }
    }

    /**
     * Connects two accounts directly — no waves, no quota, no notification
     * check. Exists for exactly one caller, {@code ReservedSignupService}:
     * two reserved identities that should already know each other the
     * moment both have signed up. Idempotent, the same way the mutual-match
     * path is — a connection that already exists between the two is left
     * alone rather than duplicated.
     */
    @Transactional
    public Connection connectDirectly(UUID userA, UUID userB) {
        Optional<Connection> existing = findConnection(userA, userB);
        if (existing.isPresent() && existing.get().isActive()) {
            chatService.createForConnection(existing.get());
            return existing.get();
        }

        Connection connection = createConnection(userA, userB);
        Conversation conversation = chatService.createForConnection(connection);
        bumpConnectionCount(userA);
        bumpConnectionCount(userB);
        notifier.onConnected(connection, conversation.getId());
        log.info("directly connected {} and {} (reserved signup)", userA, userB);
        return connection;
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
     * Gets the connection for this pair, inserting one if this is genuinely
     * their first time or reviving the existing row if they connected and
     * later ended it (unblock, un-severing) — the unique index is on the
     * (userA, userB) pair forever, not on "their currently active
     * connection", so a second match can never insert a second row for the
     * same two people.
     *
     * <p>Also tolerates the race where both users' requests complete
     * simultaneously: the unique index rejects the loser's insert, which
     * then simply reads the winner's row.
     */
    private Connection createConnection(UUID first, UUID second) {
        Optional<Connection> existing = findConnection(first, second);
        if (existing.isPresent()) {
            Connection connection = existing.get();
            if (!connection.isActive()) {
                connection.revive();
                connectionRepository.save(connection);
            }
            return connection;
        }

        try {
            return connectionWriter.insert(Connection.between(first, second));
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
