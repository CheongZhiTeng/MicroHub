import { useCallback } from 'react';
import { useFocusedQuery } from './focused-query';
import { client } from '../lib/supabase';

export function useReach(scope: string) {
  return useFocusedQuery(
    useCallback(async () => {
      if (!scope) return null;
      const { data, error } = await client().rpc('class_reach', {
        p_group: scope === 'big' ? null : scope,
      });
      if (error?.code === 'PGRST202') return null;
      if (error) throw error;
      return data as number;
    }, [scope]),
  );
}
export function initialScope(
  value: unknown,
  big: boolean,
  groups: { id: string }[],
) {
  return value === 'big' && big
    ? 'big'
    : groups.some((g) => g.id === value)
      ? String(value)
      : '';
}
export function publishLabel(
  t: (s: string) => string,
  scope: string,
  n: number,
) {
  return (
    t('Publish to ') + scope + ' · ' + n + t(n === 1 ? ' person' : ' people')
  );
}

export function useCreationScope(scope: string) {
  const match = useFocusedQuery(
    useCallback(async () => {
      if (scope !== 'mine') return scope;
      const { data, error } = await client().rpc('hw_scopes');
      if (error) throw error;
      for (const g of (data ?? []) as { id: string }[]) {
        const result = await client().rpc('class_scope_matches', {
          gid: g.id,
          scope: 'mine',
        });
        if (result.error) throw result.error;
        if (result.data) return g.id;
      }
      return 'all';
    }, [scope]),
  );
  return scope === 'mine' ? match.data : scope;
}
