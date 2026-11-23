import { AccountLinks } from '../../src/components/account-links';
import { profileName } from '../../src/lib/profile-name';
import { useLanguage } from '../../src/locales/provider';
import {
  Body,
  Card,
  Screen,
  SectionTitle,
  Avatar,
  Heading,
} from '../../src/components/ui';
import { useIdentity } from '../../src/features/identity';
export default function More() {
  const { t, language } = useLanguage();
  const { identity } = useIdentity();
  return (
    <Screen title={t('Your space')}>
      <Card>
        <Avatar
          owner={identity?.profile.id}
          version={identity?.profile.avatar_id}
          name={identity ? profileName(identity.profile, language) : ''}
          size={56}
        />
        <Heading>
          {(identity && profileName(identity.profile, language)) ||
            'Make yourself at home'}
        </Heading>
        <AccountLinks identity={identity} />
      </Card>
      <Card>
        <SectionTitle icon="code">{t('Made for your community')}</SectionTitle>
        <Body>Foundation build · 0.1.0</Body>
        <Body>{t('Homework reminders are available in Notifications.')}</Body>
        <Body>
          {t(
            'For privacy or account concerns, contact your school club administrator.        ',
          )}
        </Body>
      </Card>
    </Screen>
  );
}
