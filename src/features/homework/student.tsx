import { useLanguage } from '../../locales/provider';
import { useEffect, useRef, useState } from 'react';
import { uuid } from 'expo';
import { View } from 'react-native';
import {
  Body,
  Button,
  Card,
  Field,
  Heading,
  Notice,
  SectionTitle,
} from '../../components/ui';
import { homework, useHomeworkAction, dueLabel, type Detail } from './api';
import { Messages, Receipt } from './controls';
import { useUnsavedEdit, type Edit } from './unsaved';
import { FilePanel, FileList } from './files';
export function StudentWork({
  receiptFirst = false,
  data,
  refresh,
}: {
  receiptFirst?: boolean;
  data: Detail;
  refresh: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const { assignment: a, draft, versions, status } = data;
  const latest = versions[0];
  const files = (data.files ?? []).filter((f) => !f.reference && !f.version_id);
  const source: Edit = {
    base: status?.latest ?? 0,
    revision: draft?.revision ?? 0,
    body: draft?.body ?? latest?.body ?? '',
    link: draft?.link ?? latest?.link ?? '',
  };
  const [local, setLocal] = useUnsavedEdit(a.id);
  const [preview, setPreview] = useState<(Edit & { request: string }) | null>(
    null,
  );
  const [fileBusy, setFileBusy] = useState(false);
  const [history, setHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saveLock = useRef(false);
  const action = useHomeworkAction();
  const edit = local ?? source;
  const conflict = Boolean(
    local && (local.revision !== source.revision || local.base !== source.base),
  );
  const id = a.id;
  const blocked = status?.blocked;
  const change = (prop: 'body' | 'link', value: string) => {
    setSaveError('');
    setPreview(null);
    setLocal({ ...edit, [prop]: value });
  };
  useEffect(() => {
    if (!local || conflict || blocked || saveError || preview || saving) return;
    const timer = setTimeout(() => {
      void save(local);
    }, 1000);
    return () => clearTimeout(timer);
    // The pending snapshot and its expected revision identify this save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, conflict, blocked, saveError, preview, saving, id]);
  async function save(snapshot: Edit) {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const revision = await homework('hw_save_draft', {
        p_id: id,
        p_revision: snapshot.revision,
        p_base: snapshot.base,
        p_body: snapshot.body,
        p_link: snapshot.link,
      });
      await refresh();
      setLocal((current) => {
        if (
          !current ||
          current.base !== snapshot.base ||
          current.revision !== snapshot.revision
        )
          return current;
        return current.body === snapshot.body && current.link === snapshot.link
          ? null
          : { ...current, revision };
      });
    } catch (e) {
      setSaveError(
        e && typeof e === 'object' && 'message' in e
          ? String(e.message)
          : t('Could not save your draft.'),
      );
      await refresh();
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  const confirm = () =>
    action.run(async () => {
      if (!preview) return;
      const check = await homework('hw_detail', { p_id: id });
      if (!check?.versions.some((v) => v.request_id === preview.request)) {
        await homework('hw_submit', {
          p_id: id,
          p_revision: preview.revision,
          p_base: preview.base,
          p_request: preview.request,
        });
      }
      setPreview(null);
      setLocal(null);
      await refresh();
      return t('Submission received.');
    });
  if (!status) return <Notice text={t('You were not assigned this work.')} />;
  const revisionNote =
    status.modification === 'Revision requested'
      ? latest?.events.find((e) => e.kind === 'revision')
      : undefined;
  const receipts = (
    <>
      {latest && (
        <Heading>
          {t(
            latest.events.length
              ? 'Feedback and receipt'
              : 'Submission receipt',
          )}
        </Heading>
      )}
      {versions.length > 1 && (
        <Button
          variant="ghost"
          title={t(
            history ? 'Hide previous submissions' : 'Show previous submissions',
          )}
          onPress={() => setHistory(!history)}
        />
      )}
      {(history ? versions : versions.slice(0, 1)).map((v) => (
        <View key={v.id}>
          <Receipt version={v} />
          <FileList
            files={(data.files ?? []).filter((f) => f.version_id === v.id)}
          />
        </View>
      ))}
    </>
  );
  return (
    <>
      {receiptFirst && receipts}
      <Card>
        <SectionTitle icon="homework">{t('Your work')}</SectionTitle>
        {data.joint_open && (
          <Notice
            text={t(
              'Your group shares this draft. Submitting gives each eligible teammate a receipt. Grades and later revisions are private.',
            )}
          />
        )}
        {latest && (
          <Body>
            {t('Last receipt · Version ')}
            {latest.version} · {dueLabel(latest.submitted_at)} ·{' '}
            {latest.late ? t('Late') : t('On time')}
          </Body>
        )}
        {revisionNote && (
          <>
            <Heading>{t('Revision requested')}</Heading>
            <Body>{revisionNote.feedback}</Body>
            {revisionNote.revision_due_at && (
              <Body>
                {t('Revise by ')}
                {dueLabel(revisionNote.revision_due_at)}
              </Body>
            )}
          </>
        )}
        {blocked && <Notice text={t(blocked)} />}
        {(!blocked || local) && (
          <>
            {a.allow_text && (
              <Field
                label={t('Your response')}
                multiline
                maxLength={20000}
                value={edit.body}
                editable={!preview && !action.busy && !blocked}
                onChangeText={(v) => change('body', v)}
              />
            )}
            {a.allow_link && (
              <Field
                label={t('Submission link')}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={2048}
                value={edit.link}
                editable={!preview && !action.busy && !blocked}
                onChangeText={(v) => change('link', v)}
                placeholder="https://…"
              />
            )}
            {!!a.file_limit && (
              <FilePanel
                embedded
                onBusyChange={setFileBusy}
                assignment={a}
                base={source.base}
                files={files}
                editable={!blocked && !preview && !local && !saving}
                refresh={refresh}
              />
            )}
            {conflict ? (
              <View style={{ gap: 8 }}>
                <Heading>{t('Your draft changed on another device')}</Heading>
                <Body>{t('Your edits are still in the fields above.')}</Body>
                <Body>
                  {t('Server copy · ')}
                  {source.body || '(no text)'} {source.link}
                </Body>
                <Button
                  title={t('Use server copy')}
                  variant="secondary"
                  onPress={() => {
                    setLocal(null);
                    setSaveError('');
                    setPreview(null);
                  }}
                />
                {!blocked && (
                  <Button
                    title={t('Keep my edits')}
                    onPress={() => {
                      setLocal({
                        ...edit,
                        base: source.base,
                        revision: source.revision,
                      });
                      setSaveError('');
                      setPreview(null);
                    }}
                  />
                )}
              </View>
            ) : (
              <>
                {Boolean(saveError) && <Notice error text={saveError} />}
                <Body>
                  {saving
                    ? t(
                        data.joint_open
                          ? 'Saving group draft…'
                          : 'Saving private draft…',
                      )
                    : local
                      ? t('Unsaved edits')
                      : draft
                        ? t(
                            data.joint_open
                              ? 'Group draft saved · '
                              : 'Private draft saved · ',
                          ) + dueLabel(draft.updated_at)
                        : latest
                          ? t('Start your revision from the previous version.')
                          : t(
                              data.joint_open
                                ? 'This draft syncs with your group.'
                                : 'Your draft is private and syncs after you stop typing.',
                            )}
                </Body>
                {!blocked && !preview && (
                  <>
                    <Button
                      title={t(
                        data.joint_open
                          ? 'Save group draft'
                          : 'Save private draft',
                      )}
                      variant="secondary"
                      busy={saving}
                      disabled={!local && Boolean(draft)}
                      onPress={() => void save(edit)}
                    />
                    <Button
                      title={t('Review submission')}
                      disabled={
                        saving ||
                        fileBusy ||
                        Boolean(local) ||
                        !draft ||
                        files.some((f) => f.state === 'pending') ||
                        (!edit.body.trim() &&
                          !edit.link.trim() &&
                          !files.length)
                      }
                      onPress={() =>
                        setPreview({ ...edit, request: uuid.v4() })
                      }
                    />
                  </>
                )}
              </>
            )}
          </>
        )}
        {preview && (
          <>
            <Heading>
              {t(
                data.joint_open
                  ? 'Confirm team submission · Version '
                  : 'Confirm version ',
              )}
              {preview.base + 1}
            </Heading>
            <FileList files={files} />
            {Boolean(preview.body) && <Body>{preview.body}</Body>}
            {Boolean(preview.link) && <Body>{preview.link}</Body>}
            <Body>
              {t('Effective deadline · ')}
              {dueLabel(status.effective_due_at)}
            </Body>
            <Button
              title={t('Confirm submission')}
              busy={action.busy}
              onPress={confirm}
            />
            <Button
              title={t('Continue editing')}
              variant="ghost"
              disabled={action.busy}
              onPress={() => setPreview(null)}
            />
          </>
        )}
        <Messages action={action} />
      </Card>
      {!receiptFirst && receipts}
    </>
  );
}
