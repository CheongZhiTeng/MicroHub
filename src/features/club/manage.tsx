import { useCallback, useState } from 'react';
import { Clipboard, Platform, Text } from 'react-native';
import { uuid } from 'expo';
import { router } from 'expo-router';
import {
  Body,
  Button,
  Card,
  Field,
  Heading,
  Notice,
} from '../../components/ui';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { useLanguage } from '../../locales/provider';
import { client } from '../../lib/supabase';
import { useFocusedQuery } from '../focused-query';
import { useHomeworkAction } from '../homework/api';
import { Choices, FetchState, Messages, Paging } from '../homework/controls';
import { ProfilePhoto } from '../profile-photo';

const identities = ['president', 'vice_president', 'teach', 'admin', 'member'];
const labels: Record<string, string> = {
  president: 'President',
  vice_president: 'Vice President',
  teach: 'teach',
  admin: 'Admin',
  member: 'Member',
  overview: 'Overview',
  members: 'Members',
  invites: 'Invitations',
  positions: 'Committee positions',
  club: 'Club settings',
  audit: 'Action history',
  pending: 'Pending applications',
  suspended: 'Suspended accounts',
  identity: 'Change identity',
  remove: 'Remove membership',
  restore: 'Restore membership',
  suspend: 'Suspend account',
  resume: 'Resume account',
  position: 'Assign position',
  eligible: 'Active members',
  active: 'Active',
  inactive: 'Inactive',
  available: 'Available',
  expired: 'Expired',
  used: 'Used',
  revoked: 'Revoked',
};
export function clubLabel(key: string) {
  return labels[key] ?? key;
}
type Person = {
  id: string;
  display_name: string;
  name_en: string | null;
  name_zh: string | null;
  student_id: string;
  membership: string;
  account: string;
  identity: string;
  version: string;
  group_name: string | null;
  position_id: string | null;
};
type Position = { id: string; title: string; active: boolean };
type Invite = {
  id: string;
  created_at: string;
  expires: string;
  state: string;
};
type Audit = {
  id: string;
  created_at: string;
  action: string;
  actor: string;
  target_id: string | null;
  details: Record<string, unknown>;
};
type Club = {
  name: string;
  description: string;
  logo_owner: string | null;
  logo_id: string | null;
  updated_at: string;
};
export async function clubRpc<T>(
  name: string,
  params: Record<string, unknown> = {},
) {
  const { data, error } = await client().rpc(name, params);
  if (error?.code === 'PGRST202')
    throw Error('Club administration needs a database update.');
  if (error) throw error;
  return data as T;
}
function usePanel<T>(
  tab: string,
  search = '',
  filter = '',
  group = '',
  page = 0,
) {
  return useFocusedQuery(
    useCallback(
      () =>
        clubRpc<T>('club_admin_panel', {
          p_tab: tab,
          p_search: search,
          p_filter: filter,
          p_group: group,
          p_page: page,
        }),
      [tab, search, filter, group, page],
    ),
  );
}
function usePositions() {
  return useFocusedQuery(
    useCallback(async () => {
      const { data, error } = await client()
        .from('committee_positions')
        .select('id,title,active')
        .order('title');
      if (error) throw error;
      return data as Position[];
    }, []),
  );
}
export function ClubAdmin({ actor }: { actor: string }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState('overview'),
    [filter, setFilter] = useState('');
  return (
    <>
      <Choices
        items={[
          'overview',
          'members',
          'invites',
          'positions',
          'club',
          'audit',
        ].map((k) => [k, t(clubLabel(k))])}
        value={tab}
        onChange={(v) => {
          setFilter('');
          setTab(v);
        }}
      />
      {tab === 'overview' ? (
        <Overview
          open={(v) => {
            if (v === 'pending') {
              router.push('/administration');
              return;
            }
            setFilter(
              v === 'suspended'
                ? v
                : v === 'members'
                  ? 'eligible'
                  : v === 'invites'
                    ? 'available'
                    : '',
            );
            setTab(v === 'invites' ? v : 'members');
          }}
        />
      ) : tab === 'members' ? (
        <MemberList initial={filter} />
      ) : tab === 'invites' ? (
        <Invites initial={filter} />
      ) : tab === 'positions' ? (
        <Positions />
      ) : tab === 'club' ? (
        <Settings actor={actor} />
      ) : (
        <History />
      )}
    </>
  );
}
function Overview({ open }: { open: (key: string) => void }) {
  const { t } = useLanguage(),
    q = usePanel<Record<string, number>>('overview');
  if (!q.data) return <FetchState error={q.error} retry={q.refresh} />;
  return (
    <Card>
      {Object.entries(q.data).map(([k, n]) => (
        <Button
          key={k}
          title={t(clubLabel(k)) + ' · ' + n}
          variant="secondary"
          onPress={() => open(k)}
        />
      ))}
    </Card>
  );
}
function MemberList({ initial }: { initial: string }) {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState(initial),
    [group, setGroup] = useState(''),
    [page, setPage] = useState(0);
  const [person, setPerson] = useState<Person | null>(null),
    [action, setAction] = useState('identity'),
    [value, setValue] = useState(''),
    [reason, setReason] = useState('');
  const q = usePanel<Person[]>('members', search, filter, group, page),
    positions = usePositions(),
    act = useHomeworkAction();
  const groups = usePanel<{ id: string; name: string }[]>('groups');
  const options =
    person?.membership === 'inactive'
      ? ['restore']
      : [
          'identity',
          'position',
          person?.account === 'suspended' ? 'resume' : 'suspend',
          'remove',
        ];
  const name = (p: Person) =>
    (language === 'zh' ? p.name_zh : p.name_en) ||
    p.display_name ||
    p.student_id;
  return (
    <>
      <Field
        label={t('Search members')}
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          setPage(0);
        }}
      />
      <Choices
        items={['', 'eligible', ...identities, 'suspended', 'inactive'].map(
          (k) => [k, k ? t(clubLabel(k)) : t('All members')],
        )}
        value={filter}
        onChange={(k) => {
          setFilter(k);
          setPage(0);
        }}
      />
      <Choices
        items={[
          ['', t('All groups')],
          ...(groups.data ?? []).map((g) => [g.id, g.name] as const),
        ]}
        value={group}
        onChange={(k) => {
          setGroup(k);
          setPage(0);
        }}
      />
      {!q.data ? (
        <FetchState error={q.error} retry={q.refresh} />
      ) : (
        <>
          {q.data.length === 0 && <Body>{t('No matching members.')}</Body>}
          {q.data.slice(0, 20).map((p) => (
            <Card key={p.id}>
              <Heading>{name(p)}</Heading>
              <Body>
                {[
                  p.student_id,
                  t(clubLabel(p.identity)),
                  p.group_name,
                  positions.data?.find((x) => x.id === p.position_id)?.title,
                  p.membership === 'inactive'
                    ? t('Inactive')
                    : p.account === 'suspended'
                      ? t('Suspended accounts')
                      : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Body>
              <Button
                title={t('Manage member')}
                onPress={() => {
                  setPerson(p);
                  setAction(
                    p.membership === 'inactive' ? 'restore' : 'identity',
                  );
                  setValue(p.identity);
                  setReason('');
                }}
              />
            </Card>
          ))}
          <Paging page={page} count={q.data.length} onChange={setPage} />
        </>
      )}
      <Messages action={act} />
      <ConfirmDialog
        visible={!!person}
        title={person ? name(person) : ''}
        onCancel={() => setPerson(null)}
        confirmTitle={t('Confirm change')}
        busy={act.busy}
        disabled={
          !reason.trim() ||
          (action === 'identity' && value === person?.identity)
        }
        onConfirm={() =>
          void act.run(async () => {
            try {
              await clubRpc('club_member_change', {
                p_id: person!.id,
                p_version: person!.version,
                p_action: action,
                p_value: value || null,
                p_reason: reason.trim(),
              });
              setPerson(null);
              return 'Saved';
            } finally {
              await q.refresh();
            }
          })
        }
      >
        <Choices
          items={options.map((k) => [k, t(clubLabel(k))])}
          value={action}
          onChange={(k) => {
            setAction(k);
            setValue(
              k === 'identity'
                ? person!.identity
                : k === 'position'
                  ? (person!.position_id ?? '')
                  : '',
            );
          }}
        />
        {action === 'identity' && (
          <Choices
            items={identities.map((k) => [k, t(clubLabel(k))])}
            value={value}
            onChange={setValue}
          />
        )}
        {action === 'position' && (
          <Choices
            items={[
              ['', t('No position')],
              ...(positions.data ?? [])
                .filter((x) => x.active)
                .map((x) => [x.id, x.title] as const),
            ]}
            value={value}
            onChange={setValue}
          />
        )}
        <Body>
          {t(
            action === 'remove'
              ? 'Group placement and duties will end. Member history is retained.'
              : action === 'suspend'
                ? 'Account access will be suspended immediately.'
                : action === 'identity' &&
                    ['president', 'vice_president', 'teach'].includes(value)
                  ? 'Full administrators manage members and do not receive student assignments.'
                  : clubLabel(action),
          )}
        </Body>
        <Field
          label={t('Reason for change')}
          value={reason}
          maxLength={500}
          onChangeText={setReason}
        />
        {!!act.error && <Notice error text={t(act.error)} />}
      </ConfirmDialog>
    </>
  );
}
function Invites({ initial }: { initial: string }) {
  const { t, dueLabel } = useLanguage(),
    [page, setPage] = useState(0),
    [code, setCode] = useState(''),
    [issue, setIssue] = useState(false);
  const q = usePanel<Invite[]>('invites', '', initial, '', page),
    act = useHomeworkAction();
  return (
    <>
      <Button
        title={t('New invitation')}
        onPress={() => {
          setCode('');
          setIssue(true);
        }}
      />
      <ConfirmDialog
        visible={issue}
        danger={false}
        title={t('New invitation')}
        message={t('One use. Valid for seven days.')}
        confirmTitle={t(code ? 'Done' : 'Generate code')}
        busy={act.busy}
        onCancel={() => {
          setIssue(false);
          setCode('');
        }}
        onConfirm={() => {
          if (code) {
            setIssue(false);
            setCode('');
            return;
          }
          void act.run(async () => {
            setCode(await clubRpc<string>('club_invite_issue'));
            await q.refresh();
          });
        }}
      >
        {!!code && (
          <>
            <Text selectable style={{ color: '#067d78', fontSize: 18 }}>
              {code}
            </Text>
            <Button
              title={t('Copy code')}
              onPress={() =>
                void act.run(async () => {
                  if (Platform.OS === 'web')
                    await navigator.clipboard.writeText(code);
                  else Clipboard.setString(code);
                  return 'Copied';
                })
              }
            />
          </>
        )}
        <Messages action={act} />
      </ConfirmDialog>
      {!q.data ? (
        <FetchState error={q.error} retry={q.refresh} />
      ) : (
        <>
          {q.data.slice(0, 20).map((x) => (
            <Card key={x.id}>
              <Heading>
                {t(clubLabel(x.state))} · {x.id.slice(0, 8)}
              </Heading>
              <Body>
                {t('Expires')} · {dueLabel(x.expires)}
              </Body>
              {x.state === 'available' && (
                <Button
                  title={t('Revoke invitation')}
                  busy={act.busy}
                  onPress={() =>
                    void act.run(async () => {
                      await clubRpc('club_invite_revoke', { p_id: x.id });
                      await q.refresh();
                    })
                  }
                />
              )}
            </Card>
          ))}
          <Paging page={page} count={q.data.length} onChange={setPage} />
        </>
      )}
      <Messages action={act} />
    </>
  );
}
function Positions() {
  const { t } = useLanguage(),
    q = usePositions(),
    act = useHomeworkAction();
  const [edit, setEdit] = useState<Position | null>(null),
    [name, setName] = useState(''),
    [active, setActive] = useState(true);
  return (
    <>
      <Button
        title={t('New position')}
        onPress={() => {
          setEdit({ id: uuid.v4(), title: '', active: true });
          setName('');
          setActive(true);
        }}
      />
      {!q.data ? (
        <FetchState error={q.error} retry={q.refresh} />
      ) : (
        q.data.map((x) => (
          <Card key={x.id}>
            <Heading>{x.title}</Heading>
            {x.active ? (
              <Button
                title={t('Edit position')}
                onPress={() => {
                  setEdit(x);
                  setName(x.title);
                  setActive(true);
                }}
              />
            ) : (
              <Body>{t('Inactive')}</Body>
            )}
          </Card>
        ))
      )}
      <ConfirmDialog
        visible={!!edit}
        danger={!active}
        title={t(edit?.title ? 'Edit position' : 'New position')}
        busy={act.busy}
        onCancel={() => setEdit(null)}
        disabled={!name.trim()}
        confirmTitle={t('Save')}
        onConfirm={() =>
          void act.run(async () => {
            await clubRpc('club_position_save', {
              p_id: edit!.id,
              p_title: name,
              p_previous: edit!.title || null,
              p_active: active,
            });
            setEdit(null);
            await q.refresh();
          })
        }
      >
        <Field
          label={t('Position name')}
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
        {!!edit?.title && (
          <Choices
            items={[
              ['active', t('Active')],
              ['inactive', t('Inactive')],
            ]}
            value={active ? 'active' : 'inactive'}
            onChange={(v) => setActive(v === 'active')}
          />
        )}
        <Messages action={act} />
      </ConfirmDialog>
    </>
  );
}
function Settings({ actor }: { actor: string }) {
  const { t } = useLanguage();
  const q = useFocusedQuery(
    useCallback(async () => {
      const { data, error } = await client()
        .from('club_settings')
        .select('*')
        .single();
      if (error) throw error;
      return data as Club;
    }, []),
  );
  if (!q.data) return <FetchState error={q.error} retry={q.refresh} />;
  return (
    <Card>
      <Heading>{t('Club settings')}</Heading>
      <ClubForm
        key={q.data.updated_at}
        actor={actor}
        club={q.data}
        refresh={q.refresh}
      />
    </Card>
  );
}
function ClubForm({
  actor,
  club,
  refresh,
}: {
  actor: string;
  club: Club;
  refresh: () => Promise<void>;
}) {
  const { t } = useLanguage(),
    act = useHomeworkAction(),
    [name, setName] = useState(club.name),
    [desc, setText] = useState(club.description);
  return (
    <>
      <ProfilePhoto
        club
        profile={{ id: club.logo_owner ?? actor, avatar_id: club.logo_id }}
        name={club.name}
        refresh={refresh}
      />
      <Field
        label={t('Club name')}
        value={name}
        onChangeText={setName}
        maxLength={100}
      />
      <Field
        label={t('Description')}
        value={desc}
        onChangeText={setText}
        multiline
        maxLength={2000}
      />
      <Button
        title={t('Save')}
        disabled={!name.trim()}
        busy={act.busy}
        onPress={() =>
          void act.run(async () => {
            await clubRpc('update_club', {
              p_name: name.trim(),
              p_description: desc.trim(),
            });
            await refresh();
            return 'Saved';
          })
        }
      />
      <Messages action={act} />
    </>
  );
}
function History() {
  const { t, dueLabel } = useLanguage(),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState(''),
    [day, setText] = useState(''),
    [page, setPage] = useState(0);
  const q = usePanel<Audit[]>('audit', search, filter, day, page);
  return (
    <>
      <Field
        label={t('Operator name or student ID')}
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          setPage(0);
        }}
      />
      <Field
        label={t('Action type')}
        value={filter}
        onChangeText={(v) => {
          setFilter(v);
          setPage(0);
        }}
      />
      <Field
        label={t('Event date (MYT)')}
        placeholder="YYYY-MM-DD"
        value={day}
        onChangeText={(v) => {
          setText(v);
          setPage(0);
        }}
      />
      {!q.data ? (
        <FetchState error={q.error} retry={q.refresh} />
      ) : (
        <>
          {q.data.slice(0, 20).map((x) => (
            <Card key={x.id}>
              <Heading>{x.action}</Heading>
              <Body>
                {x.actor} · {dueLabel(x.created_at)}
              </Body>
              {x.target_id && <Body>{x.target_id}</Body>}
              {Object.entries(x.details).map(([k, v]) => (
                <Body key={k}>
                  {t(k)} ·{' '}
                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </Body>
              ))}
            </Card>
          ))}
          <Paging page={page} count={q.data.length} onChange={setPage} />
        </>
      )}
    </>
  );
}
