import { useBusy } from '../src/features/busy';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Body,
  Button,
  Card,
  Heading,
  Loading,
  Notice,
  Screen,
} from '../src/components/ui';
import { Access } from '../src/features/access';
import { client } from '../src/lib/supabase';
import { errorMessage } from '../src/lib/validation';
type Application = {
  id: string;
  created_at: string;
  profiles: { display_name: string; student_id: string; class_name: string };
};
function Applications() {
  const generation = useRef(0);
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const { busy, start, finish } = useBusy();
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const requestId = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const { data, error } = await client()
        .from('membership_applications')
        .select(
          'id,created_at,profiles!membership_applications_user_id_fkey(display_name,student_id,class_name)',
        )
        .eq('status', 'pending')
        .order('created_at')
        .limit(30)
        .returns<Application[]>();
      if (error) throw error;
      if (requestId === generation.current) setRows(data ?? []);
    } catch (error) {
      if (requestId !== generation.current) return;
      setError(errorMessage(error));
      setRows([]);
    } finally {
      if (requestId === generation.current) setLoading(false);
    }
  }, []);
  // Remote query loading state is synchronized with its network request.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const counter = generation;
    return () => {
      counter.current++;
    };
  }, [load]);
  const review = async (id: string, approve: boolean) => {
    if (!start()) return;
    setError('');
    try {
      const { error } = await client().rpc('review_membership', {
        p_application_id: id,
        p_approve: approve,
      });
      if (error) throw error;
      await load();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      finish();
    }
  };
  return (
    <>
      {loading ? (
        <Loading />
      ) : (
        <>
          {Boolean(error) && <Notice error text={error} />}
          {rows.length === 0 && !error && (
            <Card>
              <Heading>All caught up</Heading>
              <Body>No applications are waiting for review.</Body>
            </Card>
          )}
          {rows.map((row) => (
            <Card key={row.id}>
              <Heading>{row.profiles.display_name}</Heading>
              <Body>
                {row.profiles.student_id} · {row.profiles.class_name}
              </Body>
              <Body>
                Applied{' '}
                {new Date(row.created_at).toLocaleDateString('en-MY', {
                  timeZone: 'Asia/Kuala_Lumpur',
                })}
              </Body>
              <Button
                title="Approve membership"
                busy={busy}
                onPress={() => void review(row.id, true)}
              />
              <Button
                title="Decline application"
                secondary
                busy={busy}
                onPress={() => void review(row.id, false)}
              />
            </Card>
          ))}
          <Button
            title="Refresh applications"
            secondary
            busy={busy}
            onPress={() => void load()}
          />
          <Body>
            Showing up to 30 oldest applications. Reviewed applications leave
            this queue.
          </Body>
        </>
      )}
    </>
  );
}
export default function Administration() {
  return (
    <Screen title="Administration" subtitle="Membership applications">
      <Access admin>{() => <Applications />}</Access>
      <Button
        title="Back to home"
        secondary
        onPress={() => router.replace('/(tabs)')}
      />
    </Screen>
  );
}
