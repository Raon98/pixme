import { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { copy } from '@/constants/copy';
import { analytics } from '@/lib/analytics';
import { storage, StorageKey } from '@/lib/storage';
import { radius, spacing, useTheme } from '@/theme';
import { Button, Screen, Text } from '@/ui';

import { OnboardingArt } from '../src/features/onboarding/OnboardingArt';

const { width } = Dimensions.get('window');

/**
 * Three pages, no more. The product explains itself the first time someone
 * makes a PIXME, so onboarding only has to set expectations: it's your photo,
 * it becomes a pixel character, and reactions are light.
 */
export default function OnboardingRoute() {
  const router = useRouter();
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const isLast = page === copy.onboarding.length - 1;

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      if (next !== page) setPage(next);
    },
    [page],
  );

  const onPrimary = useCallback(async () => {
    if (!isLast) {
      scrollRef.current?.scrollTo({ x: width * (page + 1), animated: true });
      return;
    }
    await storage.setItem(StorageKey.OnboardingSeen, true);
    analytics.track('ONBOARDING_COMPLETED');
    router.replace('/login');
  }, [isLast, page, router]);

  return (
    <Screen
      gutter={false}
      footer={
        <Button
          label={isLast ? copy.onboardingCta : copy.common.next}
          onPress={() => void onPrimary()}
        />
      }
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {copy.onboarding.map((item, index) => (
          <View key={item.title} style={[styles.page, { width }]}>
            <OnboardingArt index={index} />
            <Text variant="title1" align="center" style={styles.title}>
              {item.title}
            </Text>
            <Text
              variant="body"
              tone="secondary"
              align="center"
              style={styles.body}
            >
              {item.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {copy.onboarding.map((item, index) => (
          <View
            key={item.title}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === page ? colors.accent : colors.borderStrong,
                width: index === page ? 18 : 6,
              },
            ]}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  title: { marginTop: spacing.xxl },
  body: { marginTop: spacing.base },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  dot: {
    height: 6,
    borderRadius: radius.full,
    marginHorizontal: spacing.xs,
  },
});
