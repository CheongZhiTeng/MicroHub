import { router } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Card, Field, NavigationRow } from '../../components/ui';
import { type Identity } from '../identity';
import { useHomework, dueLabel, pageSize } from './api';
import { Choices, FetchState, Paging } from './controls';

export function AssignmentList({
  identity,
  submissions = false,
}: {
  identity: Identity;
  submissions?: boolean;
}) {
  const [staff, setStaff] = useState(
    !submissions && identity.role !== 'member',
  );
  const [filter, setFilter] = useState(
    submissions ? 'submitted' : staff ? 'all' : 'todo',
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const rows = useHomework('hw_list', {
    p_staff: staff,
    p_filter: filter,
    p_search: search.trim(),
    p_page: page,
  });
  const change = (filter: string) => {
    setFilter(filter);
    setPage(0);
  };
  return (
    <>
      <Card>
        {!submissions && identity.role !== 'member' && (
          <Choices
            items={[
              ['staff', 'Manage assignments'],
              ['mine', 'My assignments'],
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
            title="Create assignment"
            icon="homework"
            onPress={() => router.push('/assignment-editor')}
          />
        )}
        <Field
          label="Search assignments"
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
                  ['all', 'All'],
                  ['draft', 'Drafts'],
                  ['published', 'Published'],
                ]
              : submissions
                ? [
                    ['submitted', 'Submitted'],
                    ['returned', 'Returned'],
                  ]
                : [
                    ['todo', 'To do'],
                    ['all', 'All'],
                    ['submitted', 'Submitted'],
                    ['returned', 'Returned'],
                  ]
          }
          value={filter}
          onChange={change}
        />
        <Button
          title="Refresh assignments"
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
                  ? 'No assignments match your search.'
                  : filter === 'all'
                    ? 'No assignments yet.'
                    : filter === 'todo'
                      ? 'You have no assignments to do.'
                      : 'No assignments match this filter.'}
              </Body>
            </Card>
          )}
          {rows.data.slice(0, pageSize).map((row) => (
            <Card key={row.id}>
              <NavigationRow
                icon="homework"
                title={row.title}
                subtitle={
                  'Due ' +
                  dueLabel(row.due_at) +
                  ' · ' +
                  (staff
                    ? row.lifecycle
                    : [
                        row.submission,
                        row.late && 'Late',
                        row.grading,
                        row.modification,
                      ]
                        .filter(Boolean)
                        .join(' · '))
                }
                onPress={() =>
                  router.push({
                    pathname: '/assignment',
                    params: { id: row.id, mode: staff ? 'manage' : 'mine' },
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
          title="My submissions"
          variant="secondary"
          onPress={() => router.push('/submissions')}
        />
      )}
      <Button
        title="Back to home"
        variant="ghost"
        onPress={() => router.replace('/(tabs)')}
      />
    </>
  );
}
