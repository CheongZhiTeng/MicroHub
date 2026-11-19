import { useState } from 'react';
import { Linking, View } from 'react-native';
import {
  Button,
  Body,
  Card,
  Heading,
  Loading,
  Notice,
} from '../../components/ui';
import { dueLabel, pageSize, type Assignment, type Version } from './api';
export function Choices({
  items,
  value,
  onChange,
  disabled = false,
}: {
  items: readonly (readonly [string, string])[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map(([id, label]) => (
        <Button
          key={id}
          title={label}
          variant={value === id ? 'primary' : 'secondary'}
          icon={value === id ? 'check' : undefined}
          disabled={disabled}
          onPress={() => onChange(id)}
        />
      ))}
    </View>
  );
}
export function Paging({
  page,
  count,
  onChange,
}: {
  page: number;
  count: number;
  onChange: (p: number) => void;
}) {
  if (!page && count <= pageSize) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <Button
        title="Previous"
        variant="secondary"
        disabled={page === 0}
        onPress={() => onChange(page - 1)}
      />
      <Body>Page {page + 1}</Body>
      <Button
        title="Next"
        variant="secondary"
        disabled={count <= pageSize}
        onPress={() => onChange(page + 1)}
      />
    </View>
  );
}
export function FetchState({
  error,
  retry,
}: {
  error?: string;
  retry: () => void;
}) {
  return error ? (
    <Card>
      <Notice error text={error} />
      <Button title="Try again" onPress={retry} />
    </Card>
  ) : (
    <Loading />
  );
}
export function Messages({
  action,
}: {
  action: { message: string; error: string };
}) {
  return (
    <>
      {Boolean(action.error) && <Notice error text={action.error} />}
      {Boolean(action.message) && <Notice text={action.message} />}
    </>
  );
}
export function Brief({
  assignment: a,
  due,
}: {
  assignment: Assignment;
  due?: string;
}) {
  return (
    <Card>
      <Heading>{a.title}</Heading>
      {Boolean(a.instructions) && <Body>{a.instructions}</Body>}
      <Body>Due {dueLabel(due ?? a.due_at)}</Body>
      <Body>
        {a.max_points === null ? 'Ungraded' : a.max_points + ' points'} ·{' '}
        {[a.allow_text && 'Text', a.allow_link && 'Link']
          .filter(Boolean)
          .join(' + ')}{' '}
        ·{' '}
        {a.allow_late
          ? 'Late submissions accepted'
          : 'On-time submissions only'}
      </Body>
    </Card>
  );
}
function SubmissionLink({ url }: { url: string }) {
  const [error, setError] = useState('');
  const open = async () => {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw Error();
      await Linking.openURL(parsed.href);
    } catch {
      setError('Could not open this link.');
    }
  };
  return (
    <View>
      <Body>{url}</Body>
      <Button title="Open submitted link" variant="ghost" onPress={open} />
      {Boolean(error) && <Notice error text={error} />}
    </View>
  );
}
export function Receipt({ version: v }: { version: Version }) {
  return (
    <Card>
      <Heading>
        Version {v.version} · {v.late ? 'Late' : 'On time'}
      </Heading>
      <Body>Submitted {dueLabel(v.submitted_at)}</Body>
      <Body>Deadline used · {dueLabel(v.effective_due_at)}</Body>
      {Boolean(v.body) && <Body>{v.body}</Body>}
      {Boolean(v.link) && <SubmissionLink url={v.link} />}
      {v.events.map((e) => (
        <View key={e.id} style={{ gap: 6 }}>
          <Heading>
            {e.kind === 'revision' ? 'Revision requested' : 'Feedback returned'}
          </Heading>
          <Body>{dueLabel(e.created_at)}</Body>
          {e.includes_grade && e.score !== null && (
            <Body>Score · {e.score}</Body>
          )}
          {Boolean(e.feedback) && <Body>{e.feedback}</Body>}
          {e.revision_due_at && (
            <Body>Revise by {dueLabel(e.revision_due_at)}</Body>
          )}
        </View>
      ))}
    </Card>
  );
}
