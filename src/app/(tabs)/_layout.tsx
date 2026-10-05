import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { View, type ColorValue } from 'react-native';

import { C, useWide } from '@/ui';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (on: IconName, off: IconName) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? on : off} color={color as string} size={24} />;
  };

// Workout is an action, not a destination: a raised accent button that opens the focused workout flow.
function WorkoutIcon() {
  return (
    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginTop: -10,
      shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
      <Ionicons name="barbell" size={24} color="#fff" />
    </View>
  );
}

export default function TabsLayout() {
  const wide = useWide();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarPosition: wide ? 'left' : 'bottom',
      tabBarVariant: wide ? 'material' : 'uikit',
      tabBarActiveTintColor: C.accent,
      tabBarInactiveTintColor: C.faint,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarStyle: { backgroundColor: C.card, borderColor: C.border },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="workout" options={{ title: 'Workout', tabBarIcon: wide ? icon('barbell', 'barbell-outline') : WorkoutIcon }}
        listeners={{ tabPress: (e) => { e.preventDefault(); router.push('/workout'); } }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('stats-chart', 'stats-chart-outline') }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person', 'person-outline') }} />
      <Tabs.Screen name="nutrition" options={{ href: null }} />
    </Tabs>
  );
}
