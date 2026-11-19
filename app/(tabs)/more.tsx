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
        <Avatar name={identity?.profile.display_name ?? ''} size={56} />
        <Heading>
          {identity?.profile.display_name || 'Make yourself at home'}
        </Heading>
        <NavigationRow
          icon="user"
          title="My profile"
          subtitle="Your name, class and school identity"
          onPress={() => router.push('/profile')}
        />
        {identity?.member && identity.profile.status === 'active' && (
          <NavigationRow
            icon="members"
            title="Member directory"
            subtitle="Get to know your club"
            onPress={() => router.push('/members')}
          />
        )}
        {identity?.member &&
          identity.profile.status === 'active' &&
          identity.role !== 'member' && (
            <NavigationRow
              icon="shield"
              title="Administration"
              subtitle="Review membership applications"
              onPress={() => router.push('/administration')}
            />
          )}
        {identity?.member && identity.profile.status === 'active' && (
          <>
            <NavigationRow
              icon="announcement"
              title="Announcements"
              onPress={() => router.push('/announcements')}
            />
            <NavigationRow
              icon="bell"
              title="Notifications"
              onPress={() => router.push('/notifications')}
            />
            <NavigationRow
              icon="book"
              title="Resources"
              onPress={() => router.push('/resources')}
            />
          </>
        )}
        <NavigationRow
          icon="settings"
          title="Settings"
          onPress={() => router.push('/settings')}
        />
        <Button
          icon="logout"
          title="Sign out of this device"
          variant="secondary"
          busy={busy}
          onPress={() => void signOut()}
        />
        {Boolean(error) && <Notice error text={error} />}
      </Card>
      <Card>
        <SectionTitle icon="code">Made for your community</SectionTitle>
        <Body>Foundation build · 0.1.0</Body>
        <Body>
          Announcements, notifications and language options arrive in V1.
          Learning resources arrive in V2.
        </Body>
        <Body>
          For privacy or account concerns, contact your school club
          administrator.
        </Body>
      </Card>
    </Screen>
  );
}
