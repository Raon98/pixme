package app.pixme.store;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.store.domain.DecorationSlot;
import app.pixme.store.domain.StorePlatform;
import app.pixme.store.domain.Product;
import app.pixme.store.domain.ProductKind;
import app.pixme.store.domain.UserActiveDecoration;
import app.pixme.store.repository.ProductRepository;
import app.pixme.store.repository.UserActiveDecorationRepository;
import app.pixme.store.repository.UserUnlockRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Choosing and resolving decorations.
 *
 * <p>The rule that matters: a stored choice is not a right to use it. Every
 * read re-derives access from (bought outright) OR (PIXME+ active right now),
 * so when a subscription lapses the subscriber-only items stop rendering for
 * everyone immediately — no revocation job, no stale unlock rows — and come
 * back untouched if they resubscribe. Anything bought individually survives
 * either way, which is the whole difference between the two purchase paths.
 */
@Service
public class DecorationService {

    private final ProductRepository productRepository;
    private final UserUnlockRepository unlockRepository;
    private final UserActiveDecorationRepository activeRepository;
    private final StoreService storeService;

    public DecorationService(
            ProductRepository productRepository,
            UserUnlockRepository unlockRepository,
            UserActiveDecorationRepository activeRepository,
            StoreService storeService) {
        this.productRepository = productRepository;
        this.unlockRepository = unlockRepository;
        this.activeRepository = activeRepository;
        this.storeService = storeService;
    }

    /** One catalog entry plus whether this user may apply it. */
    public record Available(
            String unlockCode,
            DecorationSlot slot,
            String name,
            String description,
            int fallbackPriceKrw,
            String storeProductCode,
            boolean owned,
            boolean viaPlus,
            /** No store product of its own — reachable only through PIXME+. */
            boolean plusOnly) {}

    public record View(List<Available> items, Map<DecorationSlot, String> active) {}

    @Transactional(readOnly = true)
    public View view(UUID userId) {
        boolean plusActive = storeService.isPlusActive(userId);
        Set<String> owned =
                new HashSet<>(unlockRepository.findCodesByUserIdAndKind(userId, "DECORATION"));

        List<Product> catalog =
                productRepository.findByKindAndActiveTrueOrderBySortOrderAsc(ProductKind.DECORATION);

        List<Available> items = new ArrayList<>(catalog.size());
        for (Product product : catalog) {
            if (product.getDecorationSlot() == null || product.getUnlockCode() == null) {
                continue;
            }
            boolean ownedOutright = owned.contains(product.getUnlockCode());
            items.add(new Available(
                    product.getUnlockCode(),
                    product.getDecorationSlot(),
                    product.getName(),
                    product.getDescription(),
                    product.getFallbackPriceKrw(),
                    product.getCode(),
                    ownedOutright || plusActive,
                    !ownedOutright && plusActive,
                    product.storeProductId(StorePlatform.IOS) == null));
        }

        return new View(items, resolveActive(userId, owned, plusActive));
    }

