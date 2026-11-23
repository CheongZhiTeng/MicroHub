import { useCreationScope } from '../src/features/daily';
import { useState } from 'react';
import { router } from 'expo-router';
import { Access } from '../src/features/access';
import { ClassScope, useEvents } from '../src/features/class-scope';

import { useLanguage } from '../src/locales/provider';
import {
  Button,
  Card,
  Body,
  Heading,
  Field,
  Screen,
  Notice,
  Badge,
} from '../src/components/ui';
import { useHomework } from '../src/features/homework/api';
import { Paging, FetchState } from '../src/features/homework/controls';

function Calendar({ teach }: { teach: boolean }) {
  const { t, dueLabel } = useLanguage();
  const [scope, setScope] = useState('all'),
    [day, setDay] = useState(''),
    [page, setPage] = useState(0);
  const creationScope = useCreationScope(scope);
  const events = useEvents(scope, day, page),
    groups = useHomework('hw_scopes');
  return (
    <>
      <Card>
        <ClassScope
          value={scope}
          change={(s) => {
            setScope(s);
            setPage(0);
          }}
          groups={teach ? groups.data : []}
        />
        {teach && (
          <Button
            disabled={!creationScope}
            title={t('New event')}
            onPress={() =>
              router.push({
                pathname: '/event-editor',
                params: { scope: creationScope },
              })
            }
          />
        )}
        <Field
          label={t('Event date (MYT)')}
          hint={t('YYYY-MM-DD · Leave blank for upcoming events.')}
          value={day}
          onChangeText={(s) => {
            setDay(s);
            setPage(0);
          }}
        />
      </Card>
      {!events.data ? (
        <FetchState error={events.error} retry={events.refresh} />
      ) : (
        <>
          {!events.data.length && <Body>{t('No events in this view.')}</Body>}
          {events.data.slice(0, 20).map((e) => (
            <Card key={e.id}>
              <Badge label={e.group_name ?? t('Big class')} />
              <Heading>{e.title}</Heading>
              {e.cancelled && <Notice text={t('Cancelled')} />}
              <Body>
                {dueLabel(e.starts_at)} – {dueLabel(e.ends_at)}
              </Body>
              {!!e.location && <Body>{e.location}</Body>}
              {!!e.description && <Body>{e.description}</Body>}
              {teach && !e.cancelled && (
                <Button
                  title={t('Edit event')}
                  onPress={() =>
                    router.push({
                      pathname: '/event-editor',
                      params: {
                        id: e.id,
                        mode: new Date(Date.parse(e.starts_at) + 8 * 3600000)
                          .toISOString()
                          .slice(0, 10),
                      },
                    })
                  }
                />
              )}
            </Card>
          ))}
          <Paging page={page} count={events.data.length} onChange={setPage} />
        </>
      )}
      <Button title={t('Refresh')} variant="ghost" onPress={events.refresh} />
    </>
  );
}
export default function Events() {
  const { t } = useLanguage();
  return (
    <Screen title={t('Club events')}>
      <Access member signInParams={{ next: 'events' }}>
        {(user) => (
          <Calendar key={user.profile.id} teach={user.role === 'super_admin'} />
        )}
      </Access>
      <Button
        title={t('Back to home')}
        onPress={() => router.replace('/(tabs)')}
      />
    </Screen>
  );
}
