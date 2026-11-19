import { useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card } from '../../components/ui';
import { Audience } from './editor';
import { homework, useHomeworkAction, type Assignment } from './api';
import { Messages } from './controls';
export function AssignmentActions({
  assignment: a,
  refresh,
}: {
  assignment: Assignment;
  refresh: () => Promise<void>;
}) {
  const [operation, setOperation] = useState<'remove' | 'add' | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const action = useHomeworkAction();
  return (
    <Card>
      <Button
        title="Copy to new draft"
        variant="secondary"
        icon="homework"
        onPress={() =>
          router.push({
            pathname: '/assignment-editor',
            params: { copy: a.id },
          })
        }
      />
      {a.lifecycle === 'draft' && (
        <Button
          title="Delete draft"
          variant="ghost"
          onPress={() => setOperation('remove')}
        />
      )}
      {a.lifecycle === 'published' && (
        <Button
          title="Add recipients"
          variant="secondary"
          onPress={() => setOperation('add')}
        />
      )}
      {operation === 'remove' && (
        <>
          <Body>Delete the unpublished draft “{a.title}”?</Body>
          <Button
            title="Confirm delete"
            variant="danger"
            busy={action.busy}
            onPress={() =>
              action.run(async () => {
                await homework('hw_delete_draft', {
                  p_id: a.id,
                  p_revision: a.revision,
                });
                router.dismissTo('/homework');
              })
            }
          />
        </>
      )}
      {operation === 'add' && (
        <>
          <Audience targets={targets} setTargets={setTargets} />
          <Button
            title="Assign to selected members"
            disabled={!targets.length}
            busy={action.busy}
            onPress={() =>
              action.run(async () => {
                await homework('hw_add_recipients', {
                  p_id: a.id,
                  p_members: targets,
                });
                setOperation(null);
                setTargets([]);
                await refresh();
                return 'The selected members have this assignment.';
              })
            }
          />
        </>
      )}
      {operation && (
        <Button
          title="Cancel changes"
          variant="ghost"
          disabled={action.busy}
          onPress={() => setOperation(null)}
        />
      )}
      <Messages action={action} />
    </Card>
  );
}
