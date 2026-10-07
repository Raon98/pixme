package app.pixme.api;

import java.util.Map;

import app.pixme.api.dto.SystemDtos;
import app.pixme.config.PixmeProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Remote app config.
 *
 * <p>Unauthenticated on purpose: the client must be able to learn that the
 * service is in maintenance, or that this build is too old to run, <em>before</em>
 * it tries to sign in. Without that, a bad release has no kill switch.
 */
@RestController
@RequestMapping("/api/v1/system")
public class SystemController {

    private final PixmeProperties properties;

    public SystemController(PixmeProperties properties) {
        this.properties = properties;
    }

    @GetMapping("/config")
    public SystemDtos.AppConfigResponse config() {
        return new SystemDtos.AppConfigResponse(
                properties.minimumSupportedVersion(),
                new SystemDtos.MaintenanceResponse(
                        properties.maintenance().active(),
                        emptyToNull(properties.maintenance().message())),
                Map.of(
                        // Dark-launch switches. The client treats an absent key
                        // as "off", so adding one here is a safe rollout step.
                        "squareScenes", true,
                        "pixelStyles", true,
                        "rewardedAds", false,
                        "boost", false),
                1);
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
