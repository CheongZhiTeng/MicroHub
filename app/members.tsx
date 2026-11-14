import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Body,
  Button,
  Card,
  Field,
  Heading,
  Loading,
  Notice,
  Screen,
} from '../src/components/ui';
import { Access } from '../src/features/access';
import { client } from '../src/lib/supabase';
import { errorMessage } from '../src/lib/validation';
type Member = {
  id: string;
  display_name: string;
  student_id: string;
  class_name: string;
  platform_roles: { role: string } | null;
};
function Directory() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      let request = client()
        .from('profiles')
        .select(
          'id,display_name,student_id,class_name,platform_roles(role),memberships!inner(status)',
        )
        .eq('memberships.status', 'active')
        .eq('status', 'active')
        .order('student_id')
        .range(page * 30, page * 30 + 29);
      // Only Unicode letters, numbers, whitespace and hyphens enter the filter grammar.
      const term = search
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .slice(0, 100);
      if (term)
        request = request.or(
          `display_name.ilike.%${term}%,student_id.ilike.%${term}%`,
        );
      const { data, error } = await request.returns<Member[]>();
      if (error) throw error;
      setMembers(data ?? []);
    } catch (error) {
      setError(errorMessage(error));
      setMembers([]);
    } finally {
      setBusy(false);
    }
  }, [search, page]);
  // Remote query loading state is synchronized with its network request.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  return (
    <>
      <Card>
        <Field
          label="Search name or student ID"
          value={query}
          onChangeText={setQuery}
          maxLength={100}
        />
        <Button
          title="Search members"
          busy={busy}
          onPress={() => {
            setPage(0);
            setSearch(query);
          }}
        />
      </Card>
      {busy ? (
        <Loading />
      ) : error ? (
        <>
          <Notice error text={error} />
          <Button title="Retry" onPress={() => void load()} />
        </>
      ) : (
        <>
          {members.length === 0 && <Notice text="No matching members." />}
          {members.map((member) => (
            <Card key={member.id}>
              <Heading>{member.display_name || member.student_id}</Heading>
              <Body>
                {member.student_id} · {member.class_name}
              </Body>
              <Body>
                {member.platform_roles?.role.replace('_', ' ') ?? 'member'}
              </Body>
            </Card>
          ))}
          {page > 0 && (
            <Button
              title="Previous page"
              secondary
              onPress={() => setPage(page - 1)}
            />
          )}
          {members.length === 30 && (
            <Button
              title="Next page"
              secondary
              onPress={() => setPage(page + 1)}
            />
          )}
        </>
      )}
    </>
  );
}
export default function Members() {
  return (
    <Screen title="Member directory" subtitle="Your club community">
      <Access member>{() => <Directory />}</Access>
      <Button
        title="Back to home"
        secondary
        onPress={() => router.replace('/(tabs)')}
      />
    </Screen>
  );
}
