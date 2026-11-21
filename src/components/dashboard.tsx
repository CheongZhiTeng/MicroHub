import {
  announcementsUnavailable,
  useAnnouncements,
} from '../features/announcements';
import { useState } from 'react';
import { ClassScope, useEvents } from '../features/class-scope';
import { profileName } from '../lib/profile-name';
import { useLanguage } from '../locales/provider';
import {
  useHomework,
  dueLabel,
  homeworkUnavailable,
} from '../features/homework/api';
import { ContentGrid } from './layout';
import { MotionPressable } from './motion';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { Identity } from '../features/identity';
import type { Theme } from '../theme/tokens';
import { useTheme } from '../theme/provider';
import { Icon } from './icon';
import { StudyArt } from './illustrations/campus';
import { Avatar, Body, Brand, Card, IconButton, SectionTitle } from './ui';

export function ClubHeader({ identity }: { identity: Identity | null }) {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.header}>
      <Brand subtitle={identity?.clubName ?? 'Your school club'} />
      {identity?.member && identity.profile.status === 'active' && (
        <IconButton
          icon="bell"
          label={t('Notifications')}
          onPress={() => router.push('/notifications')}
        />
      )}
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={t('My profile')}
        onPress={() => router.push('/profile')}
        style={styles.profile}
      >
        <Avatar
          name={identity ? profileName(identity.profile, language) : ''}
          size={40}
        />
      </MotionPressable>
    </View>
  );
}
export function IdentityStats({ identity }: { identity: Identity }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const items = [
    {
      icon: 'shield' as const,
      value: identity.member
        ? t('Active')
        : identity.application === 'pending'
          ? t('In review')
          : t('Not joined'),
      label: t('Membership'),
      tint: theme.color.subtle,
      ink: theme.color.primary,
    },
    {
      icon: 'user' as const,
      value: identity.profile.class_name || 'Not set',
      label: t('Your class'),
      tint: theme.color.lavender,
      ink: theme.color.violet,
    },
    {
      icon: 'members' as const,
      value:
        identity.role === 'super_admin'
          ? t('teach')
          : identity.role === 'admin'
            ? t('Admin')
            : t('Member'),
      label: t('Your role'),
      tint: theme.color.peach,
      ink: theme.color.amber,
    },
  ];
  const styles = makeStyles(theme);
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
  const { theme } = useTheme();
  const styles = makeStyles(theme);
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
export function ClubOverview({ teach = false }: { teach?: boolean }) {
  const [scope, setScope] = useState('all');
  const groups = useHomework('hw_scopes');
  const events = useEvents(scope, '', 0, true);
  const { t } = useLanguage();
  const work = useHomework(
    scope === 'all' ? 'hw_summary' : 'class_homework_summary',
    scope === 'all' ? {} : { p_scope: scope },
  );
  const announcements = useAnnouncements(0, true, scope);
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <>
      <ClassScope
        value={scope}
        change={setScope}
        groups={teach ? groups.data : []}
      />
      <ContentGrid>
        <OverviewLink
          label={t('Assignment workspace')}
          title={t('Your assignments')}
          icon="homework"
          onPress={() => router.push('/(tabs)/homework')}
        >
          <View style={styles.assignment}>
            <View style={styles.copy}>
              <Text style={styles.cardSubtitle}>
                {work.error
                  ? t(
                      work.error === homeworkUnavailable
                        ? homeworkUnavailable
                        : 'Assignments could not load',
                    )
                  : !work.data
                    ? t('Loading assignments…')
                    : (work.data.next?.title ?? t('You’re all caught up'))}
              </Text>
              {work.data && (
                <Body>
                  {work.data.todo}
                  {t(' to do                ')}
                  {work.data.next
                    ? t(' · Due ') + dueLabel(work.data.next.due_at)
                    : ''}
                </Body>
              )}
              {work.data?.pending != null && (
                <Body>
                  {work.data.submitted}
                  {t(' submitted · ')}
                  {work.data.pending}
                  {t(' awaiting review              ')}
                </Body>
              )}
            </View>
            <StudyArt />
          </View>
        </OverviewLink>
        <OverviewLink
          label={t('Attendance')}
          title={t('Attendance check-in')}
          icon="attendance"
          onPress={() => router.push('/(tabs)/attendance')}
        >
          <Body>
            {t(
              'Secure check-in is coming in MVP. Attendance is not collected yet.        ',
            )}
          </Body>
        </OverviewLink>
        <OverviewLink
          label={t('Club announcements')}
          title={t('Announcements')}
          icon="announcement"
          onPress={() => router.push('/announcements')}
        >
          {announcements.data?.items.length ? (
            announcements.data.items.map((item) => (
              <View key={item.id} style={styles.highlight}>
                <View style={styles.copy}>
                  <Text style={styles.cardSubtitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.detail}>
                    {item.group_name ?? t('Big class')}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Body>
              {t(
                announcements.error
                  ? announcements.error === announcementsUnavailable
                    ? announcementsUnavailable
                    : 'Announcements could not load.'
                  : announcements.data
                    ? 'No announcements yet.'
                    : 'Loading announcements…',
              )}
            </Body>
          )}
        </OverviewLink>
        <OverviewLink
          label={t('Your club calendar')}
          title={t('Upcoming club events')}
          icon="calendar"
          onPress={() => router.push('/(tabs)/events')}
        >
          {events.data?.length ? (
            events.data.map((e) => (
              <View key={e.id} style={styles.highlight}>
                <View style={styles.copy}>
                  <Text style={styles.cardSubtitle}>{e.title}</Text>
                  <Body>
                    {(e.group_name ?? t('Big class')) +
                      ' · ' +
                      dueLabel(e.starts_at)}
                  </Body>
                </View>
              </View>
            ))
          ) : (
            <Body>
              {t(
                events.error ??
                  (events.data ? 'No events in this view.' : 'Loading events…'),
              )}
            </Body>
          )}
        </OverviewLink>
      </ContentGrid>
    </>
  );
}
const makeStyles = (theme: Theme) =>
  StyleSheet.create({
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
      fontSize: 12,
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
