package app.pixme.config;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.support.TaskExecutorAdapter;

/**
 * Executors for background work.
 *
 * <p>Generation is I/O-bound — it spends almost all its time waiting on an AI
 * provider — so it runs on virtual threads: a slow provider parks cheaply
 * instead of pinning a pool thread, and a traffic spike doesn't need a large
 * platform-thread pool sized for the worst-case latency.
 */
@Configuration
public class AsyncConfig {

    public static final String GENERATION_EXECUTOR = "generationExecutor";
    public static final String NOTIFICATION_EXECUTOR = "notificationExecutor";

    @Bean(GENERATION_EXECUTOR)
    public Executor generationExecutor() {
        return virtualThreadExecutor("pixme-generation-");
    }

    /** Push fan-out: also I/O-bound, and must never block a request thread. */
    @Bean(NOTIFICATION_EXECUTOR)
    public Executor notificationExecutor() {
        return virtualThreadExecutor("pixme-notify-");
    }

    private TaskExecutor virtualThreadExecutor(String namePrefix) {
        return new TaskExecutorAdapter(
                Executors.newThreadPerTaskExecutor(
                        Thread.ofVirtual().name(namePrefix, 0).factory()));
    }
}
