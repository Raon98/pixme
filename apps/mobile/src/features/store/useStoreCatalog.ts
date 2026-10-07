import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { qk, storeApi, type StoreCatalog, type StoreProduct } from '@/api';
import { formatKrw } from '@/lib/format';

import { connect, loadPrices, type StorePrice } from './billing';

export interface PricedProduct extends StoreProduct {
  /** Localised store price when available, otherwise the server fallback. */
  displayPrice: string;
  priceSource: 'store' | 'fallback';
}

/**
 * Merges the server catalog (source of truth for what exists, ownership and
 * ordering) with the store's localised prices. Prices are never hardcoded in
 * the app: a KRW change, a new market, or a promo is a store + config change.
 */
export function useStoreCatalog() {
  const query = useQuery({
    queryKey: qk.store.catalog(),
    queryFn: () => storeApi.catalog(),
    staleTime: 5 * 60_000,
  });

  const [prices, setPrices] = useState<Record<string, StorePrice>>({});

  useEffect(() => {
    const catalog = query.data;
    if (!catalog) return;

    let cancelled = false;
    void (async () => {
      await connect();
      const consumableIds = [
        ...catalog.creditPacks,
        ...catalog.styles,
        ...catalog.decorations,
      ].map((product) => product.storeProductId);
      const subscriptionIds = catalog.subscriptions.map(
        (product) => product.storeProductId,
      );

      const loaded = await loadPrices({ consumableIds, subscriptionIds });
      if (!cancelled) setPrices(loaded);
    })();

    return () => {
      cancelled = true;
    };
  }, [query.data]);

  const priced = useMemo(() => {
    if (!query.data) return null;
    const decorate = (products: StoreProduct[]): PricedProduct[] =>
      products.map((product) => {
        const storePrice = prices[product.storeProductId];
        return {
          ...product,
          displayPrice:
            storePrice?.displayPrice ?? formatKrw(product.fallbackPriceKrw),
          priceSource: storePrice ? 'store' : 'fallback',
        };
      });

    const catalog: StoreCatalog = query.data;
    return {
      creditPacks: decorate(catalog.creditPacks),
      styles: decorate(catalog.styles),
      decorations: decorate(catalog.decorations),
      subscriptions: decorate(catalog.subscriptions),
      plusBenefits: catalog.plusBenefits,
    };
  }, [prices, query.data]);

  return { ...query, catalog: priced };
}
