import { useCallback, useState } from 'react';
import { uuid } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { Access } from '../src/features/access';
import { eventsInRange, type ClassEvent } from '../src/features/class-scope';
import { client } from '../src/lib/supabase';
import { useLanguage } from '../src/locales/provider';
import {
  Button,
  Card,
  Body,
  Field,
  Screen,
  Notice,
} from '../src/components/ui';
import {
  dateInput,
  parseDate,
  useHomework,
  useHomeworkAction,
} from '../src/features/homework/api';
import {
  Choices,
  Messages,
  FetchState,
} from '../src/features/homework/controls';

import { useFormExit } from '../src/features/form-exit';
import { useFocusedQuery } from '../src/features/focused-query';
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
  const exit = useFormExit(
    cancel ||
      event.title !== initial.title ||
      event.location !== initial.location ||
      event.description !== initial.description ||
      start !== dateInput(initial.starts_at) ||
      end !== dateInput(initial.ends_at) ||
      audience !== initialAudience,
  );
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
      exit.finish();
      done(true);
    });
  return (
    <Card>
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
      {exit.dialog}
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

function Editor({ id, day }: { id?: string; day?: string }) {
  const groups = useHomework('hw_scopes');
  const [empty] = useState<ClassEvent>(() => ({
    id: uuid.v4(),
    group_id: null,
    group_name: null,
    title: '',
    location: '',
    description: '',
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString(),
    revision: 0,
    cancelled: false,
  }));
  const load = useFocusedQuery(
    useCallback(async () => {
      if (!id) return empty;
      const start = Date.parse((day ?? '') + 'T00:00:00+08:00');
      if (!Number.isFinite(start)) throw Error('Event unavailable.');
      const events = await eventsInRange(
        'all',
        new Date(start).toISOString(),
        new Date(start + 86400000).toISOString(),
      );
      const event = events.find((e) => e.id === id && !e.cancelled);
      if (!event) throw Error('Event unavailable.');
      return event;
    }, [id, day, empty]),
  );
  if (!load.data) return <FetchState error={load.error} retry={load.refresh} />;
  if (!groups.data)
    return <FetchState error={groups.error} retry={groups.refresh} />;
  return (
    <EventForm
      initial={load.data}
      initialAudience={load.data.group_id ?? (id ? 'big' : '')}
      groups={groups.data}
      done={(saved) => {
        if (saved) router.replace('/events');
        else if (router.canGoBack()) router.back();
        else router.replace('/events');
      }}
    />
  );
}
export default function EventEditor() {
  const { t } = useLanguage();
  const { id, mode } = useLocalSearchParams<{ id?: string; mode?: string }>();
  return (
    <Screen title={t(id ? 'Edit event' : 'New event')}>
      <Access member signInParams={{ next: 'event-editor', id, mode }}>
        {(user) =>
          user.role === 'super_admin' ? (
            <Editor key={user.profile.id + (id ?? '')} id={id} day={mode} />
          ) : (
            <Notice error text={t('Active teach access required')} />
          )
        }
      </Access>
    </Screen>
  );
}
