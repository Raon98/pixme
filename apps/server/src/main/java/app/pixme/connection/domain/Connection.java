package app.pixme.connection.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A mutual connection.
 *
 * <p>Stored with the two ids in a canonical order ({@code userA < userB}) and a
 * unique index on the pair. Without the ordering, A→B and B→A could both insert
 * and a pair would end up with two connections and two conversations; the
 * database constraint makes that impossible rather than merely unlikely.
 */
@Entity
@Table(name = "connections")
@Getter
@Setter
@NoArgsConstructor
public class Connection {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_a_id", nullable = false)
    private UUID userAId;

    @Column(name = "user_b_id", nullable = false)
    private UUID userBId;

    @Column(name = "connected_at", nullable = false)
    private Instant connectedAt = Instant.now();

    /** Whether each side has seen the celebration screen. */
    @Column(name = "a_acknowledged", nullable = false)
    private boolean aAcknowledged;

    @Column(name = "b_acknowledged", nullable = false)
    private boolean bAcknowledged;

    @Column(name = "ended_at")
    private Instant endedAt;

    public static Connection between(UUID first, UUID second) {
        Connection connection = new Connection();
        connection.id = UUID.randomUUID();
        // Canonical ordering — see the class comment and `compareUuids`.
        if (compareUuids(first, second) < 0) {
            connection.userAId = first;
            connection.userBId = second;
        } else {
            connection.userAId = second;
            connection.userBId = first;
        }
        connection.connectedAt = Instant.now();
        return connection;
    }

    /**
     * Orders two UUIDs the way Postgres does.
     *
     * <p>This must not use {@link UUID#compareTo}: Java compares the two halves
     * as <em>signed</em> longs, while Postgres compares the 16 bytes as
     * unsigned. For any UUID with the high bit set the two orders disagree,
     * which would produce rows violating the {@code connections_ordered} CHECK
     * constraint about half the time — and, worse, let the same pair slip past
     * the unique index in two different orders.
     */
    public static int compareUuids(UUID first, UUID second) {
        int high = Long.compareUnsigned(
                first.getMostSignificantBits(), second.getMostSignificantBits());
        return high != 0
                ? high
                : Long.compareUnsigned(
                        first.getLeastSignificantBits(), second.getLeastSignificantBits());
    }

    public UUID peerOf(UUID userId) {
        return userAId.equals(userId) ? userBId : userAId;
    }

    public boolean involves(UUID userId) {
        return userAId.equals(userId) || userBId.equals(userId);
    }

    public boolean isAcknowledgedBy(UUID userId) {
        return userAId.equals(userId) ? aAcknowledged : bAcknowledged;
    }

    public void acknowledge(UUID userId) {
        if (userAId.equals(userId)) {
            this.aAcknowledged = true;
        } else if (userBId.equals(userId)) {
            this.bAcknowledged = true;
        }
    }

    public boolean isActive() {
        return endedAt == null;
    }

    public void end() {
        this.endedAt = Instant.now();
    }
}
