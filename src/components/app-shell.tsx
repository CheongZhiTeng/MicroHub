import { useLanguage } from '../locales/provider';
import { View, Text, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, usePathname, type Href } from 'expo-router';
import { useSession } from '../features/session';
import { useIdentity } from '../features/identity';
import { useTheme } from '../theme/provider';
import { Brand } from './ui';
import { Icon, type IconName } from './icon';
import { ThemePicker } from './theme-picker';
import { MotionPressable } from './motion';
import type { PropsWithChildren } from 'react';
function DesktopNavigation() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { identity } = useIdentity();
  const path = usePathname();
  const member = identity?.member && identity.profile.status === 'active';
  const links: [string, Href, IconName][] = [
    [t('Home'), '/', 'home'],
    [t('Homework'), '/homework', 'homework'],
    [t('Attendance'), '/attendance', 'attendance'],
    [t('My group'), '/groups', 'members'],
    [t('More'), '/more', 'more'],
    [t('Profile'), '/profile', 'user'],
    [t('Settings'), '/settings', 'settings'],
  ];
  if (member)
    links.push(
      [t('Members'), '/members', 'members'],
      [t('Announcements'), '/announcements', 'announcement'],
      [t('Resources'), '/resources', 'book'],
      [t('Notifications'), '/notifications', 'bell'],
    );
  if (member && identity.role !== 'member')
    links.push([t('Administration'), '/administration', 'shield']);
  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left']}
      testID="desktop-sidebar"
      style={{
        width: 232,
        borderRightWidth: 1,
        borderColor: theme.color.border,
        backgroundColor: theme.color.surface,
        padding: 16,
        gap: 20,
      }}
    >
      <View style={{ height: 60 }}>
        <Brand subtitle={t('Your campus. Your people.')} />
      </View>
      <ScrollView contentContainerStyle={{ gap: 4 }}>
        {links.map(([label, href, icon]) => (
          <Link key={label} href={href} asChild>
            <MotionPressable
              accessibilityLabel={`Go to ${label}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 44,
                padding: 12,
                borderRadius: 12,
                backgroundColor:
                  path === href ? theme.color.selected : 'transparent',
              }}
            >
              <Icon name={icon} size={20} />
              <Text
                style={{
                  color: theme.color.text,
                  fontSize: 14,
                  fontWeight: path === href ? '700' : '500',
                }}
              >
                {label}
              </Text>
            </MotionPressable>
          </Link>
        ))}
      </ScrollView>
      <ThemePicker />
    </SafeAreaView>
  );
}
export function AppShell({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const { session, recovery } = useSession();
  const path = usePathname();
  const { theme } = useTheme();
  const showSidebar =
    width >= 1024 &&
    Boolean(session) &&
    !recovery &&
    !['/sign-in', '/register', '/recover'].includes(path);
  // Keep the routed subtree mounted while the window crosses breakpoints.
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        backgroundColor: theme.color.background,
      }}
    >
      {showSidebar && <DesktopNavigation />}
      <View key="content" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </View>
    </View>
  );
}
