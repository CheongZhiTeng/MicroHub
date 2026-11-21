import { useLanguage } from '../../locales/provider';
import { useState, useRef } from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
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

import { PolicyEditor } from './policies';
import { useSession } from '../session';
import { GradingLibrary } from './operations';
import { FileList } from './files';
function GradeForm({
  v,
  data,
  refresh,
}: {
  v: Version;
  data: Detail;
  refresh: () => Promise<void>;
}) {
  const { t } = useLanguage();
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
        ? t('Grading draft saved privately.')
        : mode === 'release'
          ? t('Feedback returned to the member.')
          : t('Revision requested.');
    });
  const ask = (mode: 'release' | 'revision') => {
    request.current = uuid.v4();
    setConfirm(mode);
  };
  return (
    <Card>
      <Heading>
        {t('Grade version ')}
        {v.version}
      </Heading>
      {!current && (
        <Notice
          text={t(
            'A newer version is available. This draft stays with its original version.',
          )}
        />
      )}
      {stale && (
        <>
          <Notice
            error
            text={t('Another review was saved. Reload it to continue.')}
          />
          <Button
            title={t('Load saved review')}
            onPress={() => {
              setRevision(v.review?.revision ?? 0);
              setScore(v.review?.score?.toString() ?? '');
              setFeedback(v.review?.feedback ?? '');
              setConfirm(null);
            }}
          />
        </>
      )}
      {!confirm && data.assignment.file_limit !== undefined && (
        <GradingLibrary
          max={data.assignment.max_points}
          onApply={(msg, mark) => {
            setFeedback((v) => [v, msg].filter(Boolean).join('\n'));
            if (mark !== undefined) setScore(String(mark));
          }}
        />
      )}
      {data.assignment.max_points !== null && (
        <Field
          label={t('Score (out of ') + data.assignment.max_points + ')'}
          keyboardType="decimal-pad"
          editable={!confirm && !action.busy}
          value={score}
          onChangeText={setScore}
        />
      )}
      <Field
        label={t('Private feedback')}
        multiline
        maxLength={12000}
        value={feedback}
        editable={!confirm && !action.busy}
        onChangeText={setFeedback}
      />
      {!confirm ? (
        <>
          <Button
            title={t('Save grading draft')}
            variant="secondary"
            disabled={stale}
            busy={action.busy}
            onPress={() => review('save')}
          />
          <Button
            title={t('Mark saved grade for bulk return')}
            variant="secondary"
            disabled={
              stale ||
              !current ||
              !v.review ||
              score !== (v.review.score?.toString() ?? '') ||
              feedback !== v.review.feedback ||
              action.busy
            }
            onPress={() =>
              action.run(async () => {
                await homework('hw_mark_bulk_ready', {
                  p_version: v.id,
                  p_revision: revision,
                });
                return t('Saved grade marked for bulk return.');
              })
            }
          />
          <Button
            title={t('Return grade and feedback')}
            disabled={stale || !current || action.busy}
            onPress={() => ask('release')}
          />
          <Button
            title={t('Request a revision')}
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
                label={t('Revision deadline (optional, MYT)')}
                value={deadline}
                onChangeText={setDeadline}
                placeholder="YYYY-MM-DD HH:mm"
              />
              <Choices
                items={[
                  ['no', t('Send instructions only')],
                  ['yes', t('Also return grade')],
                ]}
                value={include ? 'yes' : 'no'}
                onChange={(x) => setInclude(x === 'yes')}
              />
            </>
          )}
          <Body>
            {confirm === 'release'
              ? t('The member will see this feedback and any score.')
              : t('The member will be able to submit a new version.')}
          </Body>
          <Button
            title={
              confirm === 'release'
                ? t('Confirm return')
                : t('Confirm revision request')
            }
            busy={action.busy}
            disabled={stale || !current}
            onPress={() => review(confirm)}
          />
          <Button
            title={t('Cancel')}
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
  const { t } = useLanguage();
  const { session } = useSession();
  const query = useHomework('hw_detail', { p_id: id, p_member: member });
  if (query.data === undefined)
    return <FetchState error={query.error} retry={query.refresh} />;
  const data = query.data;
  if (!data?.status) return <Notice text={t('Recipient unavailable.')} />;
  const reload = async () => {
    await Promise.all([query.refresh(), changed()]);
  };
  return (
    <>
      <Heading>{data.status.member_name || data.status.student_id}</Heading>
      <Button
        title={t('Refresh member work')}
        variant="ghost"
        onPress={reload}
      />
      {data.can_manage &&
        (!data.assignment.group_id || member !== session?.user.id) && (
          <PolicyEditor
            key={data.status.exception_revision}
            assignment={data.assignment}
            recipient={data.status}
            refresh={reload}
          />
        )}
      {data.assignment.group_id && member === session?.user.id ? (
        <Notice text={t('Another grader must review your submission.')} />
      ) : data.versions.length ? (
        <VersionPanel data={data} refresh={reload} />
      ) : (
        <Notice text={t('No formal submission yet.')} />
      )}
    </>
  );
}
function VersionPanel({
  data,
  refresh,
}: {
  data: Detail;
  refresh: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [selection, select] = useState(data.versions[0]!.id);
  const v =
    data.versions.find((item) => item.id === selection) ?? data.versions[0]!;
  return (
    <>
      <Choices
        items={data.versions.map((x) => [x.id, t('Version ') + x.version])}
        value={v.id}
        onChange={select}
      />
      <Receipt version={v} />
      <FileList
        files={(data.files ?? []).filter((f) => f.version_id === v.id)}
      />
      {v.can_grade === false ? (
        <Notice text={t('Another grader must review your submission.')} />
      ) : (
        <GradeForm key={v.id} v={v} data={data} refresh={refresh} />
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
  const { t } = useLanguage();
  const [filter, setFilter] = useState('pending');
  const [explain, setExplain] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const [sort, setSort] = useState('student');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [member, setMember] = useState('');
  const { width, height } = useWindowDimensions();
  const roster = useHomework('hw_roster', {
    p_id: data.assignment.id,
    p_filter: filter,
    p_sort: sort,
    p_search: search.trim(),
    p_page: page,
  });
  const goToPage = (next: number) => {
    offset.current = 0;
    scroll.current?.scrollTo({ y: 0, animated: false });
    setPage(next);
  };
  const counts = data.counts;
  return (
    <>
      <Card>
        <Heading>{t('Submission overview')}</Heading>
        {counts?.eligible !== undefined && (
          <Body>
            {t('Completion rate')} ·{' '}
            {counts.eligible
              ? Math.round((100 * counts.submitted) / counts.eligible) + '%'
              : t('Not applicable')}{' '}
            ({counts.submitted}/{counts.eligible}) · {t('Missing')}{' '}
            {counts.missing} · {t('Excused')} {counts.excused} · {t('Late')}{' '}
            {counts.late} · {t('Returned')} {counts.returned}
          </Body>
        )}
        {counts && (
          <Body>
            {counts.assigned}
            {t(' assigned · ')}
            {counts.submitted}
            {t(' submitted ·')} {counts.pending}
            {t(' awaiting review          ')}
          </Body>
        )}
        <Button
          variant="ghost"
          title={t(
            explain ? 'Hide calculation details' : 'How counts are calculated',
          )}
          onPress={() => setExplain(!explain)}
        />
        {explain && (
          <Body>
            {t(
              'Counts use the published roster. Submitted includes late work. Awaiting review counts each latest submission awaiting feedback, excluding open revision requests and excused members.        ',
            )}
          </Body>
        )}
      </Card>
      <View
        style={{
          flexDirection: width >= 1024 ? 'row' : 'column',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        {(width >= 1024 || !member) && (
          <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
            <Card>
              <Heading>{t('Recipient roster')}</Heading>
              <Field
                label={t('Search recipients')}
                value={search}
                onChangeText={(s) => {
                  setSearch(s);
                  goToPage(0);
                }}
              />
              <Choices
                items={[
                  ['all', t('All recipients')],
                  ['pending', t('Awaiting review')],
                  ['Submitted', t('Submitted')],
                  ['late', t('Late')],
                  ['Missing', t('Missing')],
                  ['Excused', t('Excused')],
                  ['Revision requested', t('Revision requested')],
                  ['Returned', t('Returned')],
                ]}
                value={filter}
                onChange={(f) => {
                  setFilter(f);
                  goToPage(0);
                }}
              />
              <Body>{t('Sort recipients')}</Body>
              <Choices
                items={[
                  ['student', t('Student ID')],
                  ['name', t('Name')],
                  ['recent', t('Latest submission')],
                ]}
                value={sort}
                onChange={(value) => {
                  setSort(value);
                  goToPage(0);
                }}
              />
              <Button
                title={t('Refresh roster')}
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
                    <Body>{t('No matching recipients.')}</Body>
                  )}
                  <ScrollView
                    ref={scroll}
                    nestedScrollEnabled
                    style={{ maxHeight: Math.max(240, height * 0.55) }}
                    keyboardShouldPersistTaps="handled"
                    scrollEventThrottle={32}
                    onScroll={(event) => {
                      offset.current = event.nativeEvent.contentOffset.y;
                    }}
                    onContentSizeChange={() => {
                      if (offset.current > 0)
                        scroll.current?.scrollTo({
                          y: offset.current,
                          animated: false,
                        });
                    }}
                  >
                    {roster.data.slice(0, pageSize).map((r) => (
                      <NavigationRow
                        key={r.member_id}
                        title={
                          (r.member_name || 'Member') + ' · ' + r.student_id
                        }
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
                  </ScrollView>
                  <Paging
                    page={page}
                    count={roster.data.length}
                    onChange={goToPage}
                  />
                </>
              )}
            </Card>
          </View>
        )}
        {Boolean(member) && (
          <View style={{ flex: 1.4, minWidth: 0, gap: 12 }}>
            {width < 1024 && (
              <Button
                title={t('Back to roster')}
                variant="secondary"
                onPress={() => setMember('')}
              />
            )}
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
