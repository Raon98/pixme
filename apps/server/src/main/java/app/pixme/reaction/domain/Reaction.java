package app.pixme.reaction.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "reactions")
@Getter
@NoArgsConstructor
public class Reaction {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "from_user_id", nullable = false)
    private UUID fromUserId;

    @Column(name = "post_id", nullable = false)
    private UUID postId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 16)
    private ReactionType type = ReactionType.HEART;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static Reaction heart(UUID fromUserId, UUID postId) {
        Reaction reaction = new Reaction();
        reaction.id = UUID.randomUUID();
        reaction.fromUserId = fromUserId;
        reaction.postId = postId;
        reaction.type = ReactionType.HEART;
        reaction.createdAt = Instant.now();
        return reaction;
    }
}
