import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { haptics } from '@/lib/haptics';
import { layout, opacity, radius, shadow, spacing, useTheme, zIndex } from '@/theme';
import { Badge, Icon, Text, type IconName } from '@/ui';

import { useTodayStatus } from '../feed/useTodayFeed';
import { useNotificationBadge } from '../notifications/useNotifications';

const TAB_META: Record<string, { label: string; icon: IconName }> = {
  index: { label: '오늘', icon: 'today' },
  square: { label: '광장', icon: 'square' },
  chats: { label: '대화', icon: 'chat' },
  my: { label: 'MY', icon: 'user' },
};

/**
 * Custom tab bar: 오늘 | 광장 | ＋ | 대화 | MY
 *
 * The centre "＋" is not a tab — it is a raised action that opens the create
 * flow as a modal. Making it a route would mean the user could "be on" the
 * create tab with nothing to do there, and would lose the daily affordance of
 * a button that visibly wants to be pressed. When today's PIXME is still
 * missing, it carries a dot — the one nudge the app gives per day.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const todayStatus = useTodayStatus();
  const badge = useNotificationBadge();

  const needsTodayPixel = todayStatus.data
    ? todayStatus.data.myTodayPost === null
    : false;

  const routes = state.routes.filter((route) => TAB_META[route.name]);
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const meta = TAB_META[route.name];
    if (!meta) return null;

    const routeIndex = state.routes.findIndex((item) => item.key === route.key);
    const focused = state.index === routeIndex;

    const unread =
      route.name === 'chats' ? (badge.data?.unreadMessages ?? 0) : 0;

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        onPress={() => {
          haptics.tap();
          if (!focused) {
            navigation.navigate(route.name);
          } else {
            // Tapping the active tab scrolls it to top / refreshes.
            navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
          }
        }}
        style={({ pressed }) => [
          styles.tab,
          pressed ? { opacity: opacity.pressed } : null,
        ]}
      >
        <View>
          <Icon
            name={meta.icon}
            size={24}
            color={focused ? colors.tabIconActive : colors.tabIcon}
            strokeWidth={focused ? 2.3 : 1.9}
          />
          {unread > 0 ? (
            <View style={styles.tabBadge}>
              <Badge count={unread} />
            </View>
          ) : null}
        </View>
        <Text
          variant="micro"
          tone={focused ? 'default' : 'tertiary'}
          style={styles.tabLabel}
        >
          {meta.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.root,
        {
          paddingBottom: insets.bottom,
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
        },
      ]}
    >
      <View style={styles.row}>
        {left.map(renderTab)}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="PIXME 만들기"
          onPress={() => {
            haptics.tap();
            router.push('/create');
          }}
          style={({ pressed }) => [
            styles.createWrap,
            pressed ? { transform: [{ scale: 0.95 }] } : null,
          ]}
        >
          <View
            style={[
              styles.create,
              { backgroundColor: colors.accent, shadowColor: colors.accent },
            ]}
          >
            <Icon name="plus" size={26} color={colors.textOnAccent} />
          </View>
          {needsTodayPixel ? (
            <View style={styles.createDot}>
              <Badge dot tone="heart" />
            </View>
          ) : null}
        </Pressable>

        {right.map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: zIndex.tabBar,
    ...(Platform.OS === 'android' ? { elevation: 12 } : null),
  },
  row: {
    height: layout.tabBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { marginTop: 2 },
  tabBadge: { position: 'absolute', top: -4, right: -10 },
  createWrap: { width: 76, alignItems: 'center', justifyContent: 'center' },
  create: {
    width: layout.createButtonSize,
    height: layout.createButtonSize,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadow.md,
    shadowOpacity: 0.3,
  },
  createDot: { position: 'absolute', top: -2, right: 14 },
});
