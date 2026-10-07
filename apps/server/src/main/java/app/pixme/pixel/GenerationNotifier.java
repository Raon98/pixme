package app.pixme.pixel;

import java.util.UUID;

import app.pixme.pixel.domain.GenerationFailureReason;

/**
 * Hook the generation pipeline calls on completion.
 *
 * <p>An interface rather than a direct dependency on the notification service
 * so that generation does not transitively depend on push, templating and the
 * notification schema — and so it stays trivially testable.
 */
public interface GenerationNotifier {

    void onGenerationCompleted(UUID userId, UUID generationId);

    void onGenerationFailed(UUID userId, UUID generationId, GenerationFailureReason reason);
}
