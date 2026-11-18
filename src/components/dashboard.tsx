import { MotionPressable } from './motion';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { Identity } from '../features/identity';
import { theme } from '../theme/tokens';
import { Icon } from './icon';
import { StudyArt } from './illustrations/campus';
import { Avatar, Body, Brand, Card, IconButton, SectionTitle } from './ui';

export function ClubHeader({ identity }: { identity: Identity | null }) {
  return (
    <View style={styles.header}>
      <Brand subtitle={identity?.clubName ?? 'Your school club'} />
      {identity?.member && identity.profile.status === 'active' && (
        <IconButton
          icon="bell"
          label="Notifications"
          onPress={() => router.push('/notifications')}
        />
      )}
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel="My profile"
        onPress={() => router.push('/profile')}
        style={styles.profile}
      >
        <Avatar name={identity?.profile.display_name ?? ''} size={40} />
      </MotionPressable>
    </View>
  );
}
export function IdentityStats({ identity }: { identity: Identity }) {
  const items = [
    {
      icon: 'shield' as const,
      value: identity.member
        ? 'Active'
        : identity.application === 'pending'
          ? 'In review'
          : 'Not joined',
      label: 'Membership',
      tint: theme.color.subtle,
      ink: theme.color.primary,
    },
    {
      icon: 'user' as const,
      value: identity.profile.class_name || 'Not set',
      label: 'Your class',
      tint: theme.color.lavender,
      ink: theme.color.violet,
    },
    {
      icon: 'members' as const,
      value:
        identity.role === 'super_admin'
          ? 'Super admin'
          : identity.role === 'admin'
            ? 'Admin'
            : 'Member',
      label: 'Your role',
      tint: theme.color.peach,
      ink: theme.color.amber,
    },
  ];
  return (
    <View style={styles.stats}>
      {items.map((item, index) => (
        <Card
          key={item.label}
          delay={index * 45}
          style={[
            styles.stat,
            { backgroundColor: item.tint, borderColor: item.tint },
          ]}
        >
          <Icon name={item.icon} size={20} color={item.ink} />
          <Text style={styles.statValue}>{item.value}</Text>
          <Text style={styles.statLabel}>{item.label}</Text>
        </Card>
      ))}
    </View>
  );
}
function OverviewLink({
  label,
  title,
  icon,
  onPress,
  children,
}: React.PropsWithChildren<{
  label: string;
  title: string;
  icon: import('./icon').IconName;
  onPress: () => void;
}>) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.7 }}
    >
      <Card
        style={[
          styles.overviewCard,
          {
            borderTopWidth: 3,
            borderTopColor:
              icon === 'homework'
                ? theme.color.violet
                : icon === 'calendar'
                  ? theme.color.blue
                  : icon === 'announcement'
                    ? theme.color.amber
                    : theme.color.primary,
          },
        ]}
        delay={icon === 'homework' ? 60 : 100}
      >
        <View style={styles.cardHeading}>
          <View style={styles.copy}>
            <SectionTitle icon={icon}>{title}</SectionTitle>
          </View>
          <Icon name="chevron" size={18} color={theme.color.muted} />
        </View>
        {children}
      </Card>
    </MotionPressable>
  );
}
export function ClubOverview() {
  return (
    <>
      <OverviewLink
        label="Assignment workspace"
        title="Your assignments"
        icon="homework"
        onPress={() => router.push('/(tabs)/homework')}
      >
        <View style={styles.assignment}>
          <View style={styles.copy}>
            <Text style={styles.cardSubtitle}>Your next challenge awaits</Text>
            <Body>Submission tools are coming in MVP.</Body>
          </View>
          <StudyArt />
        </View>
      </OverviewLink>
      <OverviewLink
        label="Attendance"
        title="Attendance check-in"
        icon="attendance"
        onPress={() => router.push('/(tabs)/attendance')}
      >
        <Body>
          Secure check-in is coming in MVP. Attendance is not collected yet.
        </Body>
      </OverviewLink>
      <OverviewLink
        label="Club announcements"
        title="Announcements"
        icon="announcement"
        onPress={() => router.push('/announcements')}
      >
        <View style={styles.highlight}>
          <Icon name="announcement" size={20} />
          <View style={styles.copy}>
            <Text style={styles.cardSubtitle}>Stay connected to your club</Text>
            <Text style={styles.detail}>Club updates arrive in V1.</Text>
          </View>
        </View>
      </OverviewLink>
      <OverviewLink
        label="Your club calendar"
        title="Upcoming club events"
        icon="calendar"
        onPress={() => router.push('/(tabs)/events')}
      >
        <View style={styles.eventRow}>
          <View style={styles.eventIcon}>
            <Icon name="calendar" />
          </View>
          <View style={styles.copy}>
            <Text style={styles.cardSubtitle}>
              Make time for your community
            </Text>
            <Text style={styles.detail}>
              Calendar and registration arrive in V1.
            </Text>
          </View>
        </View>
      </OverviewLink>
    </>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  profile: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 12,
    gap: 6,
  },
  statValue: {
    fontFamily: theme.font,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    color: theme.color.text,
  },
  statLabel: {
    fontFamily: theme.font,
    fontSize: 11,
    color: theme.color.muted,
    textAlign: 'center',
  },
  assignment: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flex: 1, gap: 10 },
  overviewCard: { padding: 14, gap: 8 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardSubtitle: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: theme.color.text,
  },
  detail: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 19,
    color: theme.color.muted,
  },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventIcon: {
    padding: 10,
    backgroundColor: theme.color.subtle,
    borderRadius: 12,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    backgroundColor: theme.color.subtle,
    borderRadius: theme.radii.control,
    paddingHorizontal: 10,
  },
});
