import { useCallback, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { client } from '../../lib/supabase';
import { errorMessage } from '../../lib/validation';

export type Mark = 'Present' | 'Late' | 'Absent' | 'Waiting';
export type Roll = {
  en: string;
  zh: string;
  status: Mark;
  student?: string;
  revision?: number;
};
type SessionRow = {
  id: string;
  title: string;
  group_name: string | null;
  opened: string;
  ends: string;
  personal: Mark | null;
};
export type SessionDetail = SessionRow & {
  generation?: number;
  corrections?: {
    id: number;
    at_time: string;
    reason: string;
    previous: Mark;
    replacement: Mark;
    name_en: string;
    name_zh: string;
    actor: string;
  }[];
  live: boolean;
  manager: boolean;
  server_now: string;
  roster: Roll[] | null;
  checked_at: string | null;
};
export type EventAttendanceSetup = {
  title: string;
  class_name: string | null;
  revision: number;
  students: number;
};
type Responses = {
  attendance_event: { session_id?: string; setup?: EventAttendanceSetup };
  attendance_open_event: { session_id: string; code?: string };
  attendance_scopes: { id: string | null; name: string; students: number }[];
  attendance_summary: { total: number; attended: number; late: number };
  attendance_list: SessionRow[];
  attendance_panel: SessionDetail;
  attendance_rotate: string;
  attendance_check: { error?: string; status?: Mark; checked_at?: string };
  attendance_open: string | null;
  attendance_control: string | null;
  attendance_correct: null;
};
export async function attendance<K extends keyof Responses>(
  name: K,
  params: Record<string, unknown> = {},
) {
  const { data, error } = await client().rpc(name, params);
  if (error?.code === 'PGRST202')
    throw Error('Attendance is awaiting a database update.');
  if (error) throw error;
  return data as Responses[K];
}
export function markLabel(mark: Mark) {
  return {
    Present: 'Checked in',
    Late: 'Late arrival',
    Absent: 'Absent',
    Waiting: 'Not checked in',
  }[mark];
}

// Foreground-only reads. Losing focus or failing a permission check clears the prior roster.
export function useAttendanceRead<T>(
  load: () => Promise<T>,
  interval = 0,
  sessionId?: string,
) {
  const [result, setResult] = useState<{
    load: typeof load;
    data?: T;
    error?: string;
  }>();
  const reading = useRef(false);
  const sequence = useRef(0),
    visible = useRef(false);
  const refresh = useCallback(async () => {
    if (!visible.current) return;
    const seq = ++sequence.current;
    reading.current = true;
    try {
      const data = await load();
      if (sequence.current === seq) setResult({ load, data });
    } catch (e) {
      if (sequence.current === seq) setResult({ load, error: errorMessage(e) });
    } finally {
      if (sequence.current === seq) reading.current = false;
    }
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | undefined;
      let channel: ReturnType<ReturnType<typeof client>['channel']> | undefined;
      const clear = () => {
        ++sequence.current;
        reading.current = false;
        visible.current = false;
        setResult(undefined);
        clearInterval(timer);
        if (channel) {
          void client().removeChannel(channel);
          channel = undefined;
        }
      };
      const sync = () => {
        if (
          AppState.currentState === 'background' ||
          AppState.currentState === 'inactive' ||
          (Platform.OS === 'web' && document.hidden)
        ) {
          clear();
          return;
        }
        if (visible.current) return;
        visible.current = true;
        void refresh();
        const poll = () => {
          if (!reading.current) void refresh();
        };
        if (interval) timer = setInterval(poll, interval);
        if (sessionId)
          channel = client()
            .channel('attendance-' + sessionId)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'attendance_signals',
                filter: 'session_id=eq.' + sessionId,
              },
              poll,
            )
            .subscribe();
      };
      sync();
      const listener = AppState.addEventListener('change', sync);
      if (Platform.OS === 'web')
        document.addEventListener('visibilitychange', sync);
      return () => {
        clear();
        listener.remove();
        if (Platform.OS === 'web')
          document.removeEventListener('visibilitychange', sync);
      };
    }, [interval, refresh, sessionId]),
  );
  return {
    data: result?.load === load ? result.data : undefined,
    error: result?.load === load ? result.error : undefined,
    refresh,
  };
}
