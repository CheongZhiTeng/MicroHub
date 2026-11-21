import {
  hasBilingualNames,
  profileName,
  type ProfileNames,
} from '../src/lib/profile-name';
import { useLanguage } from '../src/locales/provider';
import { View, useWindowDimensions } from 'react-native';
import { memberSearchFilter } from '../src/lib/member-search';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Body,
  Button,
  Card,
  Field,
  Heading,
  Loading,
  Notice,
  Screen,
  Avatar,
  Badge,
  SectionTitle,
} from '../src/components/ui';
import { Access } from '../src/features/access';
import { client } from '../src/lib/supabase';
import { errorMessage } from '../src/lib/validation';
type Member = ProfileNames & {
  id: string;
  student_id: string;
  class_name: string;
  platform_roles: { role: string } | null;
};
function Directory({ bilingual }: { bilingual: boolean }) {
  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const generation = useRef(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const requestId = ++generation.current;
    setBusy(true);
    setError('');
    try {
      let request = client()
        .from('profiles')
        .select(
          'id,display_name,student_id,class_name,platform_roles(role),memberships!inner(status)' +
            (bilingual ? ',name_zh,name_en' : ''),
        )
        .eq('memberships.status', 'active')
        .eq('status', 'active')
        .order('student_id')
        .range(page * 30, page * 30 + 29);
      const filter = memberSearchFilter(search, bilingual);
      if (filter) request = request.or(filter);
      const { data, error } = await request.returns<Member[]>();
      if (error) throw error;
      if (requestId === generation.current) setMembers(data ?? []);
    } catch (error) {
      if (requestId !== generation.current) return;
      setError(errorMessage(error));
      setMembers([]);
    } finally {
      if (requestId === generation.current) setBusy(false);
    }
  }, [search, page, bilingual]);
  // Remote query loading state is synchronized with its network request.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const counter = generation;
    return () => {
      counter.current++;
    };
  }, [load]);
  return (
    <>
      <Card>
        <SectionTitle icon="search">{t('Find your people')}</SectionTitle>
        <Field
          label={t('Search name or student ID')}
          value={query}
          onChangeText={setQuery}
          maxLength={100}
        />
        <Button
          title={t('Search members')}
          busy={busy}
          onPress={() => {
            if (page === 0 && search === query) void load();
            else {
              setPage(0);
              setSearch(query);
            }
          }}
        />
      </Card>
      {busy ? (
        <Loading />
      ) : error ? (
        <>
          <Notice error text={error} />
          <Button title={t('Retry')} onPress={() => void load()} />
        </>
      ) : (
        <>
          {members.length === 0 && <Notice text={t('No matching members.')} />}
          {members.map((member) => (
            <Card
              key={member.id}
              style={
                width >= 1024
                  ? {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }
                  : undefined
              }
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <Avatar name={profileName(member, language)} />
                <View style={{ flex: 1 }}>
                  <Heading>
                    {profileName(member, language) || member.student_id}
                  </Heading>
                </View>
              </View>
              <Body>
                {member.student_id} · {member.class_name}
              </Body>
              <Badge
                label={t(
                  member.platform_roles?.role === 'super_admin'
                    ? 'teach'
                    : member.platform_roles?.role === 'admin'
                      ? 'Admin'
                      : 'Member',
                )}
              />
            </Card>
          ))}
          {page > 0 && (
            <Button
              title={t('Previous page')}
              variant="secondary"
              onPress={() => setPage(page - 1)}
            />
          )}
          {members.length === 30 && (
            <Button
              title={t('Next page')}
              variant="secondary"
              onPress={() => setPage(page + 1)}
            />
          )}
        </>
      )}
    </>
  );
}
export default function Members() {
  const { t } = useLanguage();
  return (
    <Screen title={t('Member directory')} subtitle={t('Your club community')}>
      <Access member>
        {(identity) => (
          <Directory bilingual={hasBilingualNames(identity.profile)} />
        )}
      </Access>
      <Button
        title={t('Back to home')}
        variant="secondary"
        onPress={() => router.replace('/(tabs)')}
      />
    </Screen>
  );
}
