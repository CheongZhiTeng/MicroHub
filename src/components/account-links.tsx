import { useState } from 'react';
import { router, type Href } from 'expo-router';
import { useLanguage } from '../locales/provider';
import { useBusy } from '../features/busy';
import type { Identity } from '../features/identity';
import { client } from '../lib/supabase';
import { errorMessage } from '../lib/validation';
import { NavigationRow, Button, Notice } from './ui';
export function AccountLinks({
  identity,
  close,
}: {
  identity: Identity | null;
  close?: () => void;
}) {
  const { t } = useLanguage();
  function go(href: Href) {
    close?.();
    router.push(href);
  }
  const [error, setError] = useState('');
  const { busy, start, finish } = useBusy();
  const signOut = async () => {
    if (!start()) return;
    try {
      const { error } = await client().auth.signOut({ scope: 'local' });
      if (error) throw error;
      close?.();
      router.replace('/sign-in');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      finish();
    }
  };
  return (
    <>
      <NavigationRow
        icon="user"
        title={t('My profile')}
        subtitle={t('Your name, class and school identity')}
        onPress={() => go('/profile')}
      />
      {identity?.member && identity.profile.status === 'active' && (
        <NavigationRow
          icon="members"
          title={t('Member directory')}
          subtitle={t('Get to know your club')}
          onPress={() => go('/members')}
        />
      )}
      {identity?.member &&
        identity.profile.status === 'active' &&
        identity.role !== 'member' && (
          <NavigationRow
            icon="shield"
            title={t('Administration')}
            subtitle={t('Review membership applications')}
            onPress={() => go('/administration')}
          />
        )}
      {identity?.member && identity.profile.status === 'active' && (
        <>
          {identity.role === 'super_admin' && (
            <>
              <NavigationRow
                icon="calendar"
                title={t('New event')}
                onPress={() => go('/event-editor')}
              />
              <NavigationRow
                icon="calendar"
                title={t('Manage events')}
                onPress={() => go('/events')}
              />
            </>
          )}
          <NavigationRow
            icon="announcement"
            title={t('Announcements')}
            onPress={() => go('/announcements')}
          />
          <NavigationRow
            icon="bell"
            title={t('Notifications')}
            onPress={() => go('/notifications')}
          />
          <NavigationRow
            icon="book"
            title={t('Resources')}
            onPress={() => go('/resources')}
          />
        </>
      )}
      <NavigationRow
        icon="settings"
        title={t('Settings')}
        onPress={() => go('/settings')}
      />
      <Button
        icon="logout"
        title={t('Sign out of this device')}
        variant="secondary"
        busy={busy}
        onPress={() => void signOut()}
      />
      {Boolean(error) && <Notice error text={error} />}
    </>
  );
}
