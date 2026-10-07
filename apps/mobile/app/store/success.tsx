import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { copy } from '@/constants/copy';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/theme';
import { Button, Screen, Text } from '@/ui';
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

  const { catalog } = useStoreCatalog();
  const entitlements = useAuthStore((state) => state.user?.entitlements ?? null);

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

  return (
    <Screen
      background="elevated"
      footer={
        <View>
          <Button
            label={isSubscription ? copy.common.confirm : copy.today.emptyCta}
            onPress={() => {
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
              ? `${product.name} 구독이 시작됐어요.`
              : product.creditAmount
                ? `생성권 ${product.creditAmount}개가 추가됐어요.`
                : `${product.name}을(를) 사용할 수 있어요.`
            : '구매가 완료됐어요.'}
        </Text>

        {entitlements ? (
          <Text variant="caption" tone="tertiary" align="center" style={styles.balance}>
            지금 보유한 생성권 {entitlements.creditBalance}개
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
