package app.pixme.store.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * The free daily allowance and the paid balance, deliberately kept as separate
 * fields on one row.
 *
 * <p>Conflating them is the classic way to get this wrong: a user who has used
 * today's free generation and bought credits must spend the credits, and a user
 * who has credits must still get tomorrow's free one. Keeping
 * {@code lastFreeGenerationDate} here (rather than deriving it from the
 * generation table) also means the daily reset is a single-row read on the hot
 * path.
 */
@Entity
@Table(name = "generation_credits")
@Getter
@Setter
@NoArgsConstructor
public class GenerationCredit {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "credit_count", nullable = false)
    private int creditCount;

    @Column(name = "last_free_generation_date")
    private LocalDate lastFreeGenerationDate;

    @Column(name = "free_used_today", nullable = false)
    private short freeUsedToday;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static GenerationCredit createFor(UUID userId) {
        GenerationCredit credit = new GenerationCredit();
        credit.userId = userId;
        credit.creditCount = 0;
        credit.freeUsedToday = 0;
        credit.updatedAt = Instant.now();
        return credit;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    /** True when the free allowance for {@code today} has not been used. */
    public boolean hasFreeGeneration(LocalDate today, int freePerDay) {
        if (lastFreeGenerationDate == null || !lastFreeGenerationDate.equals(today)) {
            return true;
        }
        return freeUsedToday < freePerDay;
    }

    public void consumeFreeGeneration(LocalDate today) {
        if (lastFreeGenerationDate == null || !lastFreeGenerationDate.equals(today)) {
            this.lastFreeGenerationDate = today;
            this.freeUsedToday = 1;
        } else {
            this.freeUsedToday = (short) (this.freeUsedToday + 1);
        }
    }

    public void consumeCredit() {
        if (creditCount <= 0) {
            throw new IllegalStateException("no credit to consume");
        }
        this.creditCount -= 1;
    }

    public void addCredits(int amount) {
        this.creditCount = Math.max(0, this.creditCount + amount);
    }
}
