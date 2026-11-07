import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from '../state/store';
import { useColors } from '../theme';

function Toast() {
  const { toast } = useStore();
  const c = useColors();
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 72, alignItems: 'center' }}>
      <View accessibilityLiveRegion="polite" style={{ backgroundColor: c.wood, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, maxWidth: 520 }}>
        <Text style={{ color: '#fff', fontSize: 15 }}>{toast}</Text>
      </View>
    </View>
  );
}

function RootStack() {
  const c = useColors();
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.wood },
          headerTintColor: c.woodInk,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Violin Teacher' }} />
        <Stack.Screen name="lesson/[id]" options={{ title: 'Lesson' }} />
        <Stack.Screen name="practice/[kind]/[id]" options={{ title: 'Practice' }} />
        <Stack.Screen name="edit/[id]" options={{ title: 'Notes' }} />
      </Stack>
      <Toast />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <RootStack />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
