import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { StoreProduct } from '@/api';
import { copy } from '@/constants/copy';
import { analytics } from '@/lib/analytics';
import { opacity, radius, spacing, useTheme } from '@/theme';
import {
  Button,
  Card,
  ErrorState,
  Header,
  Icon,
  ListSkeleton,
  Screen,
  Text,
  useToast,
} from '@/ui';
import { useStoreCatalog, type PricedProduct } from '@/features/store/useStoreCatalog';
import { usePurchase } from '@/features/store/usePurchase';
import { useAuthStore } from '@/features/auth/authStore';

/**
 * PIXME 스토어.
 *
 * Monetisation principle, enforced by what is (and isn't) sellable here:
 * relationships are free — hearts, waves, connections, chat, the feed and the
 * square are never behind a paywall. What's on sale is self-expression:
 * extra generations, styles and decoration. Notably, we do not sell clothing
 * for the character, because the whole point is that the clothes are the ones
 * the user actually wore.
 */
export default function StoreRoute() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();

  const { catalog, isPending, isError, error, refetch } = useStoreCatalog();
  const { buy, restore, pendingProductCode } = usePurchase();
  const entitlements = useAuthStore((state) => state.user?.entitlements ?? null);

  React.useEffect(() => {
    analytics.screen('store');
  }, []);

  const onBuy = useCallback(
    async (product: StoreProduct) => {
      const outcome = await buy(product);
      if (outcome.status === 'granted') {
        router.push({
          pathname: '/store/success',
          params: { productCode: product.code },
        });
        return;
      }
      if (outcome.status === 'pending') {
        toast.show({ message: copy.store.pending });
        return;
      }
      if (outcome.status === 'cancelled') {
        toast.show(copy.store.purchaseCancelled);
        return;
      }
      toast.show({ message: outcome.message, tone: 'error' });
    },
    [buy, router, toast],
  );

  const onRestore = useCallback(async () => {
    const result = await restore();
    if (result.status === 'restored') {
      toast.show({ message: copy.store.restored, tone: 'success' });
    } else if (result.status === 'empty') {
      toast.show(copy.store.nothingToRestore);
    } else {
      toast.show({ message: copy.errors.generic, tone: 'error' });
    }
  }, [restore, toast]);

  if (isPending) {
    return (
      <Screen>
        <Header title={copy.store.title} />
        <ListSkeleton />
      </Screen>
    );
  }

  if (isError || !catalog) {
    return (
      <Screen>
        <Header title={copy.store.title} />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title={copy.store.title}
        right={
          <Text
            variant="label"
            tone="accent"
            onPress={() => void onRestore()}
            style={styles.restore}
          >
            {copy.store.restore}
          </Text>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* current balance */}
        <Card style={styles.balance}>
          <View style={styles.balanceRow}>
            <Icon name="sparkle" size={20} color={colors.accent} />
            <Text variant="bodyStrong" style={styles.balanceText}>
              생성권 {entitlements?.creditBalance ?? 0}개
            </Text>
          </View>
          <Text variant="micro" tone="tertiary">
            {entitlements?.freeGenerationAvailable
              ? '오늘 무료 생성 1회가 남아 있어요.'
              : '오늘 무료 생성을 사용했어요.'}
          </Text>
        </Card>

        {/* PIXME+ upsell */}
        {!entitlements?.plusActive && catalog.subscriptions.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.plus.title}
            onPress={() => router.push('/store/plus')}
            style={({ pressed }) => [
              styles.plusBanner,
              {
                backgroundColor: colors.accentSubtle,
                borderColor: colors.accentBorder,
                opacity: pressed ? opacity.pressed : 1,
              },
            ]}
          >
            <Icon name="crown" size={22} color={colors.accent} />
            <View style={styles.plusText}>
              <Text variant="bodyStrong">{copy.plus.title}</Text>
              <Text variant="micro" tone="secondary">
                {copy.plus.tagline}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.accent} />
          </Pressable>
        ) : null}

        <Section title={copy.store.creditsSection}>
          {catalog.creditPacks.map((product) => (
            <ProductRow
              key={product.code}
              product={product}
              busy={pendingProductCode === product.code}
              onPress={() => void onBuy(product)}
            />
          ))}
        </Section>

        {catalog.styles.length > 0 ? (
          <Section title={copy.store.stylesSection}>
            {catalog.styles.map((product) => (
              <ProductRow
                key={product.code}
                product={product}
                busy={pendingProductCode === product.code}
                onPress={() => void onBuy(product)}
              />
            ))}
          </Section>
        ) : null}

        {catalog.decorations.length > 0 ? (
          <Section title={copy.store.decorSection}>
            {catalog.decorations.map((product) => (
              <ProductRow
                key={product.code}
                product={product}
                busy={pendingProductCode === product.code}
                onPress={() => void onBuy(product)}
              />
            ))}
          </Section>
        ) : null}

        <Text variant="micro" tone="tertiary" style={styles.legal}>
          하트, 친해지고 싶어요, 연결, 대화는 언제나 무료예요. 결제는 스토어
          계정으로 진행되고, 생성에 실패하면 사용된 생성권은 자동으로 돌려드려요.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text variant="label" tone="secondary" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function ProductRow({
  product,
  busy,
  onPress,
}: {
  product: PricedProduct;
  busy: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Card style={styles.product} padded>
      <View style={styles.productBody}>
        <View style={styles.productText}>
          <View style={styles.productTitleRow}>
            <Text variant="bodyStrong">{product.name}</Text>
            {product.badge ? (
              <View
                style={[styles.badge, { backgroundColor: colors.accentSubtle }]}
              >
                <Text variant="micro" tone="accent">
                  {product.badge}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="micro" tone="secondary" style={styles.productDesc}>
            {product.description}
          </Text>
        </View>

        <Button
          label={product.owned ? '보유 중' : product.displayPrice}
          size="sm"
          variant={product.owned ? 'outline' : 'primary'}
          disabled={product.owned}
          loading={busy}
          fullWidth={false}
          onPress={onPress}
          style={styles.productButton}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  restore: { paddingHorizontal: spacing.sm },
  balance: { marginTop: spacing.base },
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  balanceText: { marginLeft: spacing.sm },
  plusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.base,
    padding: spacing.base,
    borderRadius: radius.base,
    borderWidth: StyleSheet.hairlineWidth,
  },
  plusText: { flex: 1, marginHorizontal: spacing.md },
  section: { marginTop: spacing.xl },
  sectionTitle: { marginBottom: spacing.sm },
  product: { marginBottom: spacing.sm },
  productBody: { flexDirection: 'row', alignItems: 'center' },
  productText: { flex: 1, marginRight: spacing.md },
  productTitleRow: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  productDesc: { marginTop: spacing.xxs },
  productButton: { minWidth: 86 },
  legal: { marginTop: spacing.xl },
});
