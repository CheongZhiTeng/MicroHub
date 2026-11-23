import { useState } from 'react';
import { useLanguage } from '../src/locales/provider';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Button,
  Body,
  Card,
  Heading,
  Notice,
  Screen,
} from '../src/components/ui';
import { Access } from '../src/features/access';
import {
  type Assignment,
  dueLabel,
  homework,
  useHomework,
  useHomeworkAction,
} from '../src/features/homework/api';
import { Brief, FetchState, Messages } from '../src/features/homework/controls';
import { StudentWork } from '../src/features/homework/student';
import { PolicyEditor } from '../src/features/homework/policies';
import { Grading } from '../src/features/homework/grading';
import { AssignmentActions } from '../src/features/homework/maintenance';
import { FilePanel } from '../src/features/homework/files';
import {
  Schedule,
  Reports,
  Discussion,
  ChangeHistory,
} from '../src/features/homework/operations';
function DraftPreview({
  action,
  a,
  waitingForFile,
  fileBusy,
  refresh,
}: {
  action: ReturnType<typeof useHomeworkAction>;
  a: Assignment;
  waitingForFile: boolean;
  fileBusy: boolean;
  refresh: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const id = a.id;
  const audience = useHomework('hw_preview_count', { p_id: id });
  return (
    <>
      <Card>
        <Heading>{t('Student preview')}</Heading>
        {a.group_id && a.joint !== undefined && (
          <Button
            variant="secondary"
            title={t(
              a.joint
                ? 'Switch to individual submissions'
                : 'Use one shared group submission',
            )}
            busy={action.busy}
            disabled={fileBusy}
            onPress={() =>
              action.run(async () => {
                await homework('hw_work_mode', {
                  p_id: id,
                  p_revision: a.revision,
                  p_joint: !a.joint,
                });
                await refresh();
              })
            }
          />
        )}
        <Body>
          {[
            a.group_name || t('Big class'),
            typeof audience.data === 'number'
              ? audience.data +
                t(audience.data === 1 ? ' student' : ' students')
              : t('Recipient count unavailable'),
            t(a.joint ? 'Shared group submission' : 'Individual submissions'),
          ].join(' · ')}
        </Body>
        <Body>
          {t('Effective deadline · ')}
          {dueLabel(a.due_at)}
        </Body>
        {waitingForFile && (
          <Notice
            text={t(
              'Finish or remove pending reference files before publishing.',
            )}
          />
        )}
        <Button
          title={t('Edit draft')}
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/assignment-editor', params: { id } })
          }
        />
        <Button
          title={
            t('Publish to ') +
            (a.group_name || t('Big class')) +
            (a.audience === 'selected' ? t(' (selected students)') : '') +
            (typeof audience.data === 'number'
              ? ' · ' +
                audience.data +
                t(audience.data === 1 ? ' person' : ' people')
              : '')
          }
          disabled={!audience.data || waitingForFile || fileBusy}
          busy={action.busy}
          onPress={() =>
            action.run(async () => {
              const count = await homework('daily_publish', {
                p_expected: audience.data,
                p_id: id,
                p_revision: a.revision,
              }).catch(async (e) => {
                await audience.refresh();
                throw e;
              });
              await refresh();
              return t('Published to ') + count + t(' members.');
            })
          }
        />
      </Card>
      {audience.error && <Notice error text={audience.error} />}
      {a.file_limit !== undefined && (
        <Schedule
          a={a}
          refresh={refresh}
          canSchedule={!!audience.data && !waitingForFile && !fileBusy}
        />
      )}
    </>
  );
}
function Workspace({
  id,
  mode,
  requested,
  legacy,
}: {
  id: string;
  mode?: string;
  requested: boolean;
  legacy: boolean;
}) {
  const { t } = useLanguage();
  const action = useHomeworkAction();
  const [fileBusy, setFileBusy] = useState(false);
  const result = useHomework('hw_detail', { p_id: id });
  if (result.data === undefined)
    return <FetchState error={result.error} retry={result.refresh} />;
  const data = result.data;
  if (!data)
    return (
      <>
        <Notice text={t('This assignment is unavailable to your account.')} />
        <Button title={t('Refresh assignment')} onPress={result.refresh} />
      </>
    );
  const a = data.assignment;
  const manage = requested && (data.can_manage ?? legacy);
  return (
    <>
      {manage && mode === 'queue' && (
        <Button
          title={t('Recipient roster')}
          variant="ghost"
          onPress={() =>
            router.replace({
              pathname: '/assignment',
              params: { id, mode: 'manage' },
            })
          }
        />
      )}
      <Brief
        assignment={a}
        status={!manage ? data.status : undefined}
        due={manage ? undefined : data.status?.effective_due_at}
      />
      {a.file_limit !== undefined &&
        ((a.lifecycle === 'draft' && manage) ||
          data.files?.some((f) => f.reference)) && (
          <FilePanel
            assignment={a}
            files={(data.files ?? []).filter((f) => f.reference)}
            reference
            onBusyChange={setFileBusy}
            editable={manage && a.lifecycle === 'draft'}
            refresh={result.refresh}
          />
        )}
      {a.lifecycle === 'draft' ? (
        <DraftPreview
          action={action}
          fileBusy={fileBusy}
          waitingForFile={
            !!data.files?.some((f) => f.reference && f.state === 'pending')
          }
          key={'preview-' + a.revision}
          a={a}
          refresh={result.refresh}
        />
      ) : manage ? (
        <Grading
          queue={mode === 'queue'}
          data={data}
          refresh={result.refresh}
        />
      ) : (
        <StudentWork
          receiptFirst={mode === 'receipt'}
          data={data}
          refresh={result.refresh}
        />
      )}
      {a.file_limit !== undefined && (
        <>
          {manage && a.lifecycle !== 'draft' && (
            <>
              <Reports a={a} refresh={result.refresh} />
              <ChangeHistory id={a.id} />
            </>
          )}
          {a.lifecycle !== 'draft' && !data.status?.detached && (
            <Discussion a={a} />
          )}
        </>
      )}
      {manage && data.can_manage && (
        <PolicyEditor
          key={a.revision}
          assignment={a}
          refresh={result.refresh}
        />
      )}
      <Messages action={action} />
      {manage && <AssignmentActions assignment={a} refresh={result.refresh} />}
      <Button
        title={t('Refresh assignment')}
        variant="ghost"
        onPress={result.refresh}
      />
    </>
  );
}
export default function AssignmentRoute() {
  const { t } = useLanguage();
  const { id, mode } = useLocalSearchParams<{ id?: string; mode?: string }>();
  return (
    <Screen
      title={
        mode === 'manage' ? t('Assignment workspace') : t('Assignment details')
      }
    >
      <Access member signInParams={{ next: 'assignment', id, mode }}>
        {(identity) =>
          id ? (
            <Workspace
              key={identity.profile.id + id}
              id={id}
              mode={mode}
              requested={mode === 'manage' || mode === 'queue'}
              legacy={identity.role !== 'member'}
            />
          ) : (
            <Notice text={t('Choose an assignment from your list.')} />
          )
        }
      </Access>
      <Button
        title={t('Back to assignments')}
        variant="secondary"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/homework')
        }
      />
    </Screen>
  );
}
