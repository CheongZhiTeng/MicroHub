import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { uuid } from 'expo';
import { Access } from '../src/features/access';
import {
  Screen,
  Body,
  Button,
  Card,
  Field,
  Heading,
  Notice,
} from '../src/components/ui';
import { useLanguage } from '../src/locales/provider';
import {
  attendance,
  useAttendanceRead,
  type EventAttendanceSetup,
} from '../src/features/attendance/api';
import { AttendanceSession } from '../src/features/attendance/session';
import {
  Choices,
  FetchState,
  Messages,
} from '../src/features/homework/controls';
import { useHomeworkAction } from '../src/features/homework/api';
function Create({
  eventId,
  setup,
  onConflict,
}: {
  eventId?: string;
  setup?: EventAttendanceSetup;
  onConflict?: () => Promise<void>;
}) {
  const { t } = useLanguage(),
    act = useHomeworkAction();
  const scopes = useAttendanceRead(
    useCallback(
      () => (setup ? Promise.resolve([]) : attendance('attendance_scopes')),
      [setup],
    ),
  );
  const [id] = useState(() => uuid.v4()),
    [title, setTitle] = useState(''),
    [minutes, setMinutes] = useState('10'),
    [scope, setScope] = useState(''),
    [created, setCreated] = useState<{ id: string; code?: string } | null>(
      null,
    );
  if (created)
    return <AttendanceSession id={created.id} initialCode={created.code} />;
  const chosen = scopes.data?.find((g) => (g.id ?? 'big') === scope);
  return (
    <>
      <Card>
        {setup ? (
          <>
            <Heading>{setup.title}</Heading>
            <Body>{setup.class_name ?? t('Big class')}</Body>
          </>
        ) : (
          <Field
            label={t('Session title')}
            value={title}
            maxLength={120}
            onChangeText={setTitle}
          />
        )}
        <Field
          label={t('Check-in duration (minutes)')}
          value={minutes}
          keyboardType="number-pad"
          onChangeText={setMinutes}
        />
        {!setup && (
          <>
            <Body>{t('Choose a class')}</Body>
            {scopes.data ? (
              <Choices
                items={scopes.data.map((g) => [
                  g.id ?? 'big',
                  g.id ? g.name : t('Big class'),
                ])}
                value={scope}
                onChange={setScope}
              />
            ) : (
              <FetchState error={scopes.error} retry={scopes.refresh} />
            )}
          </>
        )}
        {(setup || chosen) && (
          <Body>
            {t('Expected students')} · {setup?.students ?? chosen?.students}
          </Body>
        )}
        <Button
          title={t('Start check-in')}
          busy={act.busy}
          disabled={
            (!setup && (!title.trim() || !chosen)) ||
            !/^\d{1,3}$/.test(minutes) ||
            +minutes < 1 ||
            +minutes > 120
          }
          onPress={() =>
            void act.run(async () => {
              try {
                if (eventId && setup) {
                  const opened = await attendance('attendance_open_event', {
                    p_event: eventId,
                    p_id: id,
                    p_revision: setup.revision,
                    p_minutes: Number(minutes),
                    p_expected: setup.students,
                  });
                  setCreated({ id: opened.session_id, code: opened.code });
                  return;
                }
                if (!chosen) return;
                const code = await attendance('attendance_open', {
                  p_id: id,
                  p_group: chosen.id,
                  p_title: title.trim(),
                  p_minutes: Number(minutes),
                  p_expected: chosen.students,
                });
                setCreated({ id, code: code ?? '' });
              } catch (e) {
                if (onConflict) await onConflict();
                else await scopes.refresh();
                throw e;
              }
            })
          }
        />
        <Messages action={act} />
      </Card>
      <Button
        title={t('Back to attendance')}
        variant="ghost"
        onPress={() => router.replace('/(tabs)/attendance')}
      />
    </>
  );
}
function EventAttendance({ id }: { id: string }) {
  const { t } = useLanguage();
  const event = useAttendanceRead(
    useCallback(() => attendance('attendance_event', { p_event: id }), [id]),
  );
  if (!event.data)
    return <FetchState error={event.error} retry={event.refresh} />;
  if (event.data.session_id)
    return <AttendanceSession id={event.data.session_id} />;
  if (event.data.setup)
    return (
      <Create
        eventId={id}
        setup={event.data.setup}
        onConflict={event.refresh}
      />
    );
  return (
    <Card>
      <Body>{t('No check-in available for this event.')}</Body>
      <Button title={t('Refresh')} onPress={() => void event.refresh()} />
      <Button
        title={t('Back to calendar')}
        variant="ghost"
        onPress={() => router.replace('/events')}
      />
    </Card>
  );
}
export default function CreatePage() {
  const { t } = useLanguage();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const eventId =
    typeof id === 'string' &&
    /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)
      ? id
      : undefined;
  return (
    <Screen title={t(id ? 'Event check-in' : 'New attendance session')}>
      <Access member signInParams={{ next: 'attendance-new', id: eventId }}>
        {(u) =>
          eventId ? (
            <EventAttendance key={u.profile.id + eventId} id={eventId} />
          ) : id ? (
            <Notice error text={t('Event check-in unavailable.')} />
          ) : u.role === 'super_admin' ? (
            <Create key={u.profile.id} />
          ) : (
            <Notice error text={t('Teach access required')} />
          )
        }
      </Access>
    </Screen>
  );
}
