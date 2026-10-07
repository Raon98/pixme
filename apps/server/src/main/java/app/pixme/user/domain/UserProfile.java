package app.pixme.user.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_profiles")
@Getter
@Setter
@NoArgsConstructor
public class UserProfile {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "nickname", length = 12)
    private String nickname;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender", length = 16)
    private Gender gender;

    @Column(name = "bio", length = 60)
    private String bio;

    /**
     * The post whose character represents this user across the app. Kept
     * denormalised because it is read on nearly every screen (feed header,
     * chat list, square nameplate) and would otherwise require a subquery
     * against the whole post history every time.
     */
    @Column(name = "representative_post_id")
    private UUID representativePostId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static UserProfile createFor(UUID userId) {
        UserProfile profile = new UserProfile();
        profile.userId = userId;
        Instant now = Instant.now();
        profile.createdAt = now;
        profile.updatedAt = now;
        return profile;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    /** Profile completion gate: a name, an age, and at least one interest. */
    public boolean hasRequiredFields() {
        return nickname != null && !nickname.isBlank() && birthDate != null;
    }
}
