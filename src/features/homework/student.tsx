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
export function StudentWork({
  data,
  refresh,
}: {
  data: Detail;
  refresh: () => Promise<void>;
}) {
  const { assignment: a, draft, versions, status } = data;
  const latest = versions[0];
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
          : 'Could not save your draft.',
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
      return 'Submission received.';
    });
  if (!status) return <Notice text="You were not assigned this work." />;
  return (
    <>
      <Card>
        <SectionTitle icon="homework">Your work</SectionTitle>
        <Body>
          {[status.submission, status.modification, status.grading]
            .filter(Boolean)
            .join(' · ')}
        </Body>
        {latest && (
          <Body>
            Last receipt · Version {latest.version} ·{' '}
            {dueLabel(latest.submitted_at)} · {latest.late ? 'Late' : 'On time'}
          </Body>
        )}
        {blocked && <Notice text={blocked} />}
        {(!blocked || local) && (
          <>
            {a.allow_text && (
              <Field
                label="Your response"
                multiline
                maxLength={20000}
                value={edit.body}
                editable={!preview && !action.busy && !blocked}
                onChangeText={(v) => change('body', v)}
              />
            )}
            {a.allow_link && (
              <Field
                label="Submission link"
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
            {conflict ? (
              <View style={{ gap: 8 }}>
                <Heading>Your draft changed on another device</Heading>
                <Body>Your edits are still in the fields above.</Body>
                <Body>
                  Server copy · {source.body || '(no text)'} {source.link}
                </Body>
                <Button
                  title="Use server copy"
                  variant="secondary"
                  onPress={() => {
                    setLocal(null);
                    setSaveError('');
                    setPreview(null);
                  }}
                />
                {!blocked && (
                  <Button
                    title="Keep my edits"
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
                    ? 'Saving private draft…'
                    : local
                      ? 'Unsaved edits'
                      : draft
                        ? 'Private draft saved · ' + dueLabel(draft.updated_at)
                        : latest
                          ? 'Start your revision from the previous version.'
                          : 'Your draft is private and syncs after you stop typing.'}
                </Body>
                {!blocked && !preview && (
                  <>
                    <Button
                      title="Save private draft"
                      variant="secondary"
                      busy={saving}
                      disabled={!local && Boolean(draft)}
                      onPress={() => void save(edit)}
                    />
                    <Button
                      title="Review submission"
                      disabled={
                        saving ||
                        Boolean(local) ||
                        !draft ||
                        (!edit.body.trim() && !edit.link.trim())
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
            <Heading>Confirm version {preview.base + 1}</Heading>
            {Boolean(preview.body) && <Body>{preview.body}</Body>}
            {Boolean(preview.link) && <Body>{preview.link}</Body>}
            <Body>
              Effective deadline · {dueLabel(status.effective_due_at)}
            </Body>
            <Button
              title="Confirm submission"
              busy={action.busy}
              onPress={confirm}
            />
            <Button
              title="Continue editing"
              variant="ghost"
              disabled={action.busy}
              onPress={() => setPreview(null)}
            />
          </>
        )}
        <Messages action={action} />
      </Card>
      {versions.length > 0 && <Heading>Submission history</Heading>}
      {versions.map((v) => (
        <Receipt key={v.id} version={v} />
      ))}
    </>
  );
}
