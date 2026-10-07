package app.pixme.api.dto;

import java.time.Instant;
import java.util.List;

public record EntitlementsResponse(
        boolean plusActive,
        Instant plusExpiresAt,
        boolean freeGenerationAvailable,
        int creditBalance,
        List<String> unlockedStyles,
        List<String> unlockedDecorations) {}
