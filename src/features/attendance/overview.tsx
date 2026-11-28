import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { useLanguage } from '../../locales/provider';
import {
  Badge,
  Body,
  Button,
  Card,
  Heading,
  NavigationRow,
} from '../../components/ui';
import { Choices, FetchState, Paging } from '../homework/controls';
import { attendance, markLabel, useAttendanceRead } from './api';

export function AttendanceHome() {
  const { t } = useLanguage();
  const result = useAttendanceRead(
    useCallback(() => attendance('attendance_list'), []),
    30000,
  );
  if (result.error) return <Body>{t(result.error)}</Body>;
  if (!result.data) return <Body>{t('Loading…')}</Body>;
  return (
    <Body>
      {result.data.length
        ? t('Open now') + ' · ' + result.data[0]!.title
        : t('No check-in open.')}
    </Body>
  );
}
export function AttendanceOverview({ teach }: { teach: boolean }) {
  const { t, dueLabel } = useLanguage();
  const [history, setHistory] = useState(false),
    [page, setPage] = useState(0);
  const result = useAttendanceRead(
    useCallback(
      () => attendance('attendance_list', { p_history: history, p_page: page }),
      [history, page],
    ),
    history ? 0 : 10000,
  );
  const stats = useAttendanceRead(
    useCallback(() => attendance('attendance_summary'), []),
    30000,
  );
  return (
    <>
      {teach && (
        <Button
          title={t('New attendance session')}
          icon="attendance"
          onPress={() => router.push('/attendance-new')}
        />
      )}
      <Choices
        items={[
          ['now', t('Open now')],
          ['past', t('Session history')],
        ]}
        value={history ? 'past' : 'now'}
        onChange={(s) => {
          setHistory(s === 'past');
          setPage(0);
        }}
      />
      {history && !teach && stats.data && (
        <Card>
          <Heading>{t('My attendance rate')}</Heading>
          <Body>
            {stats.data.total
              ? Math.round((100 * stats.data.attended) / stats.data.total) +
                '% · ' +
                stats.data.attended +
                ' / ' +
                stats.data.total
              : t('No completed sessions yet.')}
          </Body>
          <Body>
            {t('Late arrivals')} · {stats.data.late}
          </Body>
        </Card>
      )}
      {!result.data ? (
        <FetchState error={result.error} retry={result.refresh} />
      ) : (
        <>
          {!result.data.length && (
            <Card>
              <Body>
                {t(
                  history ? 'No completed sessions yet.' : 'No check-in open.',
                )}
              </Body>
            </Card>
          )}
          {result.data.slice(0, 20).map((s) => (
            <Card key={s.id}>
              <Badge label={s.group_name ?? t('Big class')} />
              <NavigationRow
                icon="attendance"
                title={s.title}
                subtitle={
                  dueLabel(history ? s.opened : s.ends) +
                  (s.personal ? ' · ' + t(markLabel(s.personal)) : '')
                }
                onPress={() =>
                  router.push({
                    pathname: '/attendance-session',
                    params: { id: s.id },
                  })
                }
              />
            </Card>
          ))}
          <Paging page={page} count={result.data.length} onChange={setPage} />
        </>
      )}
      <Button
        title={t('Refresh')}
        variant="ghost"
        onPress={() => {
          void result.refresh();
          void stats.refresh();
        }}
      />
      <Button
        title={t('Back to home')}
        variant="ghost"
        onPress={() => router.replace('/(tabs)')}
      />
    </>
  );
}
