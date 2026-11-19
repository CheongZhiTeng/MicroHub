import { ThemePicker } from '../src/components/theme-picker';
import { router } from 'expo-router';
import { Access } from '../src/features/access';
import { Body, Button, Card, Screen, SectionTitle } from '../src/components/ui';
export default function Settings() {
  return (
    <Screen title="Settings" subtitle="Your MicroHub experience.">
      <Access>
        {() => (
          <>
            <Card>
              <SectionTitle icon="settings">Appearance & language</SectionTitle>
              <Body>Choose your look. System follows your device.</Body>
              <ThemePicker />
              <Body>English · Simplified Chinese is planned for V1.</Body>
            </Card>
            <Card>
              <SectionTitle icon="shield">Account & privacy</SectionTitle>
              <Body>
                Your school email verifies your identity. Club access is managed
                separately by your administrators.
              </Body>
              <Button
                title="Edit profile"
                variant="secondary"
                onPress={() => router.push('/profile')}
              />
              <Body>
                For account concerns or a deletion request, contact your school
                club administrator. In-app deletion requests are planned for V2.
              </Body>
            </Card>
          </>
        )}
      </Access>
      <Button
        title="Back to More"
        variant="secondary"
        onPress={() => router.replace('/(tabs)/more')}
      />
    </Screen>
  );
}
