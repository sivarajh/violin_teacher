import { Tabs } from 'expo-router/tabs';
import { Text, type ColorValue } from 'react-native';
import { useColors } from '../../theme';

function icon(glyph: string) {
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ fontSize: 20, color }} accessible={false}>{glyph}</Text>;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.wood },
        headerTintColor: c.woodInk,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Teacher', headerTitle: '🎻 Violin Teacher', tabBarIcon: icon('🎻') }} />
      <Tabs.Screen name="lessons" options={{ title: 'Lessons', tabBarIcon: icon('📖') }} />
      <Tabs.Screen name="music" options={{ title: 'My Music', tabBarIcon: icon('🎼') }} />
      <Tabs.Screen name="tuner" options={{ title: 'Tuner', tabBarIcon: icon('🎯') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
