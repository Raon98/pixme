package app.pixme.user;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import app.pixme.auth.provider.SocialIdentity;
import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.common.ServiceClock;
import app.pixme.common.TextSanitizer;
import app.pixme.store.CreditService;
import app.pixme.user.domain.Interest;
import app.pixme.user.domain.User;
import app.pixme.user.domain.UserInterest;
import app.pixme.user.domain.UserProfile;
import app.pixme.user.domain.UserSettings;
import app.pixme.user.domain.UserStats;
import app.pixme.user.domain.UserStatus;
import app.pixme.user.repository.InterestRepository;
import app.pixme.user.repository.UserInterestRepository;
import app.pixme.user.repository.UserProfileRepository;
import app.pixme.user.repository.UserRepository;
import app.pixme.user.repository.UserSettingsRepository;
import app.pixme.user.repository.UserStatsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Accounts and profiles.
 *
 * <p>An account is intentionally thin: a provider identity, a nickname, a birth
 * date and some interests. There is no identity verification anywhere in this
 * service, by design — the product's safety model is reporting, blocking and
 * content screening, and the minimum age is enforced from a self-declared
 * birth date rather than by collecting documents.
 */
@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private static final int MIN_AGE = 14;
    private static final int MAX_INTERESTS = 8;

    private final UserRepository userRepository;
    private final UserProfileRepository profileRepository;
    private final UserSettingsRepository settingsRepository;
    private final UserStatsRepository statsRepository;
    private final UserInterestRepository userInterestRepository;
    private final InterestRepository interestRepository;
    private final CreditService creditService;
    private final TextSanitizer sanitizer;
    private final ServiceClock clock;

    public UserService(
            UserRepository userRepository,
            UserProfileRepository profileRepository,
            UserSettingsRepository settingsRepository,
            UserStatsRepository statsRepository,
            UserInterestRepository userInterestRepository,
            InterestRepository interestRepository,
            CreditService creditService,
            TextSanitizer sanitizer,
            ServiceClock clock) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.settingsRepository = settingsRepository;
        this.statsRepository = statsRepository;
        this.userInterestRepository = userInterestRepository;
        this.interestRepository = interestRepository;
        this.creditService = creditService;
        this.sanitizer = sanitizer;
        this.clock = clock;
    }

    public record Resolution(User user, boolean created) {}

    /* ------------------------------------------------------------ sign up */

    /**
     * Finds the account for a social identity, creating it (and its satellite
     * rows) on first sign-in.
     *
     * <p>Tolerates the race where the same person taps sign-in twice: the
     * unique index on (provider, provider_user_id) rejects the loser, which
     * then reads the winner's row.
     */
    @Transactional
    public Resolution findOrCreate(SocialIdentity identity) {
        Optional<User> existing = userRepository.findByProviderAndProviderUserId(
                identity.provider(), identity.providerUserId());

        if (existing.isPresent()) {
            User user = existing.get();
            if (user.isDeleted()) {
                // Re-signing in during the grace period reactivates rather than
                // creating a duplicate account.
                user.setDeletedAt(null);
                user.setStatus(
                        isProfileCompleted(user.getId())
                                ? UserStatus.ACTIVE
                                : UserStatus.PENDING_PROFILE);
                userRepository.save(user);
                log.info("reactivated account user={}", user.getId());
            }
            userRepository.markActive(user.getId(), Instant.now());
            return new Resolution(user, false);
        }

        try {
            User user = User.create(
                    identity.provider(), identity.providerUserId(), identity.email());
            user.setLastActiveAt(Instant.now());
            userRepository.saveAndFlush(user);

            profileRepository.save(UserProfile.createFor(user.getId()));
            settingsRepository.save(UserSettings.createFor(user.getId()));
            statsRepository.save(UserStats.createFor(user.getId()));
            creditService.initialize(user.getId());

            log.info("created account user={} provider={}", user.getId(), identity.provider());
            return new Resolution(user, true);
        } catch (DataIntegrityViolationException exception) {
            User user = userRepository
                    .findByProviderAndProviderUserId(
                            identity.provider(), identity.providerUserId())
                    .orElseThrow(() -> new ApiException(ErrorCode.INTERNAL_ERROR));
            return new Resolution(user, false);
        }
    }

    /* --------------------------------------------------------------- read */

    @Transactional(readOnly = true)
    public User requireActive(UUID userId) {
        User user = userRepository
                .findActiveById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        if (user.isSuspended(Instant.now())) {
            throw new ApiException(ErrorCode.ACCOUNT_SUSPENDED);
        }
        return user;
    }

    @Transactional(readOnly = true)
    public User require(UUID userId) {
        return userRepository
                .findActiveById(userId)
                .orElseThrow(() -> ApiException.notFound("사용자"));
    }

    @Transactional(readOnly = true)
    public UserProfile profileOf(UUID userId) {
        return profileRepository
                .findById(userId)
                .orElseThrow(() -> ApiException.notFound("프로필"));
    }

    @Transactional(readOnly = true)
    public UserSettings settingsOf(UUID userId) {
        return settingsRepository
                .findById(userId)
                .orElseGet(() -> settingsRepository.save(UserSettings.createFor(userId)));
    }

    @Transactional(readOnly = true)
    public UserStats statsOf(UUID userId) {
        return statsRepository
                .findById(userId)
                .orElseGet(() -> statsRepository.save(UserStats.createFor(userId)));
    }

    @Transactional(readOnly = true)
    public List<String> interestsOf(UUID userId) {
        return userInterestRepository.findCodesByUserId(userId);
    }

    @Transactional(readOnly = true)
    public List<Interest> allInterests() {
        return interestRepository.findByActiveTrueOrderBySortOrderAsc();
    }

    /** Nickname + birth date + at least one interest. */
    @Transactional(readOnly = true)
    public boolean isProfileCompleted(UUID userId) {
        return profileRepository
                        .findById(userId)
                        .map(UserProfile::hasRequiredFields)
                        .orElse(false)
                && !userInterestRepository.findCodesByUserId(userId).isEmpty();
    }

    /* ------------------------------------------------------------- update */

    public record UpdateProfileCommand(
            String nickname,
            LocalDate birthDate,
            String bio,
            Boolean bioProvided,
            List<String> interests,
            SettingsPatch settings) {}

    public record SettingsPatch(
            Boolean pushHeart,
            Boolean pushConnectionRequest,
            Boolean pushConnected,
            Boolean pushMessage,
            Boolean pushDailyReminder,
            Boolean keepOriginalPhoto,
            Boolean squareVisible) {}

    /**
     * Partial profile update, used by both first-run setup and later editing.
     *
     * <p>Only fields that were actually supplied are touched — a PATCH that
     * omits {@code interests} must not wipe them.
     */
    @Transactional
    public User updateProfile(UUID userId, UpdateProfileCommand command) {
        User user = requireActive(userId);
        UserProfile profile = profileRepository
                .findById(userId)
                .orElseGet(() -> profileRepository.save(UserProfile.createFor(userId)));

        if (command.nickname() != null) {
            String nickname = sanitizer.sanitizeNickname(command.nickname());
            if (!nickname.equalsIgnoreCase(
                    profile.getNickname() == null ? "" : profile.getNickname())) {
                if (profileRepository.existsByNicknameIgnoreCase(nickname)) {
                    throw new ApiException(ErrorCode.NICKNAME_TAKEN);
                }
            }
            profile.setNickname(nickname);
        }

        if (command.birthDate() != null) {
            requireMinimumAge(command.birthDate());
            // Birth date is write-once: allowing edits would let someone clear
            // the age gate after the fact.
            if (profile.getBirthDate() == null) {
                profile.setBirthDate(command.birthDate());
            } else if (!profile.getBirthDate().equals(command.birthDate())) {
                throw new ApiException(
                        ErrorCode.VALIDATION_FAILED, "생년월일은 변경할 수 없어요.");
            }
        }

        if (Boolean.TRUE.equals(command.bioProvided())) {
            profile.setBio(sanitizer.sanitizeFreeText(command.bio(), 60, "한줄소개"));
        }

        if (command.interests() != null) {
            replaceInterests(userId, command.interests());
        }

        if (command.settings() != null) {
            applySettings(userId, command.settings());
        }

        try {
            profileRepository.saveAndFlush(profile);
        } catch (DataIntegrityViolationException exception) {
            // Lost the race for a nickname between the check and the write.
            throw new ApiException(ErrorCode.NICKNAME_TAKEN);
        }

        // Completing the profile is what promotes the account to ACTIVE.
        if (user.getStatus() == UserStatus.PENDING_PROFILE && isProfileCompleted(userId)) {
            user.setStatus(UserStatus.ACTIVE);
            userRepository.save(user);
        }

        return user;
    }

    @Transactional(readOnly = true)
    public NicknameAvailability checkNickname(String rawNickname) {
        String nickname;
        try {
            nickname = sanitizer.sanitizeNickname(rawNickname);
        } catch (ApiException exception) {
            return exception.code() == ErrorCode.NICKNAME_FORBIDDEN
                    ? new NicknameAvailability(false, "FORBIDDEN")
                    : new NicknameAvailability(false, "INVALID_FORMAT");
        }
        return profileRepository.existsByNicknameIgnoreCase(nickname)
                ? new NicknameAvailability(false, "TAKEN")
                : new NicknameAvailability(true, null);
    }

    public record NicknameAvailability(boolean available, String reason) {}

    @Transactional
    public void touchActivity(UUID userId) {
        userRepository.markActive(userId, Instant.now());
    }

    /* ------------------------------------------------------------- delete */

    /**
     * Marks the account deleted.
     *
     * <p>The row survives for the grace period so a user who changes their mind
     * can sign back in, and so we keep the provider identity mapping long
     * enough to avoid a duplicate account. The hard purge — profile, posts,
     * originals, connections, messages — runs after the grace period; see
     * {@code AccountPurgeJob}.
     */
    @Transactional
    public void requestDeletion(UUID userId, String reason) {
        User user = userRepository
                .findActiveById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));

        user.setStatus(UserStatus.DELETED);
        user.setDeletedAt(Instant.now());
        userRepository.save(user);

        // Nickname is released immediately so it doesn't stay reserved by an
        // account nobody can see.
        profileRepository.findById(userId).ifPresent(profile -> {
            profile.setNickname(null);
            profile.setBio(null);
            profileRepository.save(profile);
        });

        log.info("deletion requested for user={} reason={}", userId, reason == null ? "-" : reason);
    }

    /* ------------------------------------------------------------ helpers */

    private void requireMinimumAge(LocalDate birthDate) {
        if (birthDate.isAfter(clock.today())) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "생년월일을 다시 확인해주세요.");
        }
        int age = Period.between(birthDate, clock.today()).getYears();
        if (age < MIN_AGE) {
            throw new ApiException(ErrorCode.AGE_RESTRICTED);
        }
        if (age > 120) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "생년월일을 다시 확인해주세요.");
        }
    }

    private void replaceInterests(UUID userId, List<String> requested) {
        Set<String> valid = new HashSet<>();
        interestRepository
                .findByActiveTrueOrderBySortOrderAsc()
                .forEach(interest -> valid.add(interest.getCode()));

        Set<String> selected = new LinkedHashSet<>();
        for (String code : requested) {
            if (code == null) {
                continue;
            }
            String normalized = code.trim().toUpperCase();
            if (!valid.contains(normalized)) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, "알 수 없는 관심사예요.");
            }
            selected.add(normalized);
            if (selected.size() >= MAX_INTERESTS) {
                break;
            }
        }

        if (selected.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "관심사를 하나 이상 골라주세요.");
        }

        userInterestRepository.deleteAllByUserId(userId);
        userInterestRepository.flush();

        List<UserInterest> entities = new ArrayList<>(selected.size());
        for (String code : selected) {
            entities.add(new UserInterest(userId, code));
        }
        userInterestRepository.saveAll(entities);
    }

    private void applySettings(UUID userId, SettingsPatch patch) {
        UserSettings settings = settingsRepository
                .findById(userId)
                .orElseGet(() -> settingsRepository.save(UserSettings.createFor(userId)));

        if (patch.pushHeart() != null) {
            settings.setPushHeart(patch.pushHeart());
        }
        if (patch.pushConnectionRequest() != null) {
            settings.setPushConnectionRequest(patch.pushConnectionRequest());
        }
        if (patch.pushConnected() != null) {
            settings.setPushConnected(patch.pushConnected());
        }
        if (patch.pushMessage() != null) {
            settings.setPushMessage(patch.pushMessage());
        }
        if (patch.pushDailyReminder() != null) {
            settings.setPushDailyReminder(patch.pushDailyReminder());
        }
        if (patch.keepOriginalPhoto() != null) {
            settings.setKeepOriginalPhoto(patch.keepOriginalPhoto());
        }
        if (patch.squareVisible() != null) {
            settings.setSquareVisible(patch.squareVisible());
            settings.setSquareOnboarded(true);
        }
        settingsRepository.save(settings);
    }
}
