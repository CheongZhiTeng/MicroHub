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
  const { identity, loading, error, reload } = useIdentity();
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
        identity?.profile.display_name
          ? `Welcome back, ${identity.profile.display_name.split(' ')[0]}!`
          : 'Welcome to your club'
      }
      subtitle="A place to learn, collaborate, and grow together."
    >
      {loading ? (
        <Loading />
      ) : error ? (
        <>
          <Notice error text={error} />
          <Button title="Retry" onPress={() => void reload()} />
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
                  text="Your account is suspended. Contact your school club administrator."
                />
              </Card>
            ) : !identity.member ? (
              <Card>
                <Heading>Become a member</Heading>
                <Body>
                  Complete your profile, then request approval from a club
                  administrator.
                </Body>
                <Button
                  title="Edit profile"
                  secondary
                  onPress={() => router.push('/profile')}
                />
                {identity.application === 'pending' ? (
                  <>
                    <Notice text="Your application is waiting for review." />
                    <Button
                      title="Check application status"
                      secondary
                      onPress={() => void reload()}
                    />
                  </>
                ) : (
                  <>
                    {identity.application === 'rejected' && (
                      <Notice text="Your previous application was declined. Contact your administrator or apply again after 24 hours." />
                    )}
                    <Button
                      title="Apply for membership"
                      busy={busy}
                      onPress={() => void apply()}
                    />
                  </>
                )}
              </Card>
            ) : (
              <>
                <ClubOverview />
                <Card>
                  <Heading>Your community</Heading>
                  <NavigationRow
                    icon="members"
                    title="Meet the members"
                    onPress={() => router.push('/members')}
                  />
                  {identity.role !== 'member' && (
                    <NavigationRow
                      icon="shield"
                      title="Review membership applications"
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
