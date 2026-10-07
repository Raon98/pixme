package app.pixme.support;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import app.pixme.ai.PixelStyle;
import app.pixme.auth.provider.SocialIdentity;
import app.pixme.pixel.domain.GenerationStatus;
import app.pixme.pixel.domain.PixelGeneration;
import app.pixme.pixel.repository.PixelGenerationRepository;
import app.pixme.user.UserService;
import app.pixme.user.domain.AuthProvider;
import app.pixme.user.domain.User;
import org.springframework.stereotype.Component;

/** Builds the minimum real objects a scenario needs, through production APIs. */
@Component
public class TestFixtures {

    private final UserService userService;
    private final PixelGenerationRepository generationRepository;

    public TestFixtures(
            UserService userService, PixelGenerationRepository generationRepository) {
        this.userService = userService;
        this.generationRepository = generationRepository;
    }

    /** A fully set-up, ACTIVE user with a unique nickname. */
    public User activeUser(String nicknameSeed) {
        String providerUserId = "test-" + UUID.randomUUID();
        User user = userService
                .findOrCreate(new SocialIdentity(
                        AuthProvider.APPLE, providerUserId, null, null))
                .user();

        userService.updateProfile(
                user.getId(),
                new UserService.UpdateProfileCommand(
                        uniqueNickname(nicknameSeed),
                        LocalDate.of(2000, 1, 1),
                        null,
                        false,
                        List.of("MUSIC", "CAFE"),
                        null));

        return userService.require(user.getId());
    }

    /**
     * A COMPLETED generation, as though the AI pipeline had finished. Lets
     * publish-path tests run without exercising the provider.
     */
    public PixelGeneration completedGeneration(UUID userId, LocalDate postDate) {
        PixelGeneration generation = PixelGeneration.create(
                userId,
                "originals/test/" + UUID.randomUUID() + ".jpg",
                PixelStyle.PIXME_BASIC,
                "stub",
                "PIXME_V1",
                postDate,
                (short) 1);
        generation.markCompleted(
                "characters/test/" + UUID.randomUUID() + ".png", "stub-v1", null);
        generation.setStatus(GenerationStatus.COMPLETED);
        return generationRepository.save(generation);
    }

    /** Nicknames are globally unique, so every test user needs a fresh one. */
    public String uniqueNickname(String seed) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        String base = seed.length() > 5 ? seed.substring(0, 5) : seed;
        return base + suffix;
    }
}
