import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
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
      setRows(data ?? []);
    } catch (error) {
      setError(errorMessage(error));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);
  // Remote query loading state is synchronized with its network request.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const review = async (id: string, approve: boolean) => {
    setBusy(true);
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
      setBusy(false);
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
