import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Access } from '../src/features/access';
import { useBusy } from '../src/features/busy';
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
import { useLanguage } from '../src/locales/provider';
import { errorMessage } from '../src/lib/validation';
import { profileName } from '../src/lib/profile-name';
import {
  actions,
  changeGroup,
  loadGroups,
  type Change,
  type Group,
  type Person,
  type Workspace,
} from '../src/features/groups/api';

type Preview = { args: Change; label: string };
function GroupWorkspace({ root }: { root: boolean }) {
  const { t, language } = useLanguage();
  const [data, setData] = useState<Workspace | null>(null);
  const [id, setId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [personId, setPersonId] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { start, finish, busy } = useBusy();
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const ticket = ++generation.current;
    setLoading(true);
    setPreview(null);
    setPersonId('');
    setError('');
    try {
      const next = await loadGroups();
      if (ticket === generation.current) setData(next);
    } catch (e) {
      if (ticket === generation.current) {
        setData(null);
        setError(errorMessage(e));
      }
    } finally {
      if (ticket === generation.current) setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        generation.current++;
      };
    }, [reload]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => sub.remove();
  }, [reload]);
  const group = data?.groups.find((g) => g.id === id) ?? data?.groups[0];
  const name = (p: Person) => profileName(p, language) || p.student_id;
  const label = (p: Person) => name(p) + ' · ' + p.student_id;
  const matches = (p: Person) =>
    [p.name_en, p.name_zh, p.display_name, p.student_id].some((v) =>
      v?.toLowerCase().includes(search.trim().toLowerCase()),
    );
  const candidates = data?.candidates ?? [];
  const person =
    group?.roster.find((p) => p.id === personId) ??
    candidates.find((p) => p.id === personId);
  function propose(action: string, recipient?: Person, replace?: Person) {
    if (!group) return;
    const args: Change = {
      p_action: action,
      p_group: group.id,
      p_revision: group.revision,
    };
    let text = t(actions[action]!) + ' · ' + group.name;
    if (recipient) {
      args.p_person = recipient.id;
      text += ' · ' + label(recipient);
    }
    if (action === 'assign' && recipient?.group_id) {
      const source = data?.groups.find((g) => g.id === recipient.group_id);
      if (!source) return;
      args.p_source = source.id;
      args.p_source_revision = source.revision;
      text += ' (' + source.name + ' → ' + group.name + ')';
    }
    if (replace) {
      args.p_replace = replace.id;
      text += ' · ' + t('Replace leader') + ' ' + label(replace);
    }
    setPreview({ args, label: text });
    setError('');
  }
  async function apply() {
    if (!preview || !start()) return;
    try {
      const gid = await changeGroup(preview.args);
      setId(gid);
      setGroupName('');
      await reload();
    } catch (e) {
      const message = errorMessage(e);
      await reload();
      setError(message);
    } finally {
      finish();
    }
  }
  const choose = (p: Person) => {
    setPersonId(p.id);
    setPreview(null);
  };
  const management = group?.manage && group.state !== 'archived';
  const pickGroup = (g: Group) => {
    setId(g.id);
    setSearch('');
    setPersonId('');
    setPreview(null);
    setError('');
  };
  if (loading) return <Loading />;
  return (
    <>
      {Boolean(error) && <Notice error text={t(error)} />}
      <Button
        title={t('Refresh')}
        variant="secondary"
        onPress={() => void reload()}
      />
      {data && (
        <>
          {root && (
            <Card>
              <Heading>{t('Create group')}</Heading>
              <Field
                label={t('Group name')}
                value={groupName}
                onChangeText={(v) => {
                  setGroupName(v);
                  setPreview(null);
                }}
                maxLength={80}
              />
              <Button
                title={t('Preview new group')}
                disabled={!groupName.trim()}
                onPress={() =>
                  setPreview({
                    args: {
                      p_action: 'create',
                      p_group: null,
                      p_revision: null,
                      p_name: groupName.trim(),
                    },
                    label: t('Create group') + ' · ' + groupName.trim(),
                  })
                }
              />
            </Card>
          )}
          {data.groups.length === 0 && (
            <Notice
              text={t(
                root
                  ? 'No groups yet.'
                  : 'Your group will appear here after placement and activation.',
              )}
            />
          )}
          {data.groups.length > 1 && (
            <Card>
              <Heading>{t('Groups')}</Heading>
              {data.groups.map((g) => (
                <Button
                  key={g.id}
                  title={g.name}
                  variant={g.id === group?.id ? 'primary' : 'secondary'}
                  onPress={() => pickGroup(g)}
                />
              ))}
            </Card>
          )}
          {group && (
            <Card>
              <Heading>{group.name}</Heading>
              <Body>
                {t(
                  {
                    active: 'Active group',
                    draft: 'Draft group',
                    archived: 'Archived group',
                  }[group.state],
                )}
              </Body>
              <Field
                label={t('Search name or student ID')}
                value={search}
                onChangeText={(v) => {
                  setSearch(v);
                  setPersonId('');
                  setPreview(null);
                }}
              />
              {group.manage &&
                group.state !== 'archived' &&
                !group.roster.some(
                  (p) => p.id === group.teacher_id && p.eligible,
                ) && <Notice text={t('An active teacher is needed.')} />}
              {group.manage &&
                group.state !== 'archived' &&
                !group.roster.some((p) => p.leader && p.eligible) && (
                  <Notice text={t('An active leader is needed.')} />
                )}
              {group.roster.filter(matches).map((p) => {
                const role =
                  p.id === group.teacher_id
                    ? 'Group teacher'
                    : p.leader
                      ? 'Group leader'
                      : 'Student';
                const title =
                  label(p) +
                  ' · ' +
                  t(role) +
                  (p.eligible ? '' : ' · ' + t('Inactive'));
                return management ? (
                  <Button
                    key={p.id}
                    title={title}
                    variant="secondary"
                    onPress={() => choose(p)}
                  />
                ) : (
                  <Body key={p.id}>{title}</Body>
                );
              })}
              {management && group.state === 'draft' && (
                <Button
                  title={t('Activate group')}
                  onPress={() => propose('activate')}
                />
              )}
              {management && root && (
                <Button
                  title={t('Archive group')}
                  variant="secondary"
                  onPress={() => propose('archive')}
                />
              )}
            </Card>
          )}
          {group && management && (
            <Card>
              <Heading>{t('Manage placements')}</Heading>
              <Body>
                {t(
                  'Search by either name or student ID above, then choose a person.',
                )}
              </Body>
              {candidates
                .filter(
                  (p) =>
                    matches(p) &&
                    p.id !== group.teacher_id &&
                    p.group_id !== group.id &&
                    (root || (!p.group_id && !p.teacher)),
                )
                .slice(0, 30)
                .map((p) => (
                  <Button
                    key={p.id}
                    variant="secondary"
                    title={label(p)}
                    onPress={() => choose(p)}
                  />
                ))}
              {person && (
                <View style={{ gap: 10 }}>
                  <Heading>{label(person)}</Heading>
                  {person.eligible &&
                    root &&
                    !person.group_id &&
                    person.id !== group.teacher_id && (
                      <Button
                        title={t('Appoint teacher')}
                        onPress={() => propose('teacher', person)}
                      />
                    )}
                  {person.eligible &&
                    !person.teacher &&
                    person.group_id !== group.id && (
                      <Button
                        title={t(
                          person.group_id
                            ? 'Transfer student'
                            : 'Assign student',
                        )}
                        onPress={() => propose('assign', person)}
                      />
                    )}
                  {person.group_id === group.id && (
                    <>
                      {person.eligible && !person.leader && (
                        <>
                          {group.roster.filter((p) => p.leader).length < 2 && (
                            <Button
                              title={t('Appoint leader')}
                              onPress={() => propose('promote', person)}
                            />
                          )}
                          {group.roster
                            .filter((p) => p.leader)
                            .map((p) => (
                              <Button
                                key={p.id}
                                title={t('Replace leader') + ' · ' + label(p)}
                                variant="secondary"
                                onPress={() => propose('promote', person, p)}
                              />
                            ))}
                        </>
                      )}
                      {person.leader && (
                        <Button
                          title={t('Remove leader role')}
                          onPress={() => propose('demote', person)}
                        />
                      )}
                      <Button
                        title={t('Remove from group')}
                        variant="secondary"
                        onPress={() => propose('remove', person)}
                      />
                    </>
                  )}
                </View>
              )}
            </Card>
          )}
          {preview && (
            <Card>
              <Heading>{t('Confirm group change')}</Heading>
              <Body>{preview.label}</Body>
              {preview.args.p_action === 'archive' && (
                <Notice
                  text={t(
                    'Archiving returns all students to the unassigned list.',
                  )}
                />
              )}
              <Button
                title={t('Confirm change')}
                busy={busy}
                onPress={() => void apply()}
              />
              <Button
                title={t('Cancel')}
                variant="secondary"
                disabled={busy}
                onPress={() => setPreview(null)}
              />
            </Card>
          )}
          {group?.manage && group.changes.length > 0 && (
            <Card>
              <Heading>{t('Recent group changes')}</Heading>
              {group.changes.map((c) => (
                <Body key={c.id}>
                  {t(actions[c.action] ?? c.action)} · {c.actor}
                  {c.subject ? ' → ' + c.subject : ''} ·{' '}
                  {new Date(c.happened_at).toLocaleString(
                    language === 'zh' ? 'zh-CN' : 'en-GB',
                    { timeZone: 'Asia/Kuala_Lumpur' },
                  )}
                </Body>
              ))}
            </Card>
          )}
        </>
      )}
    </>
  );
}
export default function Groups() {
  const { t } = useLanguage();
  return (
    <Screen title={t('My group')}>
      <Access member signInParams={{ next: 'groups' }}>
        {(identity) => (
          <GroupWorkspace
            key={identity.profile.id}
            root={identity.role === 'super_admin'}
          />
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
