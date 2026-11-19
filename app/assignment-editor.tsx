import { useLocalSearchParams, router } from 'expo-router';
import { Button, Notice, Screen } from '../src/components/ui';
import { Access } from '../src/features/access';
import { AssignmentEditor } from '../src/features/homework/editor';
import { useHomework } from '../src/features/homework/api';
import { FetchState } from '../src/features/homework/controls';
function Existing({ id, copy }: { id: string; copy: boolean }) {
  const result = useHomework('hw_detail', { p_id: id });
  if (result.data === undefined)
    return <FetchState error={result.error} retry={result.refresh} />;
  if (!result.data || (!copy && result.data.assignment.lifecycle !== 'draft'))
    return <Notice text="This draft is unavailable for editing." />;
  return <AssignmentEditor key={id} initial={result.data} copy={copy} />;
}
export default function Editor() {
  const { id, copy } = useLocalSearchParams<{ id?: string; copy?: string }>();
  const source = id || copy;
  return (
    <Screen
      title={
        copy ? 'Copy assignment' : id ? 'Edit assignment' : 'Create assignment'
      }
    >
      <Access admin>
        {(user) =>
          source ? (
            <Existing
              key={user.profile.id + source + Boolean(copy)}
              id={source}
              copy={Boolean(copy)}
            />
          ) : (
            <AssignmentEditor key={user.profile.id} />
          )
        }
      </Access>
      <Button
        title="Back to assignments"
        variant="ghost"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/homework')
        }
      />
    </Screen>
  );
}
