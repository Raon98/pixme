package app.pixme.api;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import app.pixme.api.dto.DecorationDtos;
import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.security.AuthPrincipal;
import app.pixme.security.CurrentUser;
import app.pixme.store.DecorationService;
import app.pixme.store.domain.DecorationSlot;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 꾸미기 — what the user owns, and what they have applied where. */
@RestController
@RequestMapping("/api/v1/decorations")
public class DecorationController {

    private final DecorationService decorationService;

    public DecorationController(DecorationService decorationService) {
        this.decorationService = decorationService;
    }

    @GetMapping
    public DecorationDtos.DecorationsResponse list(@CurrentUser AuthPrincipal principal) {
        DecorationService.View view = decorationService.view(principal.userId());

        List<DecorationDtos.DecorationResponse> items = new ArrayList<>(view.items().size());
        for (DecorationService.Available item : view.items()) {
            items.add(new DecorationDtos.DecorationResponse(
                    item.unlockCode(),
                    item.slot().name(),
                    item.name(),
                    item.description(),
                    item.fallbackPriceKrw(),
                    item.storeProductCode(),
                    item.owned(),
                    item.viaPlus(),
                    item.plusOnly()));
        }

        return new DecorationDtos.DecorationsResponse(items, toStringKeys(view.active()));
    }

    @PutMapping("/{slot}")
    public DecorationDtos.DecorationsResponse apply(
            @CurrentUser AuthPrincipal principal,
            @PathVariable String slot,
            @RequestBody(required = false) DecorationDtos.ApplyDecorationRequest request) {

        DecorationSlot parsed = DecorationSlot.from(slot);
        if (parsed == null) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "알 수 없는 꾸미기 자리예요.");
        }

        decorationService.apply(
                principal.userId(), parsed, request == null ? null : request.unlockCode());

        return list(principal);
    }

    private Map<String, String> toStringKeys(Map<DecorationSlot, String> active) {
        Map<String, String> result = new HashMap<>();
        active.forEach((slot, code) -> result.put(slot.name(), code));
        return result;
    }
}
