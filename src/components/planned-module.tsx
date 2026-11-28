import { useLanguage } from '../locales/provider';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Access } from '../features/access';
import type { Theme } from '../theme/tokens';
import { useTheme } from '../theme/provider';
import { Icon, type IconName } from './icon';
import { Badge, Body, Button, Card, Heading, Screen } from './ui';

export const modules = {
  events: {
    title: 'Club events',
    subtitle: 'Make room for something inspiring.',
    icon: 'calendar',
    phase: 'V1',
    heading: 'Good things are on the calendar',
    description:
      'The calendar, event registration and recurring meetings will be available after the MVP review. Event listings are not available yet.',
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
  const { t } = useLanguage();
  const module = modules[name];
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Screen title={t(module.title)} subtitle={t(module.subtitle)}>
      <Access member>
        {() => (
          <>
            <Card>
              <View
                style={[
                  styles.illustration,
                  {
                    backgroundColor:
                      name === 'events'
                        ? theme.color.sky
                        : name === 'resources'
                          ? theme.color.peach
                          : theme.color.subtle,
                  },
                ]}
              >
                <Icon name={module.icon} size={54} />
                <View style={styles.smallIcon}>
                  <Icon name="code" size={24} />
                </View>
              </View>
              <Badge
                label={t('Coming in {phase}').replace('{phase}', module.phase)}
              />
              <Heading>{t(module.heading)}</Heading>
              <Body>{t(module.description)}</Body>
            </Card>
          </>
        )}
      </Access>
      <Button
        title={t('Back to home')}
        variant="secondary"
        onPress={() => router.replace('/(tabs)')}
      />
    </Screen>
  );
}
const makeStyles = (theme: Theme) =>
  StyleSheet.create({
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
