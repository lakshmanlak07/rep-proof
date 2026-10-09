import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { View, type ColorValue } from 'react-native';

import { font } from '@/theme/tokens';
import { C, useWide } from '@/ui';

type IconName = keyof typeof Ionicons.glyphMap;
// Active tab: icon on a burgundy-50 pill, label in burgundy. Inactive: muted outline icon.
const icon = (on: IconName, off: IconName) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <View style={{ width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? C.accentSoft : 'transparent' }}>
        <Ionicons name={focused ? on : off} color={color as string} size={22} />
      </View>
    );
  };

// Five tabs (Design System v1.0): Home, Train, Fuel, Progress, Learn. Account lives behind the avatar on Home.
// Route files keep their names: Train is the plan, Fuel is nutrition, Learn is the science library.
export default function TabsLayout() {
  const wide = useWide();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarPosition: wide ? 'left' : 'bottom',
      tabBarVariant: wide ? 'material' : 'uikit',
      tabBarActiveTintColor: C.accent,
      tabBarInactiveTintColor: C.muted,
      tabBarLabelStyle: { fontFamily: font.bodyBold, fontSize: 12 },
      tabBarStyle: wide
        ? { backgroundColor: C.card, borderColor: C.border, width: 248 }
        : { backgroundColor: C.card, borderTopColor: C.border, height: 84, paddingTop: 8 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="plan" options={{ title: 'Train', tabBarIcon: icon('barbell', 'barbell-outline') }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Fuel', tabBarIcon: icon('restaurant', 'restaurant-outline') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('stats-chart', 'stats-chart-outline') }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: icon('book', 'book-outline') }} />
      {/* Reachable but not in the bar: the account screen (avatar on Home). */}
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
