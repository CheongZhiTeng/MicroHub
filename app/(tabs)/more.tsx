import { useBusy } from '../../src/features/busy';
import { router } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Card, Notice, Screen } from '../../src/components/ui';
import { useIdentity } from '../../src/features/identity';
import { client } from '../../src/lib/supabase';
import { errorMessage } from '../../src/lib/validation';
export default function More() {
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
    <Screen title="Your space">
      <Card>
        <Button title="My profile" onPress={() => router.push('/profile')} />
        {identity?.member && identity.profile.status === 'active' && (
          <Button
            title="Member directory"
            secondary
            onPress={() => router.push('/members')}
          />
        )}
        {identity?.member &&
          identity.profile.status === 'active' &&
          identity.role !== 'member' && (
            <Button
              title="Administration"
              secondary
              onPress={() => router.push('/administration')}
            />
          )}
        <Button
          title="Sign out of this device"
          secondary
          busy={busy}
          onPress={() => void signOut()}
        />
        {Boolean(error) && <Notice error text={error} />}
      </Card>
      <Card>
        <Body>Foundation build · 0.1.0</Body>
        <Body>
          Announcements, notifications, language and theme settings arrive in
          V1. Learning resources arrive in V2.
        </Body>
        <Body>
          For privacy or account concerns, contact your school club
          administrator.
        </Body>
      </Card>
    </Screen>
  );
}
