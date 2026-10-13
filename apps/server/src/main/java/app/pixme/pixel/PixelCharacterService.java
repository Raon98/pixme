package app.pixme.pixel;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.dailystatus.DailyStatusService;
import app.pixme.pixel.domain.GenerationStatus;
import app.pixme.pixel.domain.PixelCharacter;
import app.pixme.pixel.domain.PixelGeneration;
import app.pixme.pixel.domain.UserCurrentPixel;
import app.pixme.pixel.repository.PixelCharacterRepository;
import app.pixme.pixel.repository.PixelGenerationRepository;
import app.pixme.pixel.repository.UserCurrentPixelRepository;
import app.pixme.config.PixmeProperties;
import app.pixme.storage.StorageService;
import app.pixme.user.domain.UserSettings;
import app.pixme.user.domain.UserStats;
import app.pixme.user.repository.UserSettingsRepository;
import app.pixme.user.repository.UserStatsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owns the Collection — the clean, bright-line distinction the whole paid
 * model rests on:
 *
 * <ul>
 *   <li>{@link #keep} is the only path that creates a {@link PixelCharacter},
 *       and it only runs once per generation — the AI call that produced it
 *       was already paid for whether or not the user keeps the result.
 *   <li>{@link #setCurrent} repoints {@link UserCurrentPixel} among characters
 *       the user already owns and never calls a provider, which is what makes
 *       it free.
 * </ul>
 */
@Service
public class PixelCharacterService {

    private final PixelCharacterRepository characterRepository;
    private final PixelGenerationRepository generationRepository;
    private final UserCurrentPixelRepository currentPixelRepository;
    private final UserStatsRepository statsRepository;
    private final UserSettingsRepository settingsRepository;
    private final DailyStatusService dailyStatusService;
    private final StorageService storage;
    private final PixmeProperties properties;

    public PixelCharacterService(
            PixelCharacterRepository characterRepository,
            PixelGenerationRepository generationRepository,
            UserCurrentPixelRepository currentPixelRepository,
            UserStatsRepository statsRepository,
            UserSettingsRepository settingsRepository,
            DailyStatusService dailyStatusService,
            StorageService storage,
            PixmeProperties properties) {
        this.characterRepository = characterRepository;
        this.generationRepository = generationRepository;
        this.currentPixelRepository = currentPixelRepository;
        this.statsRepository = statsRepository;
        this.settingsRepository = settingsRepository;
        this.dailyStatusService = dailyStatusService;
        this.storage = storage;
        this.properties = properties;
    }

    /**
     * Confirms a completed generation as an owned character.
     *
     * <p>Idempotent on {@code generationId}: a retried request finds the
     * character already created and returns it rather than adding a
     * duplicate to the Collection.
     */
    @Transactional
    public PixelCharacter keep(
            UUID userId, UUID generationId, boolean asCurrent, boolean keepOriginal, String label) {

        PixelCharacter existing = characterRepository.findByGenerationId(generationId).orElse(null);
        if (existing != null) {
            if (asCurrent) {
                setCurrent(userId, existing.getId());
            }
            return existing;
        }

        PixelGeneration generation = generationRepository
                .findByIdAndUserId(generationId, userId)
                .orElseThrow(() -> ApiException.notFound("PIXME 생성"));

        if (generation.getStatus() != GenerationStatus.COMPLETED) {
            throw new ApiException(ErrorCode.GENERATION_NOT_COMPLETED);
        }

        // The user's own retention setting wins over whatever the client asked
        // for. 설정 > 개인정보's "원본 사진 보관" switch is a privacy promise, and a
        // promise the client can override by sending `keepOriginal: true` is
        // not one — so it is resolved here, on the authoritative side.
        boolean retentionAllowed = settingsRepository
                .findById(userId)
                .map(UserSettings::isKeepOriginalPhoto)
                .orElse(true);
        boolean retainOriginal = keepOriginal && retentionAllowed;

        PixelCharacter character = PixelCharacter.keep(userId, generation, retainOriginal);
        if (label != null && !label.isBlank()) {
            character.setLabel(label);
        }
        characterRepository.save(character);

        // Not retaining means the photo is gone, not merely unreferenced:
        // dropping the key alone would orphan the object in storage forever,
        // since the retention sweep only ever looks at characters that still
        // have one. "생성 직후 삭제" has to actually delete.
        if (!retainOriginal && generation.getOriginalObjectKey() != null) {
            storage.deleteOriginal(generation.getOriginalObjectKey());
        }

        incrementCollectionCount(userId);

        if (asCurrent) {
            setCurrent(userId, character.getId());
        }

        return character;
    }

    /**
     * Free switch among owned characters. Never calls a provider — the whole
     * point of the Collection is that re-wearing an old look costs nothing.
     *
     * <p>Also ensures today's {@code DailyStatus} points at the new character,
     * creating today's row if none exists yet, so a Current PIXME change is
     * always immediately visible on Today/광장 — see
     * {@link DailyStatusService#ensureTodayPointsAt}.
     */
    @Transactional
    public UserCurrentPixel setCurrent(UUID userId, UUID pixelCharacterId) {
        PixelCharacter character = characterRepository
                .findByIdAndUserId(pixelCharacterId, userId)
                .filter(PixelCharacter::isAlive)
                .orElseThrow(() -> ApiException.notFound("PIXME"));

        UserCurrentPixel current = currentPixelRepository
                .findByUserId(userId)
                .map(existing -> {
                    existing.repoint(character.getId());
                    return existing;
                })
                .orElseGet(() -> UserCurrentPixel.of(userId, character.getId()));
        currentPixelRepository.save(current);

        dailyStatusService.ensureTodayPointsAt(userId, character.getId());

        return current;
    }

    @Transactional(readOnly = true)
    public List<PixelCharacter> collection(UUID userId) {
        return characterRepository.findCollection(userId);
    }

    @Transactional(readOnly = true)
    public UUID currentCharacterId(UUID userId) {
        return currentPixelRepository
                .findByUserId(userId)
                .map(UserCurrentPixel::getPixelCharacterId)
                .orElse(null);
    }

    @Transactional
    public void delete(UUID userId, UUID pixelCharacterId) {
        PixelCharacter character = characterRepository
                .findByIdAndUserId(pixelCharacterId, userId)
                .filter(PixelCharacter::isAlive)
                .orElseThrow(() -> ApiException.notFound("PIXME"));

        boolean isCurrent = currentPixelRepository
                .findByUserId(userId)
                .map(UserCurrentPixel::getPixelCharacterId)
                .map(character.getId()::equals)
                .orElse(false);
        if (isCurrent) {
            throw new ApiException(
                    ErrorCode.VALIDATION_FAILED, "현재 사용 중인 PIXME는 삭제할 수 없어요.");
        }

        character.softDelete();
        characterRepository.save(character);
    }

    public record SignedUrl(String url, Instant expiresAt) {}

    @Transactional(readOnly = true)
    public SignedUrl originalUrl(UUID userId, UUID pixelCharacterId) {
        PixelCharacter character = characterRepository
                .findByIdAndUserId(pixelCharacterId, userId)
                .orElseThrow(() -> ApiException.notFound("PIXME"));
        if (!character.hasOriginal()) {
            throw new ApiException(ErrorCode.ORIGINAL_NOT_AVAILABLE);
        }
        Duration ttl = properties.storage().originalViewUrlTtl();
        String url = storage.presignOriginalDownload(character.getOriginalObjectKey(), ttl);
        return new SignedUrl(url, Instant.now().plus(ttl));
    }

    @Transactional
    public void deleteOriginal(UUID userId, UUID pixelCharacterId) {
        PixelCharacter character = characterRepository
                .findByIdAndUserId(pixelCharacterId, userId)
                .orElseThrow(() -> ApiException.notFound("PIXME"));
        if (character.hasOriginal()) {
            storage.deleteOriginal(character.getOriginalObjectKey());
            character.forgetOriginal();
            characterRepository.save(character);
        }
    }

    private void incrementCollectionCount(UUID userId) {
        UserStats stats = statsRepository
                .findById(userId)
                .orElseGet(() -> statsRepository.save(UserStats.createFor(userId)));
        stats.incrementPixelCount();
        statsRepository.save(stats);
    }
}
