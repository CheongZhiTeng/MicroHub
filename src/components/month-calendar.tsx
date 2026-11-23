import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { client } from '../lib/supabase';
import { router } from 'expo-router';
import { eventsInRange } from '../features/class-scope';
import { useFocusedQuery } from '../features/focused-query';
import { useLanguage } from '../locales/provider';
import { useTheme } from '../theme/provider';
import { Body, Button, Card, Notice, SectionTitle, NavigationRow } from './ui';

type Deadline = {
  id: string;
  title: string;
  due_at: string;
  group_name: string | null;
};
const dayMs = 86_400_000;
const offset = 8 * 3_600_000;
function malaysianToday() {
  return new Date(Date.now() + offset).toISOString().slice(0, 10);
}
export function MonthCalendar({ scope }: { scope: string }) {
  const { t, language, dueLabel } = useLanguage();
  const { theme } = useTheme();
  const [today, setToday] = useState(malaysianToday);
  useEffect(() => {
    const tick = setInterval(() => setToday(malaysianToday()), 60000);
    return () => clearInterval(tick);
  }, []);
  const [selected, setSelected] = useState(today);
  const day = new Date(selected + 'T00:00:00Z');
  const monthStart = (delta: number) =>
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + delta, 1);
  const start = monthStart(0),
    end = monthStart(1);
  const after = new Date(start - offset).toISOString();
  const before = new Date(end - offset).toISOString();
  const deadlines = useFocusedQuery(
    useCallback(async () => {
      const { data, error } = await client().rpc('daily_due', {
        p_scope: scope,
        p_after: after,
        p_before: before,
      });
      if (error?.code === 'PGRST202') return null;
      if (error) throw error;
      return (data ?? []) as Deadline[];
    }, [scope, after, before]),
  );
  const dueOn = (ms: number) =>
    (deadlines.data ?? []).filter((item) => {
      const when = Date.parse(item.due_at);
      return when >= ms - offset && when < ms + dayMs - offset;
    });
  const result = useFocusedQuery(
    useCallback(
      () => eventsInRange(scope, after, before),
      [scope, after, before],
    ),
  );
  const locale = language === 'zh' ? 'zh-CN' : 'en-GB';
  const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const onDay = (ms: number) =>
    (result.data ?? []).filter(
      (e) =>
        Date.parse(e.starts_at) < ms + dayMs - offset &&
        Date.parse(e.ends_at) > ms - offset,
    );
  const first = start - ((new Date(start).getUTCDay() + 6) % 7) * dayMs;
  const weeks = Math.ceil((end - first) / (7 * dayMs));
  const entries = onDay(day.getTime());
  const assignments = dueOn(day.getTime());
  return (
    <Card>
      <SectionTitle icon="calendar">{t('Club calendar')}</SectionTitle>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Button
          title="‹"
          accessibilityLabel={t('Previous month')}
          variant="ghost"
          onPress={() => setSelected(stamp(monthStart(-1)))}
        />
        <Body>
          {day.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            timeZone: 'UTC',
          })}
        </Body>
        <Button
          title="›"
          accessibilityLabel={t('Next month')}
          variant="ghost"
          onPress={() => setSelected(stamp(end))}
        />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {Array.from({ length: 7 }, (_, i) => (
          <Text
            key={i}
            style={{ flex: 1, textAlign: 'center', color: theme.color.muted }}
          >
            {new Date(first + i * dayMs).toLocaleDateString(locale, {
              weekday: 'short',
              timeZone: 'UTC',
            })}
          </Text>
        ))}
      </View>
      {Array.from({ length: weeks }, (_, week) => (
        <View key={week} style={{ flexDirection: 'row' }}>
          {Array.from({ length: 7 }, (_, i) => {
            const ms = first + (7 * week + i) * dayMs,
              key = stamp(ms),
              active = key === selected,
              marked = onDay(ms).some((e) => !e.cancelled),
              due = dueOn(ms).length > 0;
            if (ms < start || ms >= end)
              return <View key={key} style={{ flex: 1 }} />;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={[
                  key,
                  marked && t('Has events'),
                  due && t('Homework due'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => setSelected(key)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  backgroundColor: active
                    ? theme.color.selected
                    : 'transparent',
                  borderWidth: 1,
                  borderColor:
                    key === today ? theme.color.primary : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: theme.color.text,
                    fontWeight: active ? '700' : '400',
                  }}
                >
                  {new Date(ms).getUTCDate()}
                </Text>
                <View style={{ flexDirection: 'row', gap: 3, height: 4 }}>
                  {marked && (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: theme.color.primary },
                      ]}
                    />
                  )}
                  {due && (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: theme.color.violet },
                      ]}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Body>
        {day.toLocaleDateString(locale, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        })}
      </Body>
      {result.error ? (
        <>
          <Notice error text={result.error} />
          <Button title={t('Retry')} onPress={result.refresh} />
        </>
      ) : !result.data ? (
        <Body>{t('Loading events…')}</Body>
      ) : (
        entries.map((e) => (
          <View key={e.id}>
            <Body>
              {e.title}
              {e.cancelled ? ' · ' + t('Cancelled') : ''}
            </Body>
            <Body>
              {e.group_name ?? t('Big class')} · {dueLabel(e.starts_at)} –{' '}
              {dueLabel(e.ends_at)}
              {e.location ? ' · ' + e.location : ''}
            </Body>
            {!!e.description && <Body>{e.description}</Body>}
          </View>
        ))
      )}
      {deadlines.error ? (
        <>
          <Notice error text={deadlines.error} />
          <Button title={t('Retry')} onPress={() => void deadlines.refresh()} />
        </>
      ) : deadlines.data === null ? (
        <Body>{t('Homework dates need a database update.')}</Body>
      ) : deadlines.data === undefined ? (
        <Body>{t('Loading homework…')}</Body>
      ) : (
        assignments.map((item) => (
          <NavigationRow
            key={item.id}
            icon="homework"
            title={item.title}
            subtitle={[
              t('Homework due'),
              item.group_name ?? t('Big class'),
              dueLabel(item.due_at),
            ].join(' · ')}
            onPress={() =>
              router.push({
                pathname: '/assignment',
                params: { id: item.id, mode: 'mine' },
              })
            }
          />
        ))
      )}
      {result.data &&
        deadlines.data &&
        !entries.length &&
        !assignments.length && (
          <Body>{t('Nothing scheduled on this day.')}</Body>
        )}
      <Button
        title={t('Your club calendar')}
        variant="ghost"
        onPress={() => router.push('/events')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  dot: { height: 4, width: 4, borderRadius: 2 },
});
