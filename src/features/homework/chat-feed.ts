import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, Platform } from 'react-native';
import { client } from '../../lib/supabase';
import { errorMessage } from '../../lib/validation';

export type ChatMessage = {
  id: string;
  author: string;
  author_name: string;
  body: string;
  created_at: string;
};
const limit = 20;
async function page(id: string, before?: ChatMessage): Promise<ChatMessage[]> {
  let query = client()
    .from('homework_comments')
    .select('id,author,author_name,body,created_at')
    .eq('assignment_id', id);
  if (before) {
    // These are server-issued timestamptz and UUID values. Tie-break equal timestamps.
    query = query.or(
      `created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`,
    );
  }
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (error) throw error;
  return data;
}

// Keep the server cursor separate from scroll position. New posts cannot shift an older page.
export function useChatFeed(id: string) {
  const [rows, setRows] = useState<ChatMessage[]>([]);
  const snapshot = useRef<ChatMessage[]>([]);
  const [earlier, setEarlier] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const active = useRef(false);
  const inFlight = useRef(false);
  const refresh = useCallback(
    async (older = false) => {
      if (!active.current || inFlight.current) return;
      const ticket = generation.current;
      const current = () => active.current && generation.current === ticket;
      const previous = snapshot.current;
      inFlight.current = true;
      setLoading(true);
      try {
        const head = previous.at(-1);
        let batch = await page(id, older ? previous[0] : undefined);
        if (!current()) return;
        let added = batch.slice(0, limit);
        if (!older && head) {
          // Catch up after backgrounding even when more than a page arrived.
          while (
            batch.length > limit &&
            !added.some((row) => row.id === head.id)
          ) {
            batch = await page(id, added.at(-1));
            if (!current()) return;
            added = added.concat(batch.slice(0, limit));
          }
        }
        if (older || !head || !added.length) setEarlier(batch.length > limit);
        if (!older && !added.length) snapshot.current = [];
        else {
          const known = new Set(previous.map((row) => row.id));
          const fresh = added.filter((row) => !known.has(row.id)).reverse();
          if (fresh.length)
            snapshot.current = older
              ? [...fresh, ...previous]
              : [...previous, ...fresh];
        }
        setRows(snapshot.current);
        setError('');
        return added.length > 0;
      } catch (e) {
        if (current()) setError(errorMessage(e));
      } finally {
        if (current()) {
          inFlight.current = false;
          setLoading(false);
        }
      }
    },
    [id],
  );
  useFocusEffect(
    useCallback(() => {
      let interval: ReturnType<typeof setInterval> | undefined;
      const sync = () => {
        const visible =
          AppState.currentState !== 'background' &&
          AppState.currentState !== 'inactive' &&
          (Platform.OS !== 'web' || document.visibilityState !== 'hidden');
        if (active.current === visible) return;
        generation.current++;
        inFlight.current = false;
        active.current = visible;
        clearInterval(interval);
        if (visible) {
          void refresh();
          interval = setInterval(() => void refresh(), 10000);
        }
      };
      sync();
      const sub = AppState.addEventListener('change', sync);
      if (Platform.OS === 'web')
        document.addEventListener('visibilitychange', sync);
      return () => {
        generation.current++;
        active.current = false;
        inFlight.current = false;
        clearInterval(interval);
        sub.remove();
        if (Platform.OS === 'web')
          document.removeEventListener('visibilitychange', sync);
      };
    }, [refresh]),
  );
  return { rows, earlier, loading, error, refresh };
}
