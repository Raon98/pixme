package app.pixme;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
@EnableAsync
public class PixmeApplication {

    public static void main(String[] args) {
        // Must be set before any java.net.http.HttpClient is built (the AI
        // provider clients included). Without it, outbound calls to hosts that
        // answer on IPv4 but have a AAAA record (api.openai.com among them)
        // can hang for tens of seconds while the JDK's Happy-Eyeballs IPv6
        // attempt times out first, rather than failing fast or falling back
        // promptly. Set as a system property here rather than a required JVM
        // flag so it holds regardless of how the jar is launched.
        System.setProperty("java.net.preferIPv4Stack", "true");
        SpringApplication.run(PixmeApplication.class, args);
    }
}
