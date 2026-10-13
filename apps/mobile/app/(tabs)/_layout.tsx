import { Tabs } from 'expo-router/js-tabs';

import { copy } from '@/constants/copy';
import { TabBar } from '@/features/navigation/TabBar';

/**
 * Tab order matches the product spec: Today | Square | ＋ | Chats | MY.
 * The centre action lives in `TabBar`, not here, because it opens a modal
 * flow rather than switching tabs.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, lazy: true }}
    >
      <Tabs.Screen name="index" options={{ title: copy.today.title }} />
      <Tabs.Screen name="square" options={{ title: copy.square.tabTitle }} />
      <Tabs.Screen name="chats" options={{ title: copy.chat.title }} />
      <Tabs.Screen name="my" options={{ title: 'MY' }} />
    </Tabs>
  );
}
