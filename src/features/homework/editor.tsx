import { useFormExit } from '../form-exit';
import { useLanguage } from '../../locales/provider';
import { uuid } from 'expo';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { FileList, FileRuleFields, UploadButton } from './files';
import { Reveal } from '../../components/motion';
import {
  Field,
  Button,
  Body,
  Card,
  SectionTitle,
  Badge,
  Heading,
} from '../../components/ui';
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
  requestedScope,
  initial,
  copy = false,
  club,
  scopes,
}: {
  requestedScope?: string;
  initial?: Detail;
  copy?: boolean;
  club: boolean;
  scopes: { id: string; name: string }[];
}) {
  const { t } = useLanguage();
  const a = initial?.assignment;
  const [groupId, setGroupId] = useState(
    a
      ? (a.group_id ?? '')
      : requestedScope === 'big' && club
        ? ''
        : scopes.some((g) => g.id === requestedScope)
          ? requestedScope!
          : 'unselected',
  );
  const [id] = useState(() => (!copy && a?.id) || uuid.v4());
  const [revision, setRevision] = useState(copy ? 0 : (a?.revision ?? 0));
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
  const desktop = useWindowDimensions().width >= 1024;
  const [files, setFiles] = useState(
    copy ? [] : (initial?.files ?? []).filter((f) => f.reference),
  );
  const accountedFiles = useRef(new Set<string>());
  const [uploading, setUploading] = useState(false);
  const [limit, setLimit] = useState(String(a?.file_limit ?? 0));
  const [mb, setMb] = useState(String((a?.file_bytes ?? 5242880) / 1048576));
  const [mode, setMode] = useState(a?.file_mode ?? 'any');
  const fingerprint = JSON.stringify([
    groupId,
    title,
    instructions,
    due,
    max,
    type,
    late,
    audience,
    targets,
    limit,
    mb,
    mode,
  ]);
  const [savedForm, setSavedForm] = useState(fingerprint);
  const exit = useFormExit(fingerprint !== savedForm);
  const savedRules = useRef({
    limit: a?.file_limit ?? 0,
    bytes: a?.file_bytes ?? 5242880,
    mode: a?.file_mode ?? 'any',
  });
  const action = useHomeworkAction();
  async function persist() {
    if (groupId === 'unselected') throw Error('Choose a class');
    const bytes = Math.round(Number(mb) * 1048576);
    if (
      !/^\d+$/.test(limit) ||
      Number(limit) > 10 ||
      !Number.isFinite(bytes) ||
      bytes < 1 ||
      bytes > 10485760 ||
      (type === 'files' && Number(limit) === 0)
    )
      throw Error('Check file limits.');
    if (!title.trim()) throw Error('Give your assignment a title.');
    const deadline = parseDate(due),
      maxPoints = points(max);
    if (maxPoints !== null && (maxPoints <= 0 || maxPoints > 100000))
      throw Error('Enter a maximum above zero and at most 100,000.');
    if (audience === 'selected' && !targets.length)
      throw Error('Select at least one recipient.');
    const copying = copy && revision === 0 && a?.joint !== undefined;
    const enableFilesFirst = type === 'files' && savedRules.current.limit === 0;
    let nextRevision = await homework(
      copying
        ? 'hw_copy_assignment'
        : groupId
          ? 'hw_save_scoped'
          : 'hw_save_assignment',
      {
        ...(groupId ? { p_group: groupId } : {}),
        p_id: id,
        ...(copying
          ? { p_source: a.id, p_group: groupId || null }
          : { p_revision: revision }),
        p_title: title.trim(),
        p_instructions: instructions,
        p_due: deadline,
        p_points: maxPoints,
        p_text: enableFilesFirst || type === 'text' || type === 'both',
        p_link: type === 'link' || type === 'both',
        p_late: late,
        p_audience: audience,
        p_targets: audience === 'selected' ? targets : [],
      },
    );
    setRevision(nextRevision);
    if (
      Number(limit) !== savedRules.current.limit ||
      bytes !== savedRules.current.bytes ||
      mode !== savedRules.current.mode
    ) {
      await homework('hw_file_settings', {
        p_id: id,
        p_revision: nextRevision,
        p_limit: Number(limit),
        p_bytes: bytes,
        p_mode: mode,
      });
      savedRules.current = { limit: Number(limit), bytes, mode };
      setRevision(++nextRevision);
    }
    if (enableFilesFirst) {
      await homework('hw_media_only', {
        p_id: id,
        p_revision: nextRevision,
        p_only: true,
      });
      setRevision(nextRevision + 1);
    }
    setSavedForm(fingerprint);
  }
  const save = () =>
    action.run(async () => {
      await persist();
      exit.finish();
      router.replace({
        pathname: '/assignment',
        params: { id, mode: 'manage' },
      });
    });
  const scopeName =
    groupId === 'unselected'
      ? t('Choose a class')
      : scopes.find((scope) => scope.id === groupId)?.name || t('Big class');
  return (
    <View
      style={{
        flexDirection: desktop ? 'row' : 'column',
        alignItems: 'stretch',
        gap: 20,
      }}
    >
      {exit.dialog}
      <View style={{ flex: desktop ? 2 : undefined, minWidth: 0, gap: 16 }}>
        <Card>
          <SectionTitle icon="members">{t('Recipients')}</SectionTitle>
          {
            <Choices
              items={[
                ...(club ? [['', t('Big class')] as const] : []),
                ...scopes.map((s) => [s.id, s.name] as const),
              ]}
              value={groupId}
              disabled={!!revision || uploading || action.busy}
              onChange={(v) => {
                setGroupId(v);
                setTargets([]);
              }}
            />
          }
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
          <FileList files={files} />
          <UploadButton
            assignmentId={id}
            reference
            prepare={persist}
            onBusy={setUploading}
            disabled={action.busy}
            refresh={async (fileId) => {
              const detail = await homework('hw_detail', { p_id: id });
              const references = (detail?.files ?? []).filter(
                (f) => f.reference,
              );
              setFiles(references);
              // Count only this upload. An unrelated edit must still cause a revision conflict.
              if (
                references.some(
                  (f) => f.id === fileId && f.state === 'ready',
                ) &&
                !accountedFiles.current.has(fileId)
              ) {
                accountedFiles.current.add(fileId);
                setRevision((current) => current + 1);
              }
            }}
          />
        </Card>
        <Card>
          <SectionTitle icon="calendar">{t('Deadline')}</SectionTitle>
          <Field
            label={t('Deadline (Malaysia time)')}
            value={due}
            onChangeText={setDue}
            hint="YYYY-MM-DD HH:mm"
            autoCapitalize="none"
          />
          <Button
            title={t(
              settings ? 'Hide submission settings' : 'Submission settings',
            )}
            variant="secondary"
            onPress={() => setSettings(!settings)}
          />
          {settings && (
            <Reveal style={{ gap: 12 }}>
              <Field
                label={t('Maximum points')}
                value={max}
                onChangeText={setMax}
                keyboardType="decimal-pad"
                hint={t('Leave blank for ungraded work.')}
              />
              <Body>{t('Accepted submissions')}</Body>
              <Choices
                items={[
                  ['both', t('Text and link')],
                  ['text', t('Text only')],
                  ['link', t('Link only')],
                  ...(Number(limit) > 0 || type === 'files'
                    ? [['files', t('Files only')] as const]
                    : []),
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
              <Body>{t('Student file settings')}</Body>
              <FileRuleFields
                limit={limit}
                mb={mb}
                mode={mode}
                setLimit={setLimit}
                setMb={setMb}
                setMode={setMode}
              />
            </Reveal>
          )}
        </Card>
      </View>
      <View style={{ flex: desktop ? 1 : undefined, minWidth: 0 }}>
        <Card>
          <Badge label={t('Draft')} />
          <Heading>{title.trim() || t('Assignment details')}</Heading>
          <Body>
            {scopeName} ·{' '}
            {audience === 'selected'
              ? targets.length + t(' selected')
              : t(groupId ? 'All group students' : 'All club students')}
          </Body>
          <Body>
            {t('Due ')}
            {due} MYT
          </Body>
          <Body>
            {max.trim() ? max + t(' points') : t('Ungraded')} ·{' '}
            {t(late ? 'Late submissions accepted' : 'On-time submissions only')}
          </Body>
          <Messages action={action} />
          <Button
            title={t('Save draft and preview')}
            busy={action.busy}
            disabled={uploading || groupId === 'unselected'}
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
      </View>
    </View>
  );
}
