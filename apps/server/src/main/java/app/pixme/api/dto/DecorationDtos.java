package app.pixme.api.dto;

import java.util.List;
import java.util.Map;

public final class DecorationDtos {

    private DecorationDtos() {}

    public record DecorationsResponse(
            List<DecorationResponse> items,
            /** Slot name → unlock code currently applied. Absent slot = none. */
            Map<String, String> active) {}

    public record DecorationResponse(
            String unlockCode,
            String slot,
            String name,
            String description,
            int fallbackPriceKrw,
            String storeProductCode,
            /** True when the user may apply it right now. */
            boolean owned,
            /** True when that right comes from PIXME+ rather than a purchase. */
            boolean viaPlus,
            /** Sold only as part of PIXME+ — there is no individual price. */
            boolean plusOnly) {}

    /** Null/blank {@code unlockCode} clears the slot. */
    public record ApplyDecorationRequest(String unlockCode) {}
}
