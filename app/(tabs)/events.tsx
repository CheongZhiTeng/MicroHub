import { useState } from 'react';
import { uuid } from 'expo';
import { router } from 'expo-router';
import { Access } from '../../src/features/access';
import {
  ClassScope,
  useEvents,
  type ClassEvent,
} from '../../src/features/class-scope';
import { client } from '../../src/lib/supabase';
import { useLanguage } from '../../src/locales/provider';
import {
  Button,
  Card,
  Body,
  Heading,
  Field,
  Screen,
  Notice,
  Badge,
} from '../../src/components/ui';
import {
  dateInput,
  dueLabel,
  parseDate,
  useHomework,
  useHomeworkAction,
} from '../../src/features/homework/api';
import {
  Choices,
  Paging,
  Messages,
  FetchState,
} from '../../src/features/homework/controls';

function EventForm({
  initial,
  initialAudience,
  groups,
  done,
}: {
  initial: ClassEvent;
  initialAudience: string;
  groups: { id: string; name: string }[];
  done: (saved: boolean) => void;
}) {
  const { t } = useLanguage();
  const action = useHomeworkAction();
  const [event, setEvent] = useState(initial),
    [start, setStart] = useState(dateInput(initial.starts_at)),
    [end, setEnd] = useState(dateInput(initial.ends_at));
  const [audience, setAudience] = useState(initialAudience);
  const [cancel, setCancel] = useState(false);
  const save = () =>
    action.run(async () => {
      const from = parseDate(start),
        until = parseDate(end);
      if (until <= from) throw Error('End must follow start.');
      const { error } = await client().rpc('class_event_save', {
        p_id: event.id,
        p_group: audience === 'big' ? null : audience,
        p_revision: event.revision,
        p_title: event.title,
        p_location: event.location,
        p_description: event.description,
        p_start: from,
        p_end: until,
        p_cancel: cancel,
      });
      if (error) throw error;
      done(true);
    });
  return (
    <Card>
      <Heading>{t(event.revision ? 'Edit event' : 'New event')}</Heading>
      <Body>{t('Recipients')}</Body>
      <Choices
        disabled={!!event.revision || action.busy}
        items={[
          ['big', t('Big class')],
          ...groups.map((g) => [g.id, g.name] as const),
        ]}
        value={audience}
        onChange={setAudience}
      />
      <Field
        label={t('Title')}
        value={event.title}
        maxLength={160}
        onChangeText={(title) => setEvent({ ...event, title })}
      />
      <Field
        label={t('Starts (MYT)')}
        value={start}
        onChangeText={setStart}
        hint="YYYY-MM-DD HH:mm"
      />
      <Field
        label={t('Ends (MYT)')}
        value={end}
        onChangeText={setEnd}
        hint="YYYY-MM-DD HH:mm"
      />
      <Field
        label={t('Location')}
        value={event.location}
        maxLength={200}
        onChangeText={(location) => setEvent({ ...event, location })}
      />
      <Field
        label={t('Event details')}
        value={event.description}
        multiline
        maxLength={10000}
        onChangeText={(description) => setEvent({ ...event, description })}
      />
      {cancel && (
        <Notice text={t('Members will see this event as cancelled.')} />
      )}
      <Messages action={action} />
      <Button
        title={t(cancel ? 'Confirm cancellation' : 'Save event')}
        disabled={!event.title.trim() || !audience}
        busy={action.busy}
        onPress={save}
      />
      {!!event.revision && !cancel && (
        <Button
          title={t('Cancel event')}
          variant="danger"
          onPress={() => setCancel(true)}
        />
      )}
      <Button
        title={t('Back to calendar')}
        disabled={action.busy}
        variant="ghost"
        onPress={() => done(false)}
      />
    </Card>
  );
}
function Calendar({ teach }: { teach: boolean }) {
  const { t } = useLanguage();
  const [scope, setScope] = useState('all'),
    [day, setDay] = useState(''),
    [page, setPage] = useState(0),
    [draft, setDraft] = useState<ClassEvent | null>(null);
  const events = useEvents(scope, day, page),
    groups = useHomework('hw_scopes');
  if (draft && teach)
    return (
      <EventForm
        initial={draft}
        initialAudience={
          draft.group_id ?? (draft.revision || scope === 'big' ? 'big' : '')
        }
        groups={groups.data ?? []}
        done={(saved) => {
          setDraft(null);
          if (saved) {
            setPage(0);
            void events.refresh();
          }
        }}
      />
    );
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
        <Field
          label={t('Event date (MYT)')}
          hint={t('YYYY-MM-DD · Leave blank for upcoming events.')}
          value={day}
          onChangeText={(s) => {
            setDay(s);
            setPage(0);
          }}
        />
        {teach && (
          <Button
            title={t('New event')}
            onPress={() =>
              setDraft({
                id: uuid.v4(),
                group_id: groups.data?.find((g) => g.id === scope)?.id ?? null,
                group_name: null,
                title: '',
                location: '',
                description: '',
                starts_at: new Date().toISOString(),
                ends_at: new Date(Date.now() + 3600000).toISOString(),
                revision: 0,
                cancelled: false,
              })
            }
          />
        )}
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
                <Button title={t('Edit event')} onPress={() => setDraft(e)} />
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
