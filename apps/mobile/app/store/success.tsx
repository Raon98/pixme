import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { copy } from '@/constants/copy';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/theme';
import { Button, Screen, Text, useToast } from '@/ui';
import { slotForUnlockCode } from '@/features/decorations/catalog';
import { useApplyDecoration } from '@/features/decorations/useDecorations';
import { useStoreCatalog } from '@/features/store/useStoreCatalog';
import { useAuthStore } from '@/features/auth/authStore';

/**
 * Purchase confirmation. Says exactly what the user now has, then sends them
 * straight into using it — a receipt screen that dead-ends is a wasted moment.
 */
export default function PurchaseSuccessRoute() {
  const { productCode } = useLocalSearchParams<{ productCode?: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const toast = useToast();
  const { catalog } = useStoreCatalog();
  const entitlements = useAuthStore((state) => state.user?.entitlements ?? null);
  const applyDecoration = useApplyDecoration();

  const product = useMemo(() => {
    if (!catalog || !productCode) return null;
    return (
      [
        ...catalog.creditPacks,
        ...catalog.styles,
        ...catalog.decorations,
        ...catalog.subscriptions,
      ].find((item) => item.code === productCode) ?? null
    );
  }, [catalog, productCode]);

  useEffect(() => {
    haptics.celebrate();
  }, []);

  const isSubscription = product?.kind === 'SUBSCRIPTION';
  const decorationSlot =
    product?.kind === 'DECORATION' && product.unlockCode
      ? slotForUnlockCode(product.unlockCode)
      : null;

  return (
    <Screen
      background="elevated"
      footer={
        <View>
          <Button
            label={
              decorationSlot
                ? copy.store.applyNow
                : isSubscription
                  ? copy.common.confirm
                  : copy.today.emptyCta
            }
            loading={applyDecoration.isPending}
            onPress={() => {
              if (decorationSlot && product?.unlockCode) {
                applyDecoration.mutate(
                  { slot: decorationSlot, unlockCode: product.unlockCode },
                  {
                    onSuccess: () => {
                      toast.show({ message: copy.store.applied, tone: 'success' });
                      router.replace('/(tabs)/my');
                    },
                  },
                );
                return;
              }
              if (isSubscription) router.replace('/(tabs)/my');
              else router.replace('/create');
            }}
          />
          <Button
            label={copy.common.close}
            variant="ghost"
            onPress={() => router.replace('/(tabs)')}
            style={styles.ghost}
          />
        </View>
      }
    >
      <View style={styles.body}>
        <Animated.View
          entering={ZoomIn.duration(300)}
          style={[
            styles.badge,
            { backgroundColor: colors.connectionSubtle, borderColor: colors.connection },
          ]}
        >
          <Text style={styles.glyph}>✨</Text>
        </Animated.View>

        <Text variant="title1" align="center" style={styles.title}>
          {copy.store.successTitle}
        </Text>

        <Text
          variant="body"
          tone="secondary"
          align="center"
          style={styles.detail}
        >
          {product
            ? isSubscription
              ? copy.store.subscriptionStarted(product.name)
              : product.creditAmount
                ? copy.store.creditsAdded(product.creditAmount)
                : copy.store.itemReady(product.name)
            : copy.store.purchaseDone}
        </Text>

        {entitlements ? (
          <Text variant="caption" tone="tertiary" align="center" style={styles.balance}>
            {copy.store.balanceNow(entitlements.creditBalance)}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    width: 108,
    height: 108,
    borderRadius: radius.xxl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 44 },
  title: { marginTop: spacing.xl },
  detail: { marginTop: spacing.md, maxWidth: 280 },
  balance: { marginTop: spacing.lg },
  ghost: { marginTop: spacing.xs },
});
