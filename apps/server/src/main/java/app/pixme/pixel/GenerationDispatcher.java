package app.pixme.pixel;

import java.util.concurrent.Executor;

import app.pixme.config.AsyncConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Hands queued generations to the worker pool once their transaction has
 * committed.
 *
 * <p>{@code fallbackExecution = true} keeps this working when a generation is
 * started outside a transaction (a test, or a future admin path) — otherwise
 * the event would be dropped silently, which is the worst possible failure for
 * something the user is waiting on.
 */
@Component
public class GenerationDispatcher {

    private static final Logger log = LoggerFactory.getLogger(GenerationDispatcher.class);

    private final GenerationPipeline pipeline;
    private final Executor executor;

    public GenerationDispatcher(
            GenerationPipeline pipeline,
            @Qualifier(AsyncConfig.GENERATION_EXECUTOR) Executor executor) {
        this.pipeline = pipeline;
        this.executor = executor;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onGenerationQueued(GenerationQueuedEvent event) {
        log.debug("dispatching generation={}", event.generationId());
        executor.execute(() -> pipeline.run(event.generationId()));
    }
}
