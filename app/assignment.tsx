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
import { Grading } from '../src/features/homework/grading';
function Workspace({ id, manage }: { id: string; manage: boolean }) {
  const result = useHomework('hw_detail', { p_id: id });
  const action = useHomeworkAction();
  if (result.data === undefined)
    return <FetchState error={result.error} retry={result.refresh} />;
  const data = result.data;
  if (!data)
    return (
      <>
        <Notice text="This assignment is unavailable to your account." />
        <Button title="Refresh assignment" onPress={result.refresh} />
      </>
    );
  const a = data.assignment;
  return (
    <>
      <Brief
        assignment={a}
        due={manage ? undefined : data.status?.effective_due_at}
      />
      {a.lifecycle === 'draft' ? (
        <Card>
          <Heading>Student preview</Heading>
          <Body>
            Only administrators can see this draft. Publishing assigns it to{' '}
            {a.audience === 'all'
              ? 'all active members'
              : data.targets.length + ' selected members'}
            .
          </Body>
          <Button
            title="Edit draft"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/assignment-editor', params: { id } })
            }
          />
          <Button
            title="Publish assignment"
            busy={action.busy}
            onPress={() =>
              action.run(async () => {
                const count = await homework('hw_publish', {
                  p_id: id,
                  p_revision: a.revision,
                });
                await result.refresh();
                return 'Published to ' + count + ' members.';
              })
            }
          />
        </Card>
      ) : manage ? (
        <Grading data={data} refresh={result.refresh} />
      ) : (
        <StudentWork data={data} refresh={result.refresh} />
      )}
      <Messages action={action} />
      <Button
        title="Refresh assignment"
        variant="ghost"
        onPress={result.refresh}
      />
    </>
  );
}
export default function AssignmentRoute() {
  const { id, mode } = useLocalSearchParams<{ id?: string; mode?: string }>();
  return (
    <Screen
      title={mode === 'manage' ? 'Assignment workspace' : 'Assignment details'}
    >
      <Access member signInParams={{ next: 'assignment', id, mode }}>
        {(identity) =>
          id ? (
            <Workspace
              key={identity.profile.id + id}
              id={id}
              manage={mode === 'manage' && identity.role !== 'member'}
            />
          ) : (
            <Notice text="Choose an assignment from your list." />
          )
        }
      </Access>
      <Button
        title="Back to assignments"
        variant="secondary"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/homework')
        }
      />
    </Screen>
  );
}
