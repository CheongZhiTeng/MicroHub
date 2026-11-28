import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { uuid } from 'expo';
import { Access } from '../src/features/access';
import {
  Screen,
  Body,
  Button,
  Card,
  Field,
  Notice,
} from '../src/components/ui';
import { useLanguage } from '../src/locales/provider';
import { attendance, useAttendanceRead } from '../src/features/attendance/api';
import { AttendanceSession } from '../src/features/attendance/session';
import {
  Choices,
  FetchState,
  Messages,
} from '../src/features/homework/controls';
import { useHomeworkAction } from '../src/features/homework/api';
function Create() {
  const { t } = useLanguage(),
    act = useHomeworkAction();
  const scopes = useAttendanceRead(
    useCallback(() => attendance('attendance_scopes'), []),
  );
  const [id] = useState(() => uuid.v4()),
    [title, setTitle] = useState(''),
    [minutes, setMinutes] = useState('10'),
    [scope, setScope] = useState(''),
    [created, setCreated] = useState<{ code: string } | null>(null);
  if (created) return <AttendanceSession id={id} initialCode={created.code} />;
  const chosen = scopes.data?.find((g) => (g.id ?? 'big') === scope);
  return (
    <>
      <Card>
        <Field
          label={t('Session title')}
          value={title}
          maxLength={120}
          onChangeText={setTitle}
        />
        <Field
          label={t('Check-in duration (minutes)')}
          value={minutes}
          keyboardType="number-pad"
          onChangeText={setMinutes}
        />
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
        {chosen && (
          <Body>
            {t('Expected students')} · {chosen.students}
          </Body>
        )}
        <Button
          title={t('Start check-in')}
          busy={act.busy}
          disabled={
            !title.trim() ||
            !chosen ||
            !/^\d{1,3}$/.test(minutes) ||
            +minutes < 1 ||
            +minutes > 120
          }
          onPress={() =>
            void act.run(async () => {
              try {
                const code = await attendance('attendance_open', {
                  p_id: id,
                  p_group: chosen!.id,
                  p_title: title.trim(),
                  p_minutes: Number(minutes),
                  p_expected: chosen!.students,
                });
                setCreated({ code: code ?? '' });
              } catch (e) {
                await scopes.refresh();
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
export default function CreatePage() {
  const { t } = useLanguage();
  return (
    <Screen title={t('New attendance session')}>
      <Access member signInParams={{ next: 'attendance-new' }}>
        {(u) =>
          u.role === 'super_admin' ? (
            <Create key={u.profile.id} />
          ) : (
            <Notice error text={t('Teach access required')} />
          )
        }
      </Access>
    </Screen>
  );
}
