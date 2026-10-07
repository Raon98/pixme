package app.pixme.user.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_settings")
@Getter
@Setter
@NoArgsConstructor
public class UserSettings {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "push_heart", nullable = false)
    private boolean pushHeart = true;

    @Column(name = "push_connection_request", nullable = false)
    private boolean pushConnectionRequest = true;

    @Column(name = "push_connected", nullable = false)
    private boolean pushConnected = true;

    @Column(name = "push_message", nullable = false)
    private boolean pushMessage = true;

    @Column(name = "push_daily_reminder", nullable = false)
    private boolean pushDailyReminder = true;

    /**
     * When false, the original photo is deleted immediately after the character
     * is generated. The character and the user's record survive — only the
     * photograph is discarded.
     */
    @Column(name = "keep_original_photo", nullable = false)
    private boolean keepOriginalPhoto = true;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static UserSettings createFor(UUID userId) {
        UserSettings settings = new UserSettings();
        settings.userId = userId;
        settings.updatedAt = Instant.now();
        return settings;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }
}
