import { useCallback } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { copy } from '@/constants/copy';
import { config } from '@/lib/config';
import { radius, spacing, useTheme } from '@/theme';
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
import { useStoreCatalog } from '@/features/store/useStoreCatalog';
import { usePurchase } from '@/features/store/usePurchase';
import { useAuthStore } from '@/features/auth/authStore';

/**
 * PIXME+ subscription.
 *
 * Benefits and price come from the server catalog, never from constants in the
 * app — so we can change the offer, run a regional price, or add a benefit
 * without an app release.
 */
export default function PlusRoute() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();

  const { catalog, isPending, isError, error, refetch } = useStoreCatalog();
  const { buy, pendingProductCode } = usePurchase();
  const user = useAuthStore((state) => state.user);

  const plusActive = user?.entitlements.plusActive ?? false;
  const product = catalog?.subscriptions[0] ?? null;

  const onSubscribe = useCallback(async () => {
    if (!product) return;
    const outcome = await buy(product);
    if (outcome.status === 'granted') {
      router.replace({
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
  }, [buy, product, router, toast]);

  const openManage = useCallback(() => {
    const url =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
    void Linking.openURL(url);
  }, []);

  if (isPending) {
    return (
      <Screen>
        <Header title={copy.plus.title} />
        <ListSkeleton />
      </Screen>
    );
  }

  if (isError || !catalog) {
    return (
      <Screen>
        <Header title={copy.plus.title} />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        plusActive ? (
          <View>
            <Button
              label={copy.plus.manage}
              variant="outline"
              onPress={openManage}
            />
            {/* Shown to subscribers too: the renewal terms are exactly what
                someone already paying needs to be able to find. */}
            <Text variant="micro" tone="tertiary" align="center" style={styles.legal}>
              {copy.plus.legal}
            </Text>
          </View>
        ) : (
          <View>
            <Button
              label={copy.plus.cta}
              disabled={!product}
              loading={pendingProductCode === product?.code}
              onPress={() => void onSubscribe()}
            />
            {/* Price *and* billing period adjacent to the CTA — Apple rejects
                a subscription that advertises a price without its length. */}
            {product ? (
              <Text variant="caption" align="center" style={styles.priceLine}>
                {copy.plus.priceLine(product.displayPrice)}
              </Text>
            ) : null}
            <Text variant="micro" tone="tertiary" align="center" style={styles.legal}>
              {copy.plus.legal}
            </Text>
          </View>
        )
      }
    >
      <Header title={copy.plus.title} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.accentSubtle, borderColor: colors.accentBorder },
          ]}
        >
          <Icon name="crown" size={34} color={colors.accent} />
          <Text variant="title1" align="center" style={styles.heroTitle}>
            {copy.plus.title}
          </Text>
          <Text variant="body" tone="secondary" align="center">
            {copy.plus.tagline}
          </Text>
          {plusActive && user?.entitlements.plusExpiresAt ? (
            <Text variant="micro" tone="accent" style={styles.active}>
              {copy.plus.activeUntil(
                user.entitlements.plusExpiresAt.slice(0, 10),
              )}
            </Text>
          ) : null}
        </View>

        <View style={styles.benefits}>
          {catalog.plusBenefits.map((benefit) => (
            <Card key={benefit.code} style={styles.benefit}>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitEmoji}>{benefit.emoji}</Text>
                <View style={styles.benefitText}>
                  <Text variant="bodyStrong">{benefit.title}</Text>
                  <Text variant="micro" tone="secondary" style={styles.benefitDesc}>
                    {benefit.description}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        <Text variant="micro" tone="tertiary" style={styles.note}>
          {copy.plus.note}
        </Text>

        <View style={styles.legalLinks}>
          <Pressable
            hitSlop={12}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(config.links.terms)}
          >
            <Text variant="micro" tone="secondary" style={styles.legalLink}>
              {copy.settings.terms}
            </Text>
          </Pressable>
          <Pressable
            hitSlop={12}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(config.links.privacy)}
          >
            <Text variant="micro" tone="secondary" style={styles.legalLink}>
              {copy.settings.privacy}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  hero: {
    alignItems: 'center',
    marginTop: spacing.base,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroTitle: { marginTop: spacing.md },
  active: { marginTop: spacing.md },
  benefits: { marginTop: spacing.xl },
  benefit: { marginBottom: spacing.sm },
  benefitRow: { flexDirection: 'row', alignItems: 'center' },
  benefitEmoji: { fontSize: 24, marginRight: spacing.md },
  benefitText: { flex: 1 },
  benefitDesc: { marginTop: spacing.xxs },
  note: { marginTop: spacing.lg },
  priceLine: { marginTop: spacing.sm },
  legal: { marginTop: spacing.sm },
  // Apple requires an auto-renewable subscription screen to link both the
  // terms and the privacy policy, not just one.
  legalLinks: {
    flexDirection: 'row',
    gap: spacing.base,
    marginTop: spacing.base,
  },
  legalLink: { textDecorationLine: 'underline' },
});
