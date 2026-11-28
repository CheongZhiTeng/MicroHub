import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  Badge,
  Body,
  Button,
  Card,
  Field,
  Heading,
  Notice,
} from '../../components/ui';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { useLanguage } from '../../locales/provider';
import { useHomeworkAction } from '../homework/api';
import { Choices, FetchState, Messages, Paging } from '../homework/controls';
import {
  attendance,
  markLabel,
  useAttendanceRead,
  type Mark,
  type Roll,
} from './api';

export function AttendanceSession({
  id,
  initialCode = '',
}: {
  id: string;
  initialCode?: string;
}) {
  const { t, language, dueLabel } = useLanguage();
  const act = useHomeworkAction();
  const [code, setCode] = useState(initialCode),
    [input, setInput] = useState(''),
    [search, setSearch] = useState('');
  const [rosterPage, setRosterPage] = useState(0);
  const [codeGeneration, setCodeGeneration] = useState(0);
  const [showChanges, setShowChanges] = useState(false);
  const [missing, setMissing] = useState(false);
  const [control, setControl] = useState(''),
    [edit, setEdit] = useState<Roll | null>(null);
  const [mark, setMark] = useState<Mark>('Late'),
    [reason, setReason] = useState('');
  const fetch = useCallback(async () => {
    const requestAt = Date.now();
    const item = await attendance('attendance_panel', { p_id: id });
    return {
      ...item,
      deadline: requestAt + Date.parse(item.ends) - Date.parse(item.server_now),
    };
  }, [id]);
  const result = useAttendanceRead(fetch, 5000, id),
    s = result.data;
  const [now, setNow] = useState(Date.now);
  const refresh = result.refresh;
  useEffect(() => {
    if (!s?.live) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    const end = setTimeout(
      () => {
        setNow(Date.now());
        setCode('');
        void refresh();
      },
      Math.max(0, s.deadline - Date.now()),
    );
    return () => {
      clearInterval(tick);
      clearTimeout(end);
    };
  }, [s, refresh]);
  const back = (
    <Button
      title={t('Back to attendance')}
      variant="ghost"
      onPress={() => router.replace('/(tabs)/attendance')}
    />
  );
  if (!s)
    return (
      <>
        <FetchState error={result.error} retry={result.refresh} />
        {back}
      </>
    );
  const live = s.live && s.deadline > now;
  const roster = s.manager || live ? s.roster : null;
  const counts =
    roster?.reduce(
      (n, r) => n + (r.status === 'Present' || r.status === 'Late' ? 1 : 0),
      0,
    ) ?? 0;
  const matches = (roster ?? []).filter(
    (r) =>
      (!missing || r.status === 'Absent' || r.status === 'Waiting') &&
      (r.en + ' ' + r.zh)
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const currentPage = Math.min(
    rosterPage,
    Math.max(0, Math.ceil(matches.length / 20) - 1),
  );
  const remaining = Math.max(0, Math.ceil((s.deadline - now) / 1000));
  const canCheck = live && s.personal === 'Waiting';
  async function submit() {
    await act.run(async () => {
      const receipt = await attendance('attendance_check', {
        p_id: id,
        p_code: input,
      });
      if (receipt.error) throw Error(receipt.error);
      setInput('');
      await result.refresh();
      return 'Check-in recorded.';
    });
  }
  return (
    <>
      <Card>
        <Badge label={s.group_name ?? t('Big class')} />
        <Heading>{s.title}</Heading>
        <Body>
          {t(live ? 'Check-in ends' : 'Check-in ended')} · {dueLabel(s.ends)}
        </Body>
        {live && (
          <Body>
            {t('Time remaining')} · {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, '0')}
          </Body>
        )}
        {s.personal && (
          <Badge
            label={t(
              markLabel(
                !live && s.personal === 'Waiting' ? 'Absent' : s.personal,
              ),
            )}
          />
        )}
        {s.checked_at && (
          <Body>
            {t('Check-in receipt')} · {dueLabel(s.checked_at)}
          </Body>
        )}
      </Card>
      {canCheck && (
        <Card>
          <Field
            label={t('Six-digit code')}
            value={input}
            onChangeText={(v) => setInput(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="000000"
            autoComplete="off"
            onSubmitEditing={() => {
              if (input.length === 6) void submit();
            }}
          />
          <Button
            title={t('Check in now')}
            busy={act.busy}
            disabled={input.length !== 6}
            onPress={() => void submit()}
          />
        </Card>
      )}
      {live && s.manager && (
        <Card>
          {code && codeGeneration === s.generation && (
            <>
              <Heading>{t('Attendance code')}</Heading>
              <Heading>{code}</Heading>
            </>
          )}
          <Button
            title={t('Generate replacement code')}
            variant="secondary"
            onPress={() => setControl('rotate')}
          />
          <Button
            title={t('End check-in')}
            variant="secondary"
            onPress={() => setControl('close')}
          />
        </Card>
      )}
      <Messages action={act} />
      {roster && (
        <Card>
          <Heading>{t('Attendance roster')}</Heading>
          <Body>
            {t('Attended')} · {counts} / {roster.length}　
            {t(live ? 'Not checked in' : 'Absent')} · {roster.length - counts}
          </Body>
          <Choices
            items={[
              ['all', t('All students')],
              ['missing', t(live ? 'Not checked in' : 'Absent')],
            ]}
            value={missing ? 'missing' : 'all'}
            onChange={(value) => {
              setMissing(value === 'missing');
              setRosterPage(0);
            }}
          />
          <Field
            label={t('Find a name')}
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setRosterPage(0);
            }}
          />
          {matches
            .slice(currentPage * 20, currentPage * 20 + 20)
            .map((r, index) => {
              const name = language === 'zh' ? r.zh : r.en;
              return (
                <Card key={r.student ?? index}>
                  <Heading>{name}</Heading>
                  <Badge label={t(markLabel(r.status))} />
                  {s.manager && !s.live && (
                    <Button
                      title={t('Correct record')}
                      accessibilityLabel={t('Correct record') + ' · ' + name}
                      variant="secondary"
                      onPress={() => {
                        setEdit(r);
                        setMark(r.status === 'Absent' ? 'Late' : 'Present');
                        setReason('');
                      }}
                    />
                  )}
                </Card>
              );
            })}
          {!matches.length && <Body>{t('No matching students.')}</Body>}
          <Paging
            page={currentPage}
            count={matches.length - currentPage * 20}
            onChange={setRosterPage}
          />
        </Card>
      )}
      {s.manager && !!s.corrections?.length && (
        <Card>
          <Button
            title={t(
              showChanges ? 'Hide recent corrections' : 'Recent corrections',
            )}
            variant="secondary"
            onPress={() => setShowChanges(!showChanges)}
          />
          {showChanges &&
            s.corrections.map((change) => (
              <Card key={change.id}>
                <Heading>
                  {language === 'zh' ? change.name_zh : change.name_en}
                </Heading>
                <Body>
                  {t(markLabel(change.previous))} →{' '}
                  {t(markLabel(change.replacement))}
                </Body>
                <Body>{change.reason}</Body>
                <Body>
                  {change.actor} · {dueLabel(change.at_time)}
                </Body>
              </Card>
            ))}
        </Card>
      )}
      <Button
        title={t('Refresh')}
        variant="ghost"
        onPress={() => void result.refresh()}
      />
      {back}
      <ConfirmDialog
        visible={!!control && live && s.manager}
        title={t(
          control === 'close' ? 'End check-in?' : 'Replace the current code?',
        )}
        message={t(
          control === 'close'
            ? 'Students who have not checked in will be marked absent.'
            : 'The previous code will stop working immediately.',
        )}
        busy={act.busy}
        confirmTitle={t('Confirm')}
        onCancel={() => setControl('')}
        onConfirm={() =>
          void act.run(async () => {
            try {
              if (control === 'rotate' && s.generation !== undefined) {
                const next = await attendance('attendance_rotate', {
                  p_id: id,
                  p_generation: s.generation,
                });
                setCode(next);
                setCodeGeneration(s.generation + 1);
              } else if (control === 'close') {
                await attendance('attendance_control', {
                  p_id: id,
                  p_action: 'close',
                });
                setCode('');
              }
            } finally {
              setControl('');
              await result.refresh();
            }
          })
        }
      >
        {!!act.error && <Notice error text={act.error} />}
      </ConfirmDialog>
      <ConfirmDialog
        visible={!!edit && s.manager && !s.live}
        title={
          t('Correct record') +
          ' · ' +
          (language === 'zh' ? edit?.zh : edit?.en)
        }
        busy={act.busy}
        danger={false}
        disabled={!reason.trim() || mark === edit?.status}
        confirmTitle={t('Save correction')}
        onCancel={() => setEdit(null)}
        onConfirm={() =>
          void act.run(async () => {
            try {
              await attendance('attendance_correct', {
                p_id: id,
                p_student: edit?.student,
                p_revision: edit?.revision,
                p_status: mark,
                p_reason: reason.trim(),
              });
            } finally {
              setEdit(null);
              await result.refresh();
            }
            return 'Attendance updated.';
          })
        }
      >
        <Choices
          items={(['Present', 'Late', 'Absent'] as const).map((v) => [
            v,
            t(markLabel(v)),
          ])}
          value={mark}
          onChange={(v) => setMark(v as Mark)}
        />
        <Field
          label={t('Reason for correction')}
          value={reason}
          maxLength={500}
          onChangeText={setReason}
        />
      </ConfirmDialog>
    </>
  );
}
