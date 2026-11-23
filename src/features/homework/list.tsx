import { useCreationScope } from '../daily';
import { useLanguage } from '../../locales/provider';
import { router } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Card, Field, NavigationRow } from '../../components/ui';
import { type Identity } from '../identity';
import { useHomework, pageSize } from './api';
import { ClassScope } from '../class-scope';
import { Choices, FetchState, Paging } from './controls';

export function AssignmentList({
  identity,
  submissions = false,
}: {
  identity: Identity;
  submissions?: boolean;
}) {
  const { t, dueLabel } = useLanguage();
  const scopes = useHomework('hw_scopes');
  const [staff, setStaff] = useState(
    !submissions && identity.role !== 'member',
  );
  const [filter, setFilter] = useState(
    submissions ? 'submitted' : staff ? 'all' : 'todo',
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [scope, setScope] = useState('all');
  const creationScope = useCreationScope(scope);
  const rows = useHomework('daily_list', {
    p_scope: scope,
    p_staff: staff,
    p_filter: filter,
    p_search: search.trim(),
    p_page: page,
  });
  const change = (filter: string) => {
    setFilter(filter);
    setPage(0);
  };
  function next(row: NonNullable<typeof rows.data>[number]) {
    if (staff)
      return row.pending
        ? t('Awaiting review') + ' · ' + row.pending
        : t('Manage assignment');
    if (row.modification === 'Revision requested' && !row.blocked)
      return t('Revise and resubmit');
    if (row.grading === 'Returned') return t('View feedback');
    if (row.latest || row.submission === 'Submitted') return t('View receipt');
    if (
      row.blocked ||
      row.detached ||
      row.submission === 'Excused' ||
      row.lifecycle !== 'published'
    )
      return t('View details');
    return t(
      row.draft_revision || row.submission === 'Draft'
        ? 'Continue draft'
        : 'Submit homework',
    );
  }
  return (
    <>
      <Card>
        {!submissions &&
          (identity.role !== 'member' || !!scopes.data?.length) && (
            <Choices
              items={[
                ['staff', t('Manage assignments')],
                ['mine', t('My assignments')],
              ]}
              value={staff ? 'staff' : 'mine'}
              onChange={(value) => {
                setStaff(value === 'staff');
                change(value === 'staff' ? 'all' : 'todo');
              }}
            />
          )}
        {staff && (
          <Button
            disabled={!creationScope}
            title={t('Create assignment')}
            icon="homework"
            onPress={() =>
              router.push({
                pathname: '/assignment-editor',
                params: { scope: creationScope },
              })
            }
          />
        )}
        <ClassScope
          value={scope}
          change={(s) => {
            setScope(s);
            setPage(0);
          }}
          groups={identity.role === 'super_admin' ? scopes.data : []}
        />
        <Field
          label={t('Search assignments')}
          value={search}
          maxLength={160}
          onChangeText={(v) => {
            setSearch(v);
            setPage(0);
          }}
        />
        <Choices
          items={
            staff
              ? [
                  ['all', t('All')],
                  ['draft', t('Drafts')],
                  ['published', t('Published')],
                  ['closed', t('Closed assignments')],
                  ['archived', t('Archived assignments')],
                ]
              : submissions
                ? [
                    ['submitted', t('Submitted')],
                    ['returned', t('Returned')],
                  ]
                : [
                    ['todo', t('To do')],
                    ['archived', t('Archived assignments')],
                    ['all', t('All')],
                    ['submitted', t('Submitted')],
                    ['returned', t('Returned')],
                  ]
          }
          value={filter}
          onChange={change}
        />
        <Button
          title={t('Refresh assignments')}
          onPress={rows.refresh}
          variant="ghost"
        />
      </Card>
      {rows.data === undefined ? (
        <FetchState error={rows.error} retry={rows.refresh} />
      ) : (
        <>
          {rows.data.length === 0 && (
            <Card>
              <Body>
                {search || page > 0
                  ? t('No assignments match your search.')
                  : filter === 'all'
                    ? t('No assignments yet.')
                    : filter === 'todo'
                      ? t('You have no assignments to do.')
                      : t('No assignments match this filter.')}
              </Body>
            </Card>
          )}
          {rows.data.slice(0, pageSize).map((row) => (
            <Card key={row.id}>
              <NavigationRow
                icon="homework"
                title={row.title}
                action={next(row)}
                subtitle={
                  (row.group_name ?? t('Big class')) +
                  ' · ' +
                  t('Due ') +
                  dueLabel(row.due_at) +
                  ' · ' +
                  (staff
                    ? t(row.lifecycle)
                    : [
                        row.submission,
                        row.late && 'Late',
                        row.grading,
                        row.modification,
                      ]
                        .flatMap((value) => (value ? [t(value)] : []))
                        .join(' · ')) +
                  (row.blocked &&
                  (!row.latest ||
                    row.modification === 'Revision requested' ||
                    row.detached ||
                    row.submission === 'Excused')
                    ? ' · ' + t(row.blocked)
                    : '')
                }
                onPress={() =>
                  router.push({
                    pathname: '/assignment',
                    params: {
                      id: row.id,
                      mode: staff
                        ? row.pending
                          ? 'queue'
                          : 'manage'
                        : row.latest &&
                            !(
                              row.modification === 'Revision requested' &&
                              !row.blocked
                            )
                          ? 'receipt'
                          : 'mine',
                    },
                  })
                }
              />
            </Card>
          ))}
          <Paging page={page} count={rows.data.length} onChange={setPage} />
        </>
      )}
      {!submissions && (
        <Button
          title={t('My submissions')}
          variant="secondary"
          onPress={() => router.push('/submissions')}
        />
      )}
      <Button
        title={t('Back to home')}
        variant="ghost"
        onPress={() => router.replace('/(tabs)')}
      />
    </>
  );
}
