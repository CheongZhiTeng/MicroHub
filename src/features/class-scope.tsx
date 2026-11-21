import { useCallback } from 'react';
import { client } from '../lib/supabase';
import { useFocusedQuery } from './focused-query';
import { Choices } from './homework/controls';
import { useLanguage } from '../locales/provider';
export function ClassScope({
  value,
  change,
  groups = [],
}: {
  value: string;
  change: (s: string) => void;
  groups?: { id: string; name: string }[];
}) {
  const { t } = useLanguage();
  return (
    <Choices
      value={value}
      onChange={change}
      items={[
        ['all', t('All classes')],
        ['big', t('Big class')],
        ['mine', t('My group')],
        ...groups.map((g) => [g.id, g.name] as const),
      ]}
    />
  );
}
export type ClassEvent = {
  id: string;
  group_id: string | null;
  group_name: string | null;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  revision: number;
  cancelled: boolean;
};
export function useEvents(scope: string, day = '', page = 0, preview = false) {
  return useFocusedQuery(
    useCallback(async () => {
      let after: string | null = null,
        before: string | null = null;
      if (day) {
        const time = Date.parse(day + 'T00:00:00+08:00');
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
          !Number.isFinite(time) ||
          new Date(time + 28800000).toISOString().slice(0, 10) !== day
        )
          throw Error('Enter a valid date.');
        after = new Date(time).toISOString();
        before = new Date(time + 86400000).toISOString();
      }
      const { data, error } = await client().rpc('class_events_feed', {
        p_scope: scope,
        p_after: after,
        p_before: before,
        p_page: page,
        p_preview: preview,
      });
      if (error?.code === 'PGRST202')
        throw Error('Calendar is awaiting a database update.');
      if (error) throw error;
      return data as ClassEvent[];
    }, [scope, day, page, preview]),
  );
}
