import { useRef, useState } from 'react';
import { Platform } from 'react-native';
import { uuid } from 'expo';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Body, Button, Card, Field, Heading } from '../../components/ui';
import { useLanguage } from '../../locales/provider';
import { client } from '../../lib/supabase';
import { errorMessage } from '../../lib/validation';
import { Choices, FetchState, Messages, Paging } from './controls';
import {
  homework,
  parseDate,
  useHomework,
  useHomeworkAction,
  dueLabel,
  type Assignment,
  type ReportRow,
} from './api';
export function Schedule({
  a,
  canSchedule,
  refresh,
}: {
  a: Assignment;
  canSchedule: boolean;
  refresh: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [when, setWhen] = useState('');
  const act = useHomeworkAction();
  const schedule = useHomework('hw_schedule_info', { p_id: a.id });
  return (
    <Card>
      <Heading>{t('Scheduled publication')}</Heading>
      {schedule.data && (
        <Body>
          {dueLabel(schedule.data.run_at)} ·{' '}
          {t(schedule.data.failure ?? 'Scheduled')}
        </Body>
      )}
      <Field
        label={t('Publish at (MYT)')}
        value={when}
        onChangeText={setWhen}
        hint="YYYY-MM-DD HH:mm"
      />
      {['schedule', 'cancel']
        .filter((k) => k === 'schedule' || schedule.data)
        .map((k) => (
          <Button
            key={k}
            disabled={k === 'schedule' && !canSchedule}
            title={t(
              k === 'schedule' ? 'Schedule publication' : 'Cancel schedule',
            )}
            busy={act.busy}
            onPress={() =>
              act.run(async () => {
                await homework('hw_schedule', {
                  p_id: a.id,
                  p_revision: a.revision,
                  p_at: k === 'cancel' ? null : parseDate(when),
                });
                await Promise.all([schedule.refresh(), refresh()]);
              })
            }
          />
        ))}
      <Messages action={act} />
    </Card>
  );
}
export function Discussion({ a }: { a: Assignment }) {
  const { t } = useLanguage();
  const [page, setPage] = useState(0),
    [message, setMessage] = useState('');
  const token = useRef('');
  const act = useHomeworkAction(),
    rows = useHomework('hw_comments', { p_id: a.id, p_page: page });
  return (
    <Card>
      <Heading>{t('Class discussion')}</Heading>
      <Body>{t('Messages here are visible to assignment participants.')}</Body>
      {rows.data ? (
        rows.data.slice(0, 20).map((x) => (
          <Body key={x.id}>
            {x.author_name} · {dueLabel(x.created_at)}
            {'\n'}
            {x.body}
          </Body>
        ))
      ) : (
        <FetchState error={rows.error} retry={rows.refresh} />
      )}
      {rows.data?.length === 0 && <Body>{t('No discussion yet.')}</Body>}
      <Paging page={page} count={rows.data?.length ?? 0} onChange={setPage} />
      {a.lifecycle !== 'archived' && (
        <>
          <Field
            label={t('Message to class')}
            multiline
            value={message}
            maxLength={3000}
            onChangeText={(v) => {
              token.current = '';
              setMessage(v);
            }}
          />
          <Button
            title={t('Post message')}
            disabled={!message.trim()}
            busy={act.busy}
            onPress={() =>
              act.run(async () => {
                token.current ||= uuid.v4();
                await homework('hw_comment', {
                  p_id: a.id,
                  p_request: token.current,
                  p_text: message,
                });
                token.current = '';
                setMessage('');
                setPage(0);
                await rows.refresh();
              })
            }
          />
        </>
      )}
      <Messages action={act} />
    </Card>
  );
}
function report(id: string) {
  return homework('hw_report_snapshot', { p_id: id });
}
function csvField(value: unknown) {
  let s = String(value ?? '');
  if (/^\s*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
async function exportCsv(rows: ReportRow[], id: string) {
  const keys = [
    'student_id',
    'member_name',
    'submission',
    'grading',
    'late',
    'version',
    'released_score',
    'effective_due_at',
    'submitted_at',
  ] as const;
  const csv =
    '\ufeff' +
    [
      keys.join(','),
      ...rows.map((r) => keys.map((k) => csvField(r[k])).join(',')),
    ].join('\r\n');
  const filename = 'MicroHub-' + id + '.csv';
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } else {
    const f = new File(Paths.cache, filename);
    f.create({ overwrite: true });
    f.write(csv);
    await Sharing.shareAsync(f.uri, { mimeType: 'text/csv' });
  }
}
export function Reports({
  a,
  refresh,
}: {
  a: Assignment;
  refresh: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const act = useHomeworkAction();
  const [preview, setPreview] = useState<
    { row: ReportRow; request: string; result?: string }[]
  >([]);
  const [stats, setStats] = useState<string>('');
  const run = () =>
    act.run(async () => {
      const result = [...preview];
      for (let i = 0; i < result.length; i++) {
        const item = result[i]!;
        if (item.result === 'Returned') continue;
        try {
          await homework('hw_release_saved', {
            p_id: a.id,
            p_version: item.row.version_id,
            p_revision: item.row.review_revision,
            p_request: item.request,
          });
          result[i] = { ...item, result: 'Returned' };
        } catch (e) {
          result[i] = { ...item, result: errorMessage(e) };
        }
        setPreview([...result]);
      }
      await refresh();
    });
  return (
    <Card>
      <Heading>{t('Grading tools')}</Heading>
      <Button
        disabled={act.busy}
        title={t('Completion analysis')}
        onPress={() =>
          act.run(async () => {
            const rows = await report(a.id),
              eligible = rows.filter((r) => r.submission !== 'Excused'),
              scored = eligible.flatMap((r) =>
                r.released_score === null ? [] : [Number(r.released_score)],
              );
            const submitted = eligible.filter((r) => r.version > 0);
            setStats(
              t('Completion rate') +
                ' ' +
                (eligible.length
                  ? Math.round((submitted.length / eligible.length) * 100) + '%'
                  : t('Not applicable')) +
                ' · ' +
                t('Late') +
                ' ' +
                submitted.filter((r) => r.late).length +
                ' · ' +
                t('Mean released score') +
                ' ' +
                (scored.length
                  ? (scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(
                      1,
                    )
                  : '—') +
                '\n' +
                t('Missing') +
                ' · ' +
                eligible
                  .filter((r) => r.submission === 'Missing')
                  .map((r) => r.member_name || r.student_id)
                  .join(', '),
            );
          })
        }
      />
      {Boolean(stats) && <Body>{stats}</Body>}
      <Button
        disabled={act.busy}
        title={t('Export grades (CSV)')}
        variant="secondary"
        onPress={() =>
          act.run(async () => {
            await exportCsv(await report(a.id), a.id);
          })
        }
      />
      <Button
        disabled={act.busy}
        title={t('Preview bulk return')}
        variant="secondary"
        onPress={() =>
          act.run(async () => {
            const rows = (await report(a.id)).filter(
              (r) =>
                r.bulk_approved === true &&
                r.review_revision !== null &&
                r.submission !== 'Excused',
            );
            setPreview(rows.map((row) => ({ row, request: uuid.v4() })));
            if (!rows.length) return t('No saved grades to return.');
          })
        }
      />
      {preview.map(({ row, result }) => (
        <Body key={row.member_id}>
          {row.member_name} · {row.student_id} · {t('Version ')}
          {row.version} · {t(result ?? 'Pending')}
        </Body>
      ))}
      {preview.length > 0 && (
        <Button
          title={t('Return listed versions')}
          busy={act.busy}
          onPress={run}
        />
      )}
      <Messages action={act} />
    </Card>
  );
}
export function GradingLibrary({
  onApply,
  max,
}: {
  onApply: (feedback: string, score?: number) => void;
  max: number | null;
}) {
  const { t } = useLanguage(),
    act = useHomeworkAction(),
    items = useHomework('hw_tools');
  const [open, setOpen] = useState(false),
    [kind, setKind] = useState('comment'),
    [title, setTitle] = useState(''),
    [content, setContent] = useState('');
  const [rubric, setRubric] = useState<{ label: string; max: number }[]>([]),
    [marks, setMarks] = useState<string[]>([]);
  function parse(value: string) {
    const lines = value
      .trim()
      .split('\n')
      .map((line) => {
        const m = /^(.+?)\s*\|\s*(\d+(?:\.\d+)?)$/.exec(line.trim());
        if (!m || Number(m[2]) <= 0)
          throw Error('Write one criterion and maximum per line.');
        return { label: m[1]!.trim(), max: Number(m[2]) };
      });
    if (lines.length > 30) throw Error('Use at most 30 criteria.');
    return lines;
  }
  return (
    <>
      <Button
        title={t('Rubrics and comment bank')}
        variant="ghost"
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          {items.data?.map((x) => (
            <Button
              key={x.id}
              title={x.title}
              variant="secondary"
              onPress={() =>
                act.run(async () => {
                  if (x.kind === 'comment') onApply(x.content);
                  else {
                    const r = parse(x.content);
                    setRubric(r);
                    setMarks(r.map(() => ''));
                  }
                })
              }
            />
          ))}
          {rubric.map((r, i) => (
            <Field
              key={i}
              label={r.label + ' / ' + r.max}
              value={marks[i] ?? ''}
              keyboardType="decimal-pad"
              onChangeText={(v) =>
                setMarks((old) => old.map((x, k) => (i === k ? v : x)))
              }
            />
          ))}
          {!!rubric.length && (
            <Button
              title={t('Apply rubric scores')}
              onPress={() =>
                act.run(async () => {
                  if (
                    marks.some(
                      (m, i) =>
                        !/^\d+(\.\d+)?$/.test(m) || Number(m) > rubric[i]!.max,
                    )
                  )
                    throw Error('Check the criterion scores.');
                  const total = marks.reduce((a, b) => a + Number(b), 0);
                  if (max !== null && total > max)
                    throw Error('Score exceeds the maximum points.');
                  onApply(
                    rubric
                      .map((r, i) => r.label + ' ' + marks[i] + '/' + r.max)
                      .join('\n'),
                    max === null ? undefined : total,
                  );
                  setRubric([]);
                })
              }
            />
          )}
          <Choices
            items={[
              ['comment', t('Reusable comment')],
              ['rubric', t('Scoring rubric')],
            ]}
            value={kind}
            onChange={setKind}
          />
          <Field
            label={t('Template name')}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <Field
            label={t(
              kind === 'comment'
                ? 'Comment text'
                : 'Criteria (one per line: name | maximum)',
            )}
            value={content}
            multiline
            onChangeText={setContent}
            maxLength={3000}
          />
          <Button
            title={t('Save grading template')}
            onPress={() =>
              act.run(async () => {
                if (kind === 'rubric') parse(content);
                const user = (await client().auth.getSession()).data.session
                  ?.user;
                if (!user) throw Error('Sign in again');
                const { error } = await client()
                  .from('homework_grading_tools')
                  .insert({
                    id: uuid.v4(),
                    owner_id: user.id,
                    kind,
                    title: title.trim(),
                    content: content.trim(),
                  });
                if (error) throw error;
                setTitle('');
                setContent('');
                await items.refresh();
              })
            }
          />
          <Messages action={act} />
        </>
      )}
    </>
  );
}

export function ChangeHistory({ id }: { id: string }) {
  const { t } = useLanguage(),
    [page, setPage] = useState(0);
  const log = useHomework('hw_changes', { p_id: id, p_page: page });
  return (
    <Card>
      <Heading>{t('Assignment history')}</Heading>
      {log.data ? (
        log.data.slice(0, 20).map((e) => (
          <Body key={e.id}>
            {t(e.action)} · {dueLabel(e.created_at)} · {e.actor_id}
            {e.details.reason ? ' · ' + e.details.reason : ''}
            {e.details.old_due &&
            e.details.new_due &&
            e.details.old_due !== e.details.new_due
              ? ' · ' +
                dueLabel(e.details.old_due) +
                ' → ' +
                dueLabel(e.details.new_due)
              : ''}
          </Body>
        ))
      ) : (
        <FetchState retry={log.refresh} error={log.error} />
      )}
      <Paging page={page} count={log.data?.length ?? 0} onChange={setPage} />
      <Button title={t('Refresh')} variant="ghost" onPress={log.refresh} />
    </Card>
  );
}
