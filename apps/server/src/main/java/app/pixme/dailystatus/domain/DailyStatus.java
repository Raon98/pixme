package app.pixme.dailystatus.domain;

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
 * "오늘의 상태" — one row per (user, calendar day). The free, dated half of
 * what used to be a {@code pixel_post}.
 *
 * <p>Three ways this row gets touched, and only the third one costs anything:
 * <ol>
 *   <li>A pure status edit — mood/message/tags change, {@code pixelCharacterId}
 *       stays whatever it already was today.
 *   <li>A free Current PIXME switch — {@code pixelCharacterId} changes to
 *       another character the user already owns, mood/message/tags untouched.
 *   <li>A paid generation kept as the new Current PIXME — same effect as (2),
 *       but the character didn't exist until this moment.
 * </ol>
 *
 * <p>{@code pixelCharacterId} is a live snapshot <em>only while this row is
 * today's</em>: {@link app.pixme.pixel.PixelCharacterService} keeps it in sync
 * on every Current PIXME change so the feed and square reflect a switch
 * immediately. Once the calendar day passes, nothing touches the row again —
 * it becomes an honest historical record of what the user looked like that
 * day, which is what the Pixel History calendar reads from.
 */
@Entity
@Table(name = "daily_status")
@Getter
@Setter
@NoArgsConstructor
public class DailyStatus {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "status_date", nullable = false)
    private LocalDate statusDate;

    @Column(name = "mood", length = 16)
    private String mood;

    @Column(name = "message", length = 60)
    private String message;

    @Column(name = "pixel_character_id", nullable = false)
    private UUID pixelCharacterId;

    /** True when this row's character pointer was set by a PIXME switch today. */
    @Column(name = "fresh_character", nullable = false)
    private boolean freshCharacter;

    @Column(name = "heart_count", nullable = false)
    private int heartCount;

    @Column(name = "view_count", nullable = false)
    private int viewCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static DailyStatus createFor(UUID userId, LocalDate statusDate, UUID pixelCharacterId) {
        DailyStatus status = new DailyStatus();
        status.id = UUID.randomUUID();
        status.userId = userId;
        status.statusDate = statusDate;
        status.pixelCharacterId = pixelCharacterId;
        Instant now = Instant.now();
        status.createdAt = now;
        status.updatedAt = now;
        return status;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    /** Pure text edit — the character pointer and its freshness are untouched. */
    public void editStatus(String mood, String message) {
        this.mood = mood;
        this.message = message;
    }

    /** A Current PIXME switch landed on today — repoint and mark fresh. */
    public void syncCharacter(UUID pixelCharacterId) {
        this.pixelCharacterId = pixelCharacterId;
        this.freshCharacter = true;
    }

    public void addHearts(int delta) {
        this.heartCount = Math.max(0, this.heartCount + delta);
    }
}
