package app.pixme.ai;

import java.time.Duration;

import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;

/**
 * Shared HTTP factory for AI providers.
 *
 * <p>Image generation requests are long (tens of seconds) and large, so the
 * read timeout is per-provider configuration rather than the framework
 * default. Uses the JDK HTTP client so providers get HTTP/2 and connection
 * reuse without pulling in another HTTP library.
 */
final class AiHttp {

    private AiHttp() {}

    static ClientHttpRequestFactory requestFactory(Duration readTimeout) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(readTimeout);
        return factory;
    }
}
