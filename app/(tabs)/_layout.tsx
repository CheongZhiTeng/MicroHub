import { MotionPressable } from '../../src/components/motion';
import { Redirect, Tabs } from 'expo-router';
import { Icon } from '../../src/components/icon';
import { Loading, Screen } from '../../src/components/ui';
import { useSession } from '../../src/features/session';
import { useTheme } from '../../src/theme/provider';
import { useWindowDimensions } from 'react-native';
import { en } from '../../src/locales/en';
export default function TabsLayout() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
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
        tabBarButton: ({
          children,
          onPress,
          onLongPress,
          accessibilityLabel,
          accessibilityState,
          testID,
          style,
        }) => (
          <MotionPressable
            accessibilityRole="tab"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={accessibilityState}
            testID={testID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={[
              style,
              { borderRadius: 16, overflow: 'hidden', paddingHorizontal: 0 },
            ]}
          >
            {children}
          </MotionPressable>
        ),
        tabBarActiveTintColor: theme.color.primary,
        tabBarInactiveTintColor: theme.color.muted,
        tabBarActiveBackgroundColor: theme.color.selected,
        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 1,
          paddingVertical: 7,
        },
        tabBarLabelStyle: {
          fontFamily: theme.font,
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarStyle: {
          display: width >= 1024 ? 'none' : 'flex',
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 8,
          paddingHorizontal: 8,
          minHeight: 76,
        },
      }}
    >
      {(
        [
          ['index', en.home, 'home'],
          ['homework', en.homework, 'homework'],
          ['attendance', en.attendance, 'attendance'],
          ['events', en.events, 'calendar'],
          ['more', en.more, 'more'],
        ] as const
      ).map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => (
              <Icon name={icon} color={color} size={23} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
