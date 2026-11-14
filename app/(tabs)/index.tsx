import { router } from 'expo-router';
import { useState } from 'react';
import {
  Body,
  Button,
  Card,
  Heading,
  Loading,
  Notice,
  Screen,
} from '../../src/components/ui';
import { useIdentity } from '../../src/features/identity';
import { client } from '../../src/lib/supabase';
import { errorMessage } from '../../src/lib/validation';
export default function Home() {
  const { identity, loading, error, reload } = useIdentity();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const apply = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { error } = await client().rpc('apply_for_membership');
      if (error) throw error;
      await reload();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      title={identity?.clubName ?? 'Your club'}
      subtitle="A private space for your school community."
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
            <Card>
              <Heading>
                {identity.profile.display_name
                  ? `Hello, ${identity.profile.display_name}`
                  : 'Make yourself at home'}
              </Heading>
              <Body>
                Student {identity.profile.student_id} ·{' '}
                {identity.profile.class_name ||
                  'Add your class in your profile'}
              </Body>
            </Card>
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
              <Card>
                <Heading>You’re part of the club</Heading>
                <Body>
                  Your membership is active. Your member directory is ready;
                  homework and attendance are the next MVP modules.
                </Body>
                <Button
                  title="Meet the members"
                  onPress={() => router.push('/members')}
                />
                {identity.role !== 'member' && (
                  <Button
                    title="Review membership applications"
                    secondary
                    onPress={() => router.push('/administration')}
                  />
                )}
              </Card>
            )}
          </>
        )
      )}
      {message && <Notice error text={message} />}
    </Screen>
  );
}
