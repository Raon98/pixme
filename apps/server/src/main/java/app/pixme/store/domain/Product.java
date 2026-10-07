package app.pixme.store.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Catalog entry.
 *
 * <p>{@code fallbackPriceKrw} is a display value only — the app always prefers
 * the store's localised price. Prices live in App Store Connect / Play Console
 * and in this table, never in client or server code, so repricing and new
 * markets don't need a release.
 */
@Entity
@Table(name = "products")
@Getter
@NoArgsConstructor
public class Product {

    @Id
    @Column(name = "code", nullable = false, length = 48)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 24)
    private ProductKind kind;

    @Column(name = "ios_product_id", length = 128)
    private String iosProductId;

    @Column(name = "android_product_id", length = 128)
    private String androidProductId;

    @Column(name = "name", nullable = false, length = 64)
    private String name;

    @Column(name = "description", nullable = false, length = 255)
    private String description;

    @Column(name = "fallback_price_krw", nullable = false)
    private int fallbackPriceKrw;

    /** Credits granted by a CREDIT_PACK, or the monthly grant of a SUBSCRIPTION. */
    @Column(name = "credit_amount")
    private Integer creditAmount;

    /** Style or decoration unlocked, for non-consumables. */
    @Column(name = "unlock_code", length = 48)
    private String unlockCode;

    @Column(name = "badge", length = 24)
    private String badge;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    public String storeProductId(StorePlatform platform) {
        return platform == StorePlatform.IOS ? iosProductId : androidProductId;
    }

    public boolean isConsumable() {
        return kind == ProductKind.CREDIT_PACK;
    }
}
