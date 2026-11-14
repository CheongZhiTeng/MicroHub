import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Loading, Screen } from '../../src/components/ui';
import { useSession } from '../../src/features/session';
import { theme } from '../../src/theme/tokens';
import { en } from '../../src/locales/en';
export default function TabsLayout() {
  const { session, loading, recovery } = useSession();
  if (loading)
    return (
      <Screen title="MicroHub">
        <Loading />
      </Screen>
    );
  if (!session) return <Redirect href="/sign-in" />;
  if (recovery) return <Redirect href="/recover" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.primary,
        tabBarInactiveTintColor: theme.color.muted,
        tabBarStyle: { backgroundColor: theme.color.surface },
      }}
    >
      {(
        [
          ['index', en.home, '⌂'],
          ['homework', en.homework, '▤'],
          ['attendance', en.attendance, '✓'],
          ['events', en.events, '▦'],
          ['more', en.more, '•••'],
        ] as const
      ).map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 22 }}>{icon}</Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
