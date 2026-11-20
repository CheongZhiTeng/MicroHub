import { profileName } from '../../src/lib/profile-name';
import { useLanguage } from '../../src/locales/provider';
import { useBusy } from '../../src/features/busy';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Body,
  Button,
  Card,
  Notice,
  Screen,
  NavigationRow,
  SectionTitle,
  Avatar,
  Heading,
} from '../../src/components/ui';
import { useIdentity } from '../../src/features/identity';
import { client } from '../../src/lib/supabase';
import { errorMessage } from '../../src/lib/validation';
export default function More() {
  const { t, language } = useLanguage();
  const { identity } = useIdentity();
  const [error, setError] = useState('');
  const { busy, start, finish } = useBusy();
  const signOut = async () => {
    if (!start()) return;
    try {
      const { error } = await client().auth.signOut({ scope: 'local' });
      if (error) throw error;
      router.replace('/sign-in');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      finish();
    }
  };
  return (
    <Screen title={t('Your space')}>
      <Card>
        <Avatar
          name={identity ? profileName(identity.profile, language) : ''}
          size={56}
        />
        <Heading>
          {(identity && profileName(identity.profile, language)) ||
            'Make yourself at home'}
        </Heading>
        <NavigationRow
          icon="user"
          title={t('My profile')}
          subtitle={t('Your name, class and school identity')}
          onPress={() => router.push('/profile')}
        />
        {identity?.member && identity.profile.status === 'active' && (
          <NavigationRow
            icon="members"
            title={t('Member directory')}
            subtitle={t('Get to know your club')}
            onPress={() => router.push('/members')}
          />
        )}
        {identity?.member &&
          identity.profile.status === 'active' &&
          identity.role !== 'member' && (
            <NavigationRow
              icon="shield"
              title={t('Administration')}
              subtitle={t('Review membership applications')}
              onPress={() => router.push('/administration')}
            />
          )}
        {identity?.member && identity.profile.status === 'active' && (
          <>
            <NavigationRow
              icon="members"
              title={t('My group')}
              onPress={() => router.push('/groups')}
            />
            <NavigationRow
              icon="announcement"
              title={t('Announcements')}
              onPress={() => router.push('/announcements')}
            />
            <NavigationRow
              icon="bell"
              title={t('Notifications')}
              onPress={() => router.push('/notifications')}
            />
            <NavigationRow
              icon="book"
              title={t('Resources')}
              onPress={() => router.push('/resources')}
            />
          </>
        )}
        <NavigationRow
          icon="settings"
          title={t('Settings')}
          onPress={() => router.push('/settings')}
        />
        <Button
          icon="logout"
          title={t('Sign out of this device')}
          variant="secondary"
          busy={busy}
          onPress={() => void signOut()}
        />
        {Boolean(error) && <Notice error text={error} />}
      </Card>
      <Card>
        <SectionTitle icon="code">{t('Made for your community')}</SectionTitle>
        <Body>Foundation build · 0.1.0</Body>
        <Body>
          {t(
            'Announcements and notifications arrive in V1. Learning resources arrive in V2.',
          )}
        </Body>
        <Body>
          {t(
            'For privacy or account concerns, contact your school club administrator.        ',
          )}
        </Body>
      </Card>
    </Screen>
  );
}
