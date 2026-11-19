import { LanguageProvider } from '../src/locales/provider';
import { HomeworkDraftProvider } from '../src/features/homework/unsaved';
import { MotionProvider, useReducedMotion } from '../src/components/motion';
import { ThemeProvider, useTheme } from '../src/theme/provider';
import { AppShell } from '../src/components/app-shell';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../src/features/session';
function Navigation() {
  const { theme, dark } = useTheme();
  const reduced = useReducedMotion();
  return (
    <AppShell>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.color.background },
          headerShown: false,
          animation: reduced ? 'none' : 'fade',
          animationDuration: 200,
        }}
      />
    </AppShell>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <MotionProvider>
            <SessionProvider>
              <HomeworkDraftProvider>
                <Navigation />
              </HomeworkDraftProvider>
            </SessionProvider>
          </MotionProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
