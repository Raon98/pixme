package app.pixme.ai;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import app.pixme.config.PixmeProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Resolves the active {@link PixelImageProvider} from configuration.
 *
 * <p>All implementations are registered; exactly one is active per
 * {@code pixme.ai.provider}. Keeping them all instantiated (rather than using
 * {@code @ConditionalOnProperty}) means a provider can be switched at runtime
 * by a config reload, and makes A/B comparison between two providers on the
 * same input a small change rather than a redeploy.
 */
@Component
public class AiProviderRegistry {

    private static final Logger log = LoggerFactory.getLogger(AiProviderRegistry.class);

    private final Map<String, PixelImageProvider> providers;
    private final PixmeProperties properties;

    public AiProviderRegistry(List<PixelImageProvider> providers, PixmeProperties properties) {
        this.providers = providers.stream()
                .collect(Collectors.toMap(PixelImageProvider::name, Function.identity()));
        this.properties = properties;

        log.info(
                "AI providers registered: {} (active: {})",
                this.providers.keySet(),
                properties.ai().provider());
    }

    public PixelImageProvider active() {
        String configured = properties.ai().provider();
        PixelImageProvider provider = providers.get(configured);
        if (provider == null) {
            throw new IllegalStateException(
                    "Unknown pixme.ai.provider '%s'. Available: %s"
                            .formatted(configured, providers.keySet()));
        }
        return provider;
    }

    /** Named lookup, for comparing a candidate provider against the active one. */
    public PixelImageProvider byName(String name) {
        PixelImageProvider provider = providers.get(name);
        if (provider == null) {
            throw new IllegalArgumentException("Unknown AI provider: " + name);
        }
        return provider;
    }
}
