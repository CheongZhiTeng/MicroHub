import { MotionProvider, useReducedMotion } from '../src/components/motion';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../src/features/session';
function Navigation() {
  const reduced = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: reduced ? 'none' : 'fade',
        animationDuration: 200,
      }}
    />
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <MotionProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <Navigation />
        </SessionProvider>
      </MotionProvider>
    </SafeAreaProvider>
  );
}
