import { hasBilingualNames, profileName } from '../../src/lib/profile-name';
import { useLanguage } from '../../src/locales/provider';
import {
  ClubHeader,
  ClubOverview,
  IdentityStats,
} from '../../src/components/dashboard';
import { useBusy } from '../../src/features/busy';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Body,
  Button,
  Card,
  Heading,
  NavigationRow,
  Loading,
  Notice,
  Screen,
} from '../../src/components/ui';
import { useIdentity } from '../../src/features/identity';
import { client } from '../../src/lib/supabase';
import { errorMessage } from '../../src/lib/validation';
export default function Home() {
  const { t, language } = useLanguage();
  const { identity, loading, error, reload } = useIdentity();
  const name = identity ? profileName(identity.profile, language) : '';
  const { busy, start, finish } = useBusy();
  const [message, setMessage] = useState('');
  const apply = async () => {
    if (!start()) return;
    setMessage('');
    try {
      const { error } = await client().rpc('apply_for_membership');
      if (error) throw error;
      await reload();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      finish();
    }
  };
  return (
    <Screen
      dashboard
      header={<ClubHeader identity={identity} />}
      title={
        name
          ? t('Welcome back, {name}!').replace('{name}', name)
          : t('Welcome to your club')
      }
      subtitle={t('A place to learn, collaborate, and grow together.')}
    >
      {loading ? (
        <Loading />
      ) : error ? (
        <>
          <Notice error text={error} />
          <Button title={t('Retry')} onPress={() => void reload()} />
        </>
      ) : (
        identity && (
          <>
            {identity.profile.status === 'active' && (
              <IdentityStats identity={identity} />
            )}
            {identity.profile.status === 'suspended' ? (
              <Card>
                <Notice
                  error
                  text={t(
                    'Your account is suspended. Contact your school club administrator.',
                  )}
                />
              </Card>
            ) : !identity.member ? (
              <Card>
                <Heading>{t('Become a member')}</Heading>
                <Body>
                  {t(
                    hasBilingualNames(identity.profile)
                      ? 'Complete your profile, then request approval from a club administrator.'
                      : 'Enter your name and class before applying for membership.',
                  )}
                </Body>
                <Button
                  title={t('Edit profile')}
                  variant="secondary"
                  onPress={() => router.push('/profile')}
                />
                {identity.application === 'pending' ? (
                  <>
                    <Notice
                      text={t('Your application is waiting for review.')}
                    />
                    <Button
                      title={t('Check application status')}
                      variant="secondary"
                      onPress={() => void reload()}
                    />
                  </>
                ) : (
                  <>
                    {identity.application === 'rejected' && (
                      <Notice
                        text={t(
                          'Your previous application was declined. Contact your administrator or apply again after 24 hours.',
                        )}
                      />
                    )}
                    <Button
                      title={t('Apply for membership')}
                      busy={busy}
                      onPress={() => void apply()}
                    />
                  </>
                )}
              </Card>
            ) : (
              <>
                <ClubOverview teach={identity.role === 'super_admin'} />
                <Card>
                  <Heading>{t('Your community')}</Heading>
                  <NavigationRow
                    icon="members"
                    title={t('Meet the members')}
                    onPress={() => router.push('/members')}
                  />
                  {identity.role !== 'member' && (
                    <NavigationRow
                      icon="shield"
                      title={t('Review membership applications')}
                      onPress={() => router.push('/administration')}
                    />
                  )}
                </Card>
              </>
            )}
          </>
        )
      )}
      {Boolean(message) && <Notice error text={message} />}
    </Screen>
  );
}
