import { useLanguage } from '../../locales/provider';
import { uuid } from 'expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { Field, Button, Body, Card, SectionTitle } from '../../components/ui';
import {
  useHomework,
  homework,
  useHomeworkAction,
  dateInput,
  parseDate,
  points,
  pageSize,
  type Detail,
} from './api';
import { Choices, FetchState, Messages, Paging } from './controls';

export function Audience({
  targets,
  setTargets,
  groupId,
}: {
  groupId?: string | null;
  targets: string[];
  setTargets: (v: string[]) => void;
}) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const rows = useHomework(groupId ? 'hw_group_candidates' : 'hw_candidates', {
    ...(groupId ? { p_group: groupId } : {}),
    p_search: search.trim(),
    p_page: page,
  });
  return (
    <>
      <Field
        label={t('Find recipients by name or student ID')}
        value={search}
        onChangeText={(s) => {
          setSearch(s);
          setPage(0);
        }}
      />
      <Body>
        {targets.length}
        {t(' selected')}
      </Body>
      {!rows.data ? (
        <FetchState error={rows.error} retry={rows.refresh} />
      ) : (
        <>
          {rows.data.length === 0 && <Body>{t('No matching members.')}</Body>}
          {rows.data.slice(0, pageSize).map((p) => (
            <Button
              key={p.id}
              title={(p.display_name || 'Member') + ' · ' + p.student_id}
              variant={targets.includes(p.id) ? 'primary' : 'secondary'}
              icon={targets.includes(p.id) ? 'check' : 'user'}
              onPress={() =>
                setTargets(
                  targets.includes(p.id)
                    ? targets.filter((id) => id !== p.id)
                    : [...targets, p.id],
                )
              }
            />
          ))}
          <Paging page={page} count={rows.data.length} onChange={setPage} />
        </>
      )}
    </>
  );
}
export function AssignmentEditor({
  initial,
  copy = false,
  club,
  scopes,
}: {
  initial?: Detail;
  copy?: boolean;
  club: boolean;
  scopes: { id: string; name: string }[];
}) {
  const { t } = useLanguage();
  const a = initial?.assignment;
  const [groupId, setGroupId] = useState(
    a?.group_id ?? (club ? '' : (scopes[0]?.id ?? '')),
  );
  const [id] = useState(() => (!copy && a?.id) || uuid.v4());
  const [baseRevision] = useState(copy ? 0 : (a?.revision ?? 0));
  const [title, setTitle] = useState(
    copy && a ? (t('Copy of ') + a.title).slice(0, 160) : (a?.title ?? ''),
  );
  const [instructions, setInstructions] = useState(a?.instructions ?? '');
  const [due, setDue] = useState(() =>
    dateInput(a?.due_at ?? new Date(Date.now() + 7 * 86400000).toISOString()),
  );
  const [max, setMax] = useState(a?.max_points?.toString() ?? '');
  const [type, setType] = useState(
    a && !a.allow_text && !a.allow_link
      ? 'files'
      : !a || (a.allow_text && a.allow_link)
        ? 'both'
        : a.allow_text
          ? 'text'
          : 'link',
  );
  const [late, setLate] = useState(a?.allow_late ?? true);
  const [audience, setAudience] = useState<string>(a?.audience ?? 'all');
  const [targets, setTargets] = useState<string[]>(
    copy ? [] : (initial?.targets ?? []),
  );
  const [settings, setSettings] = useState(false);
  const action = useHomeworkAction();
  const save = () =>
    action.run(async () => {
      if (!title.trim()) throw Error('Give your assignment a title.');
      const deadline = parseDate(due),
        maxPoints = points(max);
      if (maxPoints !== null && (maxPoints <= 0 || maxPoints > 100000))
        throw Error('Enter a maximum above zero and at most 100,000.');
      if (audience === 'selected' && !targets.length)
        throw Error('Select at least one recipient.');
      await homework(
        copy && a?.joint !== undefined
          ? 'hw_copy_assignment'
          : groupId
            ? 'hw_save_scoped'
            : 'hw_save_assignment',
        {
          ...(groupId ? { p_group: groupId } : {}),
          p_id: id,
          ...(copy && a?.joint !== undefined
            ? { p_source: a.id, p_group: groupId || null }
            : { p_revision: baseRevision }),
          p_title: title.trim(),
          p_instructions: instructions,
          p_due: deadline,
          p_points: maxPoints,
          p_text: type === 'text' || type === 'both',
          p_link: type === 'link' || type === 'both',
          p_late: late,
          p_audience: audience,
          p_targets: audience === 'selected' ? targets : [],
        },
      );
      router.replace({
        pathname: '/assignment',
        params: { id, mode: 'manage' },
      });
    });
  return (
    <>
      <Card>
        <SectionTitle icon="members">{t('Recipients')}</SectionTitle>
        {scopes.length > 0 && (
          <Choices
            items={[
              ...(club ? [['', t('Whole club')] as const] : []),
              ...scopes.map((s) => [s.id, s.name] as const),
            ]}
            value={groupId}
            disabled={!!initial && !copy}
            onChange={(v) => {
              setGroupId(v);
              setTargets([]);
            }}
          />
        )}
        <Choices
          items={[
            ['all', t(groupId ? 'All group students' : 'All club students')],
            ['selected', t('Select members')],
          ]}
          value={audience}
          onChange={setAudience}
        />
        {audience === 'selected' && (
          <Audience
            groupId={groupId}
            targets={targets}
            setTargets={setTargets}
          />
        )}
      </Card>
      <Card>
        <SectionTitle icon="homework">{t('Assignment details')}</SectionTitle>
        <Field
          label={t('Title')}
          value={title}
          maxLength={160}
          onChangeText={setTitle}
        />
        <Field
          label={t('Instructions')}
          multiline
          value={instructions}
          maxLength={20000}
          onChangeText={setInstructions}
        />
        <Button
          title={t('Save draft to add reference files')}
          variant="secondary"
          onPress={save}
          busy={action.busy}
        />
        <Field
          label={t('Deadline (Malaysia time)')}
          value={due}
          onChangeText={setDue}
          hint="YYYY-MM-DD HH:mm"
          autoCapitalize="none"
        />
        <Field
          label={t('Maximum points')}
          value={max}
          onChangeText={setMax}
          keyboardType="decimal-pad"
          hint={t('Leave blank for ungraded work.')}
        />
        <Button
          title={t(
            settings ? 'Hide submission settings' : 'Submission settings',
          )}
          variant="secondary"
          onPress={() => setSettings(!settings)}
        />
        {settings && (
          <>
            <Body>{t('Accepted submissions')}</Body>
            <Choices
              items={[
                ['both', t('Text and link')],
                ['text', t('Text only')],
                ['link', t('Link only')],
                ...(a?.file_limit ? [['files', t('Files only')] as const] : []),
              ]}
              value={type}
              onChange={setType}
            />
            <Choices
              items={[
                ['yes', t('Accept late work')],
                ['no', t('On time only')],
              ]}
              value={late ? 'yes' : 'no'}
              onChange={(v) => setLate(v === 'yes')}
            />
          </>
        )}
      </Card>
      <Card>
        <Messages action={action} />
        <Button
          title={t('Save draft and preview')}
          busy={action.busy}
          onPress={save}
        />
        {Boolean(action.error) && (
          <Button
            title={t('Check saved assignment')}
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/assignment',
                params: { id, mode: 'manage' },
              })
            }
          />
        )}
      </Card>
    </>
  );
}
