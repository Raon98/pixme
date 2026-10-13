package app.pixme.store.repository;

import java.util.List;
import java.util.Optional;

import app.pixme.store.domain.Product;
import app.pixme.store.domain.ProductKind;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, String> {

    List<Product> findByActiveTrueOrderByKindAscSortOrderAsc();

    List<Product> findByKindAndActiveTrueOrderBySortOrderAsc(ProductKind kind);

    Optional<Product> findByUnlockCodeAndActiveTrue(String unlockCode);

    /**
     * Resolves a product from a store SKU. Needed by "구매 복원", where the
     * client only has the store's product id and not our internal code.
     */
    @Query("""
            select p from Product p
            where p.iosProductId = :storeProductId or p.androidProductId = :storeProductId
            """)
    Optional<Product> findByStoreProductId(@Param("storeProductId") String storeProductId);
}
