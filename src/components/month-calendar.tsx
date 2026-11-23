import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { eventsInRange } from '../features/class-scope';
import { useFocusedQuery } from '../features/focused-query';
import { useLanguage } from '../locales/provider';
import { useTheme } from '../theme/provider';
import { Body, Button, Card, Notice, SectionTitle } from './ui';

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
  const result = useFocusedQuery(
    useCallback(
      () =>
        eventsInRange(
          scope,
          new Date(start - offset).toISOString(),
          new Date(end - offset).toISOString(),
        ),
      [scope, start, end],
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
              marked = onDay(ms).some((e) => !e.cancelled);
            if (ms < start || ms >= end)
              return <View key={key} style={{ flex: 1 }} />;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  key + (marked ? ' · ' + t('Has events') : '')
                }
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
                <View
                  style={{
                    height: 4,
                    width: 4,
                    borderRadius: 2,
                    backgroundColor: marked
                      ? theme.color.primary
                      : 'transparent',
                  }}
                />
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
      ) : !entries.length ? (
        <Body>{t('No events on this day.')}</Body>
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
          </View>
        ))
      )}
      <Button
        title={t('Your club calendar')}
        variant="ghost"
        onPress={() => router.push('/events')}
      />
    </Card>
  );
}
