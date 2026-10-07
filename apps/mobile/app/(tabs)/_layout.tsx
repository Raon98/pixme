import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/features/navigation/TabBar';

/**
 * Tab order matches the product spec: 오늘 | 광장 | ＋ | 대화 | MY.
 * The centre action lives in `TabBar`, not here, because it opens a modal
 * flow rather than switching tabs.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, lazy: true }}
    >
      <Tabs.Screen name="index" options={{ title: '오늘' }} />
      <Tabs.Screen name="square" options={{ title: '광장' }} />
      <Tabs.Screen name="chats" options={{ title: '대화' }} />
      <Tabs.Screen name="my" options={{ title: 'MY' }} />
    </Tabs>
  );
}
