import { useState, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { uuid } from 'expo';
import {
  Button,
  Body,
  Card,
  Field,
  Heading,
  NavigationRow,
  Notice,
} from '../../components/ui';
import { Choices, FetchState, Messages, Paging, Receipt } from './controls';
import {
  homework,
  useHomework,
  useHomeworkAction,
  parseDate,
  points,
  pageSize,
  type Detail,
  type Version,
} from './api';

function GradeForm({
  v,
  data,
  refresh,
}: {
  v: Version;
  data: Detail;
  refresh: () => Promise<void>;
}) {
  const [score, setScore] = useState(v.review?.score?.toString() ?? '');
  const [feedback, setFeedback] = useState(v.review?.feedback ?? '');
  const [include, setInclude] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [revision, setRevision] = useState(v.review?.revision ?? 0);
  const [confirm, setConfirm] = useState<'release' | 'revision' | null>(null);
  const request = useRef('');
  const action = useHomeworkAction();
  const stale = revision !== (v.review?.revision ?? 0);
  const current = data.versions[0]?.id === v.id;
  const review = (mode: 'save' | 'release' | 'revision') =>
    action.run(async () => {
      const value = points(score);
      if (
        value !== null &&
        (data.assignment.max_points === null ||
          value > data.assignment.max_points)
      )
        throw Error('Score exceeds the maximum points.');
      const newRevision = await homework('hw_review', {
        p_version: v.id,
        p_revision: revision,
        p_action: mode,
        p_score: value,
        p_feedback: feedback,
        p_include_grade: mode === 'release' || (mode === 'revision' && include),
        p_revision_due:
          mode === 'revision' && deadline.trim() ? parseDate(deadline) : null,
        p_request: mode === 'save' ? uuid.v4() : request.current,
      }).catch(async (e) => {
        await refresh();
        throw e;
      });
      setRevision(newRevision);
      setConfirm(null);
      await refresh();
      return mode === 'save'
        ? 'Grading draft saved privately.'
        : mode === 'release'
          ? 'Feedback returned to the member.'
          : 'Revision requested.';
    });
  const ask = (mode: 'release' | 'revision') => {
    request.current = uuid.v4();
    setConfirm(mode);
  };
  return (
    <Card>
      <Heading>Grade version {v.version}</Heading>
      {!current && (
        <Notice text="A newer version is available. This draft stays with its original version." />
      )}
      {stale && (
        <>
          <Notice
            error
            text="Another review was saved. Reload it to continue."
          />
          <Button
            title="Load saved review"
            onPress={() => {
              setRevision(v.review?.revision ?? 0);
              setScore(v.review?.score?.toString() ?? '');
              setFeedback(v.review?.feedback ?? '');
              setConfirm(null);
            }}
          />
        </>
      )}
      {data.assignment.max_points !== null && (
        <Field
          label={'Score (out of ' + data.assignment.max_points + ')'}
          keyboardType="decimal-pad"
          editable={!confirm && !action.busy}
          value={score}
          onChangeText={setScore}
        />
      )}
      <Field
        label="Private feedback"
        multiline
        maxLength={12000}
        value={feedback}
        editable={!confirm && !action.busy}
        onChangeText={setFeedback}
      />
      {!confirm ? (
        <>
          <Button
            title="Save grading draft"
            variant="secondary"
            disabled={stale}
            busy={action.busy}
            onPress={() => review('save')}
          />
          <Button
            title="Return grade and feedback"
            disabled={stale || !current || action.busy}
            onPress={() => ask('release')}
          />
          <Button
            title="Request a revision"
            variant="secondary"
            disabled={stale || !current || action.busy}
            onPress={() => ask('revision')}
          />
        </>
      ) : (
        <>
          {confirm === 'revision' && (
            <>
              <Field
                label="Revision deadline (optional, MYT)"
                value={deadline}
                onChangeText={setDeadline}
                placeholder="YYYY-MM-DD HH:mm"
              />
              <Choices
                items={[
                  ['no', 'Send instructions only'],
                  ['yes', 'Also return grade'],
                ]}
                value={include ? 'yes' : 'no'}
                onChange={(x) => setInclude(x === 'yes')}
              />
            </>
          )}
          <Body>
            {confirm === 'release'
              ? 'The member will see this feedback and any score.'
              : 'The member will be able to submit a new version.'}
          </Body>
          <Button
            title={
              confirm === 'release'
                ? 'Confirm return'
                : 'Confirm revision request'
            }
            busy={action.busy}
            disabled={stale || !current}
            onPress={() => review(confirm)}
          />
          <Button
            title="Cancel"
            variant="ghost"
            disabled={action.busy}
            onPress={() => setConfirm(null)}
          />
        </>
      )}
      <Messages action={action} />
    </Card>
  );
}
function MemberWork({
  id,
  member,
  changed,
}: {
  id: string;
  member: string;
  changed: () => Promise<void>;
}) {
  const query = useHomework('hw_detail', { p_id: id, p_member: member });
  const [selection, select] = useState<string | null>(null);
  if (query.data === undefined)
    return <FetchState error={query.error} retry={query.refresh} />;
  const data = query.data;
  if (!data?.status) return <Notice text="Recipient unavailable." />;
  const v = data.versions.find((x) => x.id === selection) ?? data.versions[0];
  const reload = async () => {
    await Promise.all([query.refresh(), changed()]);
  };
  return (
    <>
      <Heading>{data.status.member_name || data.status.student_id}</Heading>
      {!v ? (
        <Notice text="No formal submission yet." />
      ) : (
        <>
          <Choices
            items={data.versions.map((x) => [x.id, 'Version ' + x.version])}
            value={v.id}
            onChange={select}
          />
          <Receipt version={v} />
          <GradeForm key={v.id} v={v} data={data} refresh={reload} />
        </>
      )}
    </>
  );
}
export function Grading({
  data,
  refresh,
}: {
  data: Detail;
  refresh: () => Promise<void>;
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [member, setMember] = useState('');
  const { width } = useWindowDimensions();
  const roster = useHomework('hw_roster', {
    p_id: data.assignment.id,
    p_filter: filter,
    p_search: search.trim(),
    p_page: page,
  });
  const counts = data.counts;
  return (
    <>
      <Card>
        <Heading>Submission overview</Heading>
        {counts && (
          <Body>
            {counts.assigned} assigned · {counts.submitted} submitted ·{' '}
            {counts.pending} awaiting review
          </Body>
        )}
        <Body>
          Counts use the published roster. Submitted includes late work.
          Awaiting review counts each latest submission awaiting feedback,
          excluding open revision requests and excused members.
        </Body>
      </Card>
      <View
        style={{
          flexDirection: width >= 1024 ? 'row' : 'column',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
          <Card>
            <Heading>Recipient roster</Heading>
            <Field
              label="Search recipients"
              value={search}
              onChangeText={(s) => {
                setSearch(s);
                setPage(0);
              }}
            />
            <Choices
              items={[
                ['all', 'All recipients'],
                ['pending', 'Awaiting review'],
                ['Submitted', 'Submitted'],
                ['late', 'Late'],
                ['Missing', 'Missing'],
                ['Excused', 'Excused'],
                ['Revision requested', 'Revision requested'],
                ['Returned', 'Returned'],
              ]}
              value={filter}
              onChange={(f) => {
                setFilter(f);
                setPage(0);
              }}
            />
            <Button
              title="Refresh roster"
              variant="ghost"
              onPress={() => {
                void roster.refresh();
                void refresh();
              }}
            />
            {!roster.data ? (
              <FetchState error={roster.error} retry={roster.refresh} />
            ) : (
              <>
                {roster.data.length === 0 && (
                  <Body>No matching recipients.</Body>
                )}
                {roster.data.slice(0, pageSize).map((r) => (
                  <NavigationRow
                    key={r.member_id}
                    title={(r.member_name || 'Member') + ' · ' + r.student_id}
                    icon="user"
                    subtitle={[
                      r.submission,
                      r.late && 'Late',
                      r.grading,
                      r.modification,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    onPress={() => setMember(r.member_id)}
                  />
                ))}
                <Paging
                  page={page}
                  count={roster.data.length}
                  onChange={setPage}
                />
              </>
            )}
          </Card>
        </View>
        {member && (
          <View style={{ flex: 1.4, minWidth: 0, gap: 12 }}>
            <MemberWork
              key={member}
              id={data.assignment.id}
              member={member}
              changed={async () => {
                await Promise.all([roster.refresh(), refresh()]);
              }}
            />
          </View>
        )}
      </View>
    </>
  );
}
