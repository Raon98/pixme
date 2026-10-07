package app.pixme.pixel;

import java.util.UUID;

/**
 * Published when a generation row has been created and charged.
 *
 * <p>An event rather than a direct executor submit so that dispatch can be
 * bound to <em>after commit</em>. Submitting from inside the transaction races
 * the commit: the worker frequently wins, finds no row, and the generation
 * silently never runs while the user watches a loading screen.
 */
public record GenerationQueuedEvent(UUID generationId) {}
