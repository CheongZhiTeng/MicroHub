import { useLanguage } from '../src/locales/provider';
import { ThemePicker } from '../src/components/theme-picker';
import { router } from 'expo-router';
import { Access } from '../src/features/access';
import { Body, Button, Card, Screen, SectionTitle } from '../src/components/ui';
export default function Settings() {
  const { t } = useLanguage();
  return (
    <Screen title={t('Settings')} subtitle={t('Your MicroHub experience.')}>
      <Access>
        {() => (
          <>
            <Card>
              <SectionTitle icon="settings">
                {t('Appearance & language')}
              </SectionTitle>
              <Body>{t('Choose your look. System follows your device.')}</Body>
              <ThemePicker />
            </Card>
            <Card>
              <SectionTitle icon="shield">
                {t('Account & privacy')}
              </SectionTitle>
              <Body>
                {t(
                  'Your school email verifies your identity. Club access is managed separately by your administrators.              ',
                )}
              </Body>
              <Button
                title={t('Edit profile')}
                variant="secondary"
                onPress={() => router.push('/profile')}
              />
              <Body>
                {t(
                  'For account concerns or a deletion request, contact your school club administrator. In-app deletion requests are planned for V2.              ',
                )}
              </Body>
            </Card>
          </>
        )}
      </Access>
      <Button
        title={t('Back to More')}
        variant="secondary"
        onPress={() => router.replace('/(tabs)/more')}
      />
    </Screen>
  );
}
