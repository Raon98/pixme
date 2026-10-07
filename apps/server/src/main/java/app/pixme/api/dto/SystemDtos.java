package app.pixme.api.dto;

import java.util.Map;

public final class SystemDtos {

    private SystemDtos() {}

    /**
     * Remote app config.
     *
     * <p>Fetched before sign-in so the client can show the maintenance or
     * force-update gate without a session. These are the operational levers
     * that let us stop a bad release or take the service down for maintenance
     * without shipping a build.
     */
    public record AppConfigResponse(
            String minimumSupportedVersion,
            MaintenanceResponse maintenance,
            Map<String, Boolean> features,
            int storeRevision) {}

    public record MaintenanceResponse(boolean active, String message) {}
}