    /**
     * Applies a decoration, or clears the slot when {@code unlockCode} is null.
     *
     * @throws ApiException if the item does not exist, belongs to a different
     *     slot, or the user has no right to it
     */
    @Transactional
    public Map<DecorationSlot, String> apply(UUID userId, DecorationSlot slot, String unlockCode) {
        if (unlockCode == null || unlockCode.isBlank()) {
            activeRepository
                    .findById(new UserActiveDecoration.Key(userId, slot))
                    .ifPresent(activeRepository::delete);
            return active(userId);
        }

        Product product = productRepository
                .findByUnlockCodeAndActiveTrue(unlockCode)
                .orElseThrow(() -> new ApiException(
                        ErrorCode.VALIDATION_FAILED, "존재하지 않는 꾸미기예요."));

        if (product.getDecorationSlot() != slot) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "이 자리에 적용할 수 없는 꾸미기예요.");
        }
        if (!hasAccess(userId, unlockCode)) {
            throw new ApiException(ErrorCode.FORBIDDEN, "아직 보유하지 않은 꾸미기예요.");
        }

        activeRepository
                .findById(new UserActiveDecoration.Key(userId, slot))
                .ifPresentOrElse(
                        existing -> {
                            existing.reassign(unlockCode);
                            activeRepository.save(existing);
                        },
                        () -> activeRepository.save(
                                new UserActiveDecoration(userId, slot, unlockCode)));

        return active(userId);
    }

    /** This user's renderable decorations, access-filtered. */
    @Transactional(readOnly = true)
    public Map<DecorationSlot, String> active(UUID userId) {
        boolean plusActive = storeService.isPlusActive(userId);
        Set<String> owned =
                new HashSet<>(unlockRepository.findCodesByUserIdAndKind(userId, "DECORATION"));
        return resolveActive(userId, owned, plusActive);
    }

    /**
     * Same as {@link #active} for many users at once — the feed and profile
     * views need every author's decorations without an N+1.
     */
    @Transactional(readOnly = true)
    public Map<UUID, Map<DecorationSlot, String>> activeFor(Collection<UUID> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }

        Set<String> catalogCodes = new HashSet<>();
        for (Product product : productRepository
                .findByKindAndActiveTrueOrderBySortOrderAsc(ProductKind.DECORATION)) {
            if (product.getUnlockCode() != null) {
                catalogCodes.add(product.getUnlockCode());
            }
        }

        Map<UUID, Map<DecorationSlot, String>> result = new HashMap<>();
        for (UserActiveDecoration decoration : activeRepository.findByUserIds(userIds)) {
            UUID userId = decoration.getKey().getUserId();
            // Only inactive/removed catalog entries are dropped here; the
            // per-user access check happens below, once per user.
            if (!catalogCodes.contains(decoration.getUnlockCode())) {
                continue;
            }
            result.computeIfAbsent(userId, key -> new EnumMap<>(DecorationSlot.class))
                    .put(decoration.getSlot(), decoration.getUnlockCode());
        }

        Map<UUID, Map<DecorationSlot, String>> filtered = new HashMap<>();
        for (Map.Entry<UUID, Map<DecorationSlot, String>> entry : result.entrySet()) {
            UUID userId = entry.getKey();
            boolean plusActive = storeService.isPlusActive(userId);
            Set<String> owned =
                    new HashSet<>(unlockRepository.findCodesByUserIdAndKind(userId, "DECORATION"));

            Map<DecorationSlot, String> usable = new EnumMap<>(DecorationSlot.class);
            entry.getValue().forEach((slot, code) -> {
                if (plusActive || owned.contains(code)) {
                    usable.put(slot, code);
                }
            });
            if (!usable.isEmpty()) {
                filtered.put(userId, usable);
            }
        }
        return filtered;
    }

    private Map<DecorationSlot, String> resolveActive(
            UUID userId, Set<String> owned, boolean plusActive) {

        Set<String> activeCatalog = new HashSet<>();
        for (Product product : productRepository
                .findByKindAndActiveTrueOrderBySortOrderAsc(ProductKind.DECORATION)) {
            if (product.getUnlockCode() != null) {
                activeCatalog.add(product.getUnlockCode());
            }
        }

        Map<DecorationSlot, String> active = new EnumMap<>(DecorationSlot.class);
        for (UserActiveDecoration decoration : activeRepository.findByKeyUserId(userId)) {
            String code = decoration.getUnlockCode();
            if (!activeCatalog.contains(code)) {
                continue;
            }
            if (plusActive || owned.contains(code)) {
                active.put(decoration.getSlot(), code);
            }
        }
        return active;
    }

    private boolean hasAccess(UUID userId, String unlockCode) {
        if (storeService.isPlusActive(userId)) {
            return true;
        }
        return unlockRepository
                .findCodesByUserIdAndKind(userId, "DECORATION")
                .contains(unlockCode);
    }
}
