package app.pixme.ai;

import java.net.http.HttpClient;
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
 *
 * <p>The connect timeout is bounded separately and kept short. Connecting is
 * not the slow part — generating is — and an unbounded connect parks a worker
 * on a request that may already have been billed, until the stuck-generation
 * reaper refunds it.
 */
final class AiHttp {

    private AiHttp() {}

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);

    static ClientHttpRequestFactory requestFactory(Duration readTimeout) {
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(client);
        factory.setReadTimeout(readTimeout);
        return factory;
    }
}
