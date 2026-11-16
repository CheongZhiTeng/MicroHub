import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Access } from '../features/access';
import { theme } from '../theme/tokens';
import { Icon, type IconName } from './icon';
import { Badge, Body, Button, Card, Heading, Screen } from './ui';

export const modules = {
  homework: {
    title: 'Assignments',
    subtitle: 'A little progress, every week.',
    icon: 'homework',
    phase: 'MVP',
    heading: 'Your next chapter starts here',
    description:
      'Assignment creation, submissions and private feedback are being prepared. Assignments cannot be created or submitted yet.',
  },
  attendance: {
    title: 'Attendance',
    subtitle: 'Every meeting brings us closer.',
    icon: 'attendance',
    phase: 'MVP',
    heading: 'See you at the next meeting',
    description:
      'Secure six-digit check-in and your personal attendance history are being prepared. Attendance is not being collected yet.',
  },
  events: {
    title: 'Club events',
    subtitle: 'Make room for something inspiring.',
    icon: 'calendar',
    phase: 'V1',
    heading: 'Good things are on the calendar',
    description:
      'The calendar, event registration and recurring meetings will be available after the MVP review. Event listings are not available yet.',
  },
  announcements: {
    title: 'Announcements',
    subtitle: 'Stay close to your club.',
    icon: 'announcement',
    phase: 'V1',
    heading: 'A home for club updates',
    description:
      'Publishing announcements, discussions and reactions will be available in V1. There is no announcement feed in this version.',
  },
  notifications: {
    title: 'Notifications',
    subtitle: 'The updates that matter to you.',
    icon: 'bell',
    phase: 'V1',
    heading: 'Keep up, without the noise',
    description:
      'Your notification inbox and push reminders are planned for V1. Notifications are not being delivered by the app yet.',
  },
  resources: {
    title: 'Learning resources',
    subtitle: 'Explore. Learn. Build something new.',
    icon: 'book',
    phase: 'V2',
    heading: 'Room for your next big idea',
    description:
      'A shared library for useful links, guides and learning materials is planned for V2. Resource uploads are not available yet.',
  },
  submissions: {
    title: 'My submissions',
    subtitle: 'Your work, all in one place.',
    icon: 'homework',
    phase: 'MVP',
    heading: 'Make your work count',
    description:
      'Text, link and file submissions will be available with the assignment module. No work can be submitted in this version.',
  },
} satisfies Record<
  string,
  {
    title: string;
    subtitle: string;
    icon: IconName;
    phase: string;
    heading: string;
    description: string;
  }
>;
export type ModuleName = keyof typeof modules;
export function PlannedModule({ name }: { name: ModuleName }) {
  const module = modules[name];
  return (
    <Screen title={module.title} subtitle={module.subtitle}>
      <Access member>
        {() => (
          <>
            <Card>
              <View style={styles.illustration}>
                <Icon name={module.icon} size={54} />
                <View style={styles.smallIcon}>
                  <Icon name="code" size={24} />
                </View>
              </View>
              <Badge label={`Coming in ${module.phase}`} />
              <Heading>{module.heading}</Heading>
              <Body>{module.description}</Body>
              {name === 'homework' && (
                <Button
                  title="My submissions"
                  secondary
                  onPress={() => router.push('/submissions')}
                />
              )}
            </Card>
          </>
        )}
      </Access>
      <Button
        title="Back to home"
        secondary
        onPress={() => router.replace('/(tabs)')}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  illustration: {
    width: 128,
    height: 128,
    borderRadius: 40,
    backgroundColor: theme.color.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 22,
  },
  smallIcon: {
    position: 'absolute',
    right: -8,
    bottom: 2,
    backgroundColor: theme.color.surface,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.border,
    transform: [{ rotate: '-10deg' }],
  },
});
