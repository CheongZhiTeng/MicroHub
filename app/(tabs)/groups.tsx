import { ConfirmDialog } from '../../src/components/confirm-dialog';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Access } from '../../src/features/access';
import { useBusy } from '../../src/features/busy';
import {
  PasswordField,
  Body,
  Button,
  Card,
  Field,
  Heading,
  Loading,
  Notice,
  Screen,
} from '../../src/components/ui';
import { useLanguage } from '../../src/locales/provider';
import { errorMessage } from '../../src/lib/validation';
import { profileName } from '../../src/lib/profile-name';
import {
  actions,
  changeGroup,
  deleteGroup,
  loadGroups,
  type Change,
  type Group,
  type Person,
  type Workspace,
} from '../../src/features/groups/api';

type Preview = { args: Change; label: string };
function GroupWorkspace({ root, user }: { root: boolean; user: string }) {
  const { t, language, dueLabel } = useLanguage();
  const [data, setData] = useState<Workspace | null>(null);
  const [id, setId] = useState('');
  const wide = useWindowDimensions().width >= 1024;
  const [appointmentReason, setAppointmentReason] = useState('');
  const [password, setPassword] = useState('');
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [discardGroup, setDiscardGroup] = useState(false);
  const [createError, setCreateError] = useState('');
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
    setPassword('');
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
  const visible =
    data?.groups.filter((g) =>
      archived ? g.state === 'archived' : g.state !== 'archived',
    ) ?? [];
  const group = visible.find((g) => g.id === id) ?? visible[0];
  const conflicts = (data?.groups ?? []).filter(
    (g) =>
      g.teacher_id &&
      g.state !== 'archived' &&
      data?.groups.some(
        (other) =>
          other.id !== g.id &&
          other.state !== 'archived' &&
          other.teacher_id === g.teacher_id,
      ),
  );
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
    if (replace) {
      args.p_replace = replace.id;
      text += ' · ' + t('Replace leader') + ' ' + label(replace);
    }
    setPassword('');
    setAppointmentReason('');
    setPreview({ args, label: text });
    setError('');
  }
  async function apply() {
    if (!preview || !start()) return;
    try {
      const gid =
        preview.args.p_action === 'archive'
          ? await deleteGroup(
              preview.args.p_group!,
              preview.args.p_revision!,
              password,
            )
          : await changeGroup(
              preview.args.p_action === 'appoint_teach'
                ? { ...preview.args, p_reason: appointmentReason.trim() }
                : preview.args,
            );
      setId(gid);
      if (preview.args.p_action === 'create') setArchived(false);
      setGroupName('');
      await reload();
    } catch (e) {
      const message = errorMessage(e);
      await reload();
      setError(message);
    } finally {
      setPassword('');
      finish();
    }
  }
  const choose = (p: Person) => {
    setPersonId(p.id);
    setPreview(null);
  };
  const management = root && group?.manage && group.state !== 'archived';
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
            <>
              <Button
                title={t('Create group')}
                onPress={() => {
                  setGroupName('');
                  setCreateError('');
                  setDiscardGroup(false);
                  setCreating(true);
                }}
              />
              <ConfirmDialog
                visible={creating && !discardGroup}
                title={t('Create group')}
                confirmTitle={t('Create group')}
                danger={false}
                busy={busy}
                disabled={!groupName.trim()}
                onCancel={() =>
                  groupName.trim() ? setDiscardGroup(true) : setCreating(false)
                }
                onConfirm={async () => {
                  if (!groupName.trim() || !start()) return;
                  try {
                    const gid = await changeGroup({
                      p_action: 'create',
                      p_name: groupName.trim(),
                      p_group: null,
                      p_revision: null,
                    });
                    setId(gid);
                    setArchived(false);
                    setCreating(false);
                    await reload();
                  } catch (e) {
                    setCreateError(errorMessage(e));
                  } finally {
                    finish();
                  }
                }}
              >
                <Field
                  label={t('Group name')}
                  value={groupName}
                  onChangeText={setGroupName}
                  maxLength={80}
                  editable={!busy}
                />
                {!!createError && <Notice error text={t(createError)} />}
              </ConfirmDialog>
              <ConfirmDialog
                visible={creating && discardGroup}
                title={t('Discard changes?')}
                message={t('Your unsaved changes will be lost.')}
                confirmTitle={t('Discard changes')}
                cancelTitle={t('Keep editing')}
                onCancel={() => setDiscardGroup(false)}
                onConfirm={() => {
                  setCreating(false);
                  setDiscardGroup(false);
                }}
              />
            </>
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
          {root && conflicts.length > 0 && (
            <Notice
              error
              text={
                t('Resolve duplicate teach assignments') +
                ' · ' +
                conflicts.map((g) => g.name).join(', ')
              }
            />
          )}
          {root && data.groups.some((g) => g.state === 'archived') && (
            <Button
              title={t(
                archived ? 'Show current groups' : 'Show archived groups',
              )}
              variant="ghost"
              onPress={() => {
                setArchived(!archived);
                setPreview(null);
                setPersonId('');
              }}
            />
          )}
          {visible.length > 1 && (
            <Card>
              <Heading>{t('Groups')}</Heading>
              {visible.map((g) => (
                <Button
                  key={g.id}
                  title={g.name}
                  variant={g.id === group?.id ? 'primary' : 'secondary'}
                  onPress={() => pickGroup(g)}
                />
              ))}
            </Card>
          )}
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
            <View style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>
              {group && (
                <Card>
                  <Heading>{group.name}</Heading>
                  {group.state === 'active' &&
                    (root ||
                      group.roster.some((p) => p.id === user && p.leader)) && (
                      <Button
                        title={t('Create assignment')}
                        onPress={() =>
                          router.push({
                            pathname: '/assignment-editor',
                            params: { scope: group.id },
                          })
                        }
                      />
                    )}
                  {root && group.state === 'active' && (
                    <>
                      <Button
                        title={t('New announcement')}
                        onPress={() =>
                          router.push({
                            pathname: '/announcement-editor',
                            params: { scope: group.id },
                          })
                        }
                      />
                      <Button
                        title={t('New event')}
                        onPress={() =>
                          router.push({
                            pathname: '/event-editor',
                            params: { scope: group.id },
                          })
                        }
                      />
                    </>
                  )}
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
                      (p) =>
                        p.id === group.teacher_id &&
                        p.eligible &&
                        p.teach_access !== false,
                    ) && <Notice text={t('An active teach is needed.')} />}
                  {group.manage &&
                    group.state !== 'archived' &&
                    !group.roster.some((p) => p.leader && p.eligible) && (
                      <Notice text={t('An active leader is needed.')} />
                    )}
                  {group.roster.filter(matches).map((p) => {
                    const role =
                      p.id === group.teacher_id
                        ? 'Group teach'
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
                      title={t('Delete group')}
                      variant="secondary"
                      onPress={() => propose('archive')}
                    />
                  )}
                </Card>
              )}
            </View>
            <View style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>
              {group && management && (
                <Card>
                  <Heading>{t('Unassigned members')}</Heading>
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
                        !p.group_id &&
                        !p.teacher,
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
                        (!person.teacher || !person.teach_access) && (
                          <Button
                            title={t('Appoint teach')}
                            onPress={() =>
                              propose(
                                person.teach_access
                                  ? 'teacher'
                                  : 'appoint_teach',
                                person,
                              )
                            }
                          />
                        )}
                      {person.eligible &&
                        !person.teacher &&
                        !person.teach_access &&
                        !person.group_id && (
                          <Button
                            title={t('Assign student')}
                            onPress={() => propose('assign', person)}
                          />
                        )}
                      {person.group_id === group.id && (
                        <>
                          {person.eligible && !person.leader && (
                            <>
                              {group.roster.filter((p) => p.leader).length <
                                2 && (
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
                                    title={
                                      t('Replace leader') + ' · ' + label(p)
                                    }
                                    variant="secondary"
                                    onPress={() =>
                                      propose('promote', person, p)
                                    }
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
            </View>
          </View>
          {preview && (
            <Card>
              <Heading>{t('Confirm group change')}</Heading>
              <Body>{preview.label}</Body>
              {preview.args.p_action === 'appoint_teach' && (
                <>
                  <Notice
                    text={t(
                      'This member will gain full club management access.',
                    )}
                  />
                  <Field
                    label={t('Reason for change')}
                    value={appointmentReason}
                    maxLength={500}
                    onChangeText={setAppointmentReason}
                  />
                </>
              )}
              {preview.args.p_action === 'archive' && group && (
                <>
                  <Body>
                    {group.roster
                      .filter((p) => p.id === group.teacher_id)
                      .map(name)
                      .join('')}{' '}
                    · {t('Group leaders')}{' '}
                    {group.roster.filter((p) => p.leader).length} ·{' '}
                    {t('Students')}{' '}
                    {group.roster.filter((p) => p.group_id === group.id).length}
                  </Body>
                  <PasswordField
                    label={t('Your current password')}
                    value={password}
                    onChangeText={setPassword}
                    editable={!busy}
                  />
                  <Notice
                    text={t(
                      'Students will become unassigned. Previous submissions and grades are kept.',
                    )}
                  />
                </>
              )}
              <Button
                disabled={
                  (preview.args.p_action === 'archive' && !password) ||
                  (preview.args.p_action === 'appoint_teach' &&
                    !appointmentReason.trim())
                }
                title={t(
                  preview.args.p_action === 'archive'
                    ? 'Confirm deletion'
                    : 'Confirm change',
                )}
                busy={busy}
                onPress={() => void apply()}
              />
              <Button
                title={t('Cancel')}
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  setPassword('');
                  setPreview(null);
                }}
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
                  {dueLabel(c.happened_at)}
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
            user={identity.profile.id}
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
