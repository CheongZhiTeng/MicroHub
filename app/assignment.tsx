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
function Workspace({
  id,
  requested,
  legacy,
}: {
  id: string;
  requested: boolean;
  legacy: boolean;
}) {
  const { t } = useLanguage();
  const result = useHomework('hw_detail', { p_id: id });
  const action = useHomeworkAction();
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
      <Brief
        assignment={a}
        due={manage ? undefined : data.status?.effective_due_at}
      />
      {a.file_limit !== undefined &&
        ((a.lifecycle === 'draft' && manage) ||
          data.files?.some((f) => f.reference)) && (
          <FilePanel
            assignment={a}
            files={(data.files ?? []).filter((f) => f.reference)}
            reference
            editable={manage && a.lifecycle === 'draft'}
            refresh={result.refresh}
          />
        )}
      {a.lifecycle === 'draft' ? (
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
              onPress={() =>
                action.run(async () => {
                  await homework('hw_work_mode', {
                    p_id: id,
                    p_revision: a.revision,
                    p_joint: !a.joint,
                  });
                  await result.refresh();
                })
              }
            />
          )}
          <Body>
            {t(
              'Only administrators can see this draft. Publishing assigns it to',
            )}{' '}
            {a.audience === 'all'
              ? t(a.group_id ? 'All group students' : 'all active members')
              : data.targets.length + t(' selected members')}
            .
          </Body>
          <Button
            title={t('Edit draft')}
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/assignment-editor', params: { id } })
            }
          />
          <Button
            title={t('Publish assignment')}
            busy={action.busy}
            onPress={() =>
              action.run(async () => {
                const count = await homework('hw_publish', {
                  p_id: id,
                  p_revision: a.revision,
                });
                await result.refresh();
                return t('Published to ') + count + t(' members.');
              })
            }
          />
        </Card>
      ) : manage ? (
        <Grading data={data} refresh={result.refresh} />
      ) : (
        <StudentWork data={data} refresh={result.refresh} />
      )}
      {a.file_limit !== undefined && (
        <>
          {manage && a.lifecycle === 'draft' && (
            <Schedule a={a} refresh={result.refresh} />
          )}
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
      {manage && <AssignmentActions assignment={a} refresh={result.refresh} />}
      <Messages action={action} />
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
              requested={mode === 'manage'}
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
