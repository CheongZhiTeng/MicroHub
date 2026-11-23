import { useCallback, useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useLanguage } from '../locales/provider';
import { useFocusedQuery } from '../features/focused-query';
import { dueLabel } from '../features/homework/api';
import { eventsInRange } from '../features/class-scope';
import { client } from '../lib/supabase';
import { Choices, FetchState } from '../features/homework/controls';
import { Body, Button, Card, Heading, NavigationRow } from './ui';
import { MonthCalendar } from './month-calendar';
type Due = {
  id: string;
  title: string;
  due_at: string;
  group_name: string | null;
};
const day = 86400000;
function monday() {
  const local = new Date(Date.now() + 8 * 3600000);
  return (
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() - ((local.getUTCDay() + 6) % 7),
    ) -
    8 * 3600000
  );
}
function Week({ scope }: { scope: string }) {
  const { t } = useLanguage();
  const [offset, setOffset] = useState(0);
  const [base, setBase] = useState(monday);
  useEffect(() => {
    const timer = setInterval(() => setBase(monday()), 60000);
    return () => clearInterval(timer);
  }, []);
  const start = base + offset * 7 * day;
  const [open, setOpen] = useState('');
  const result = useFocusedQuery(
    useCallback(async () => {
      const after = new Date(start).toISOString(),
        before = new Date(start + 7 * day).toISOString();
      const [events, work] = await Promise.all([
        eventsInRange(scope, after, before),
        client().rpc('daily_due', {
          p_scope: scope,
          p_after: after,
          p_before: before,
        }),
      ]);
      if (work.error && work.error.code !== 'PGRST202') throw work.error;
      return {
        legacy: !!work.error,
        items: [
          ...((work.data as Due[]) ?? []).map((a) => ({
            ...a,
            time: a.due_at,
            event: null,
          })),
          ...events
            .filter((e) => !e.cancelled)
            .map((e) => ({ ...e, time: e.starts_at, event: e })),
        ].sort((a, b) => Date.parse(a.time) - Date.parse(b.time)),
      };
    }, [scope, start]),
  );
  return (
    <Card>
      <Heading>{t('Weekly agenda')}</Heading>
      <Body>
        {new Date(start + 8 * 3600000).toISOString().slice(0, 10)} –{' '}
        {new Date(start + 6 * day + 8 * 3600000).toISOString().slice(0, 10)}
      </Body>
      <Choices
        items={[
          ['prev', t('Previous week')],
          ['today', t('This week')],
          ['next', t('Next week')],
        ]}
        value={offset === 0 ? 'today' : ''}
        onChange={(v) =>
          setOffset(v === 'today' ? 0 : offset + (v === 'next' ? 1 : -1))
        }
      />
      {!result.data ? (
        <FetchState error={result.error} retry={result.refresh} />
      ) : (
        <>
          {result.data.legacy && (
            <Body>{t('Homework dates need a database update.')}</Body>
          )}
          {!result.data.items.length && (
            <Body>{t('Nothing scheduled this week.')}</Body>
          )}
          {result.data.items.map((item) => (
            <Card key={(item.event ? 'e' : 'a') + item.id}>
              <NavigationRow
                icon={item.event ? 'calendar' : 'homework'}
                title={item.title}
                subtitle={
                  (item.group_name ?? t('Big class')) +
                  ' · ' +
                  dueLabel(item.time)
                }
                onPress={() =>
                  item.event
                    ? setOpen(open === item.id ? '' : item.id)
                    : router.push({
                        pathname: '/assignment',
                        params: { id: item.id, mode: 'mine' },
                      })
                }
              />
              {item.event && open === item.id && (
                <>
                  <Body>
                    {item.event.location || t('Location to be announced')}
                  </Body>
                  <Body>
                    {dueLabel(item.event.starts_at)} –{' '}
                    {dueLabel(item.event.ends_at)}
                  </Body>
                  {!!item.event.description && (
                    <Body>{item.event.description}</Body>
                  )}
                </>
              )}
            </Card>
          ))}
        </>
      )}
      <Button
        title={t('Your club calendar')}
        variant="ghost"
        onPress={() => router.push('/events')}
      />
    </Card>
  );
}
export function HomeCalendar({ scope }: { scope: string }) {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const [chosen, setChosen] = useState('');
  const view = chosen || (width < 768 ? 'week' : 'month');
  return (
    <>
      <Choices
        value={view}
        onChange={setChosen}
        items={[
          ['week', t('Week')],
          ['month', t('Month')],
        ]}
      />
      {view === 'week' ? (
        <Week scope={scope} />
      ) : (
        <MonthCalendar scope={scope} />
      )}
    </>
  );
}
