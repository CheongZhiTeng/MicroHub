import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { client } from '../../lib/supabase';
import { errorMessage } from '../../lib/validation';
import { useBusy } from '../busy';

export type Attachment = {
  id: string;
  filename: string;
  size_bytes: number;
  state: string;
  reference: boolean;
  version_id: string | null;
};
export type Assignment = {
  file_limit?: number;
  file_bytes?: number;
  file_mode?: string;
  id: string;
  title: string;
  instructions: string;
  lifecycle: 'draft' | 'published' | 'closed' | 'archived';
  due_at: string;
  max_points: number | null;
  allow_text: boolean;
  allow_link: boolean;
  allow_late: boolean;
  group_name?: string | null;
  group_id?: string | null;
  audience: 'all' | 'selected';
  revision: number;
};
export type Recipient = {
  member_id: string;
  member_name: string;
  student_id: string;
  exception_revision?: number;
  extension_at?: string | null;
  detached?: boolean;
  effective_due_at: string;
  latest: number;
  draft_revision: number | null;
  submission: string;
  late: boolean | null;
  grading: string | null;
  modification: string | null;
  blocked: string | null;
};
export type Draft = {
  body: string;
  link: string;
  revision: number;
  updated_at: string;
};
export type Feedback = {
  id: string;
  kind: 'release' | 'revision';
  includes_grade: boolean;
  score: number | null;
  feedback: string;
  created_at: string;
  revision_due_at: string | null;
};
export type Version = {
  id: string;
  version: number;
  body: string;
  link: string;
  submitted_at: string;
  effective_due_at: string;
  late: boolean;
  request_id: string;
  review: { revision: number; score: number | null; feedback: string } | null;
  events: Feedback[];
};
export type Detail = {
  assignment: Assignment;
  status: Recipient | null;
  targets: string[];
  draft: Draft | null;
  versions: Version[];
  files?: Attachment[];
  can_manage?: boolean;
  counts: {
    eligible?: number;
    missing?: number;
    returned?: number;
    late?: number;
    excused?: number;
    assigned: number;
    submitted: number;
    pending: number;
  } | null;
};
export type Item = Pick<
  Assignment,
  'id' | 'title' | 'due_at' | 'lifecycle' | 'group_name'
> &
  Pick<Recipient, 'submission' | 'grading' | 'late' | 'modification'>;
export type Summary = {
  todo: number;
  next: Item | null;
  submitted: number | null;
  pending: number | null;
};
type Responses = {
  hw_file_settings: null;
  hw_file_remove: null;
  hw_scopes: { id: string; name: string }[];
  hw_group_candidates: {
    id: string;
    student_id: string;
    display_name: string;
  }[];
  hw_save_scoped: number;
  hw_maintain: null;
  hw_exception: null;
  hw_list: Item[];
  hw_detail: Detail | null;
  hw_roster: Recipient[];
  hw_summary: Summary;
  hw_candidates: { id: string; student_id: string; display_name: string }[];
  hw_save_assignment: number;
  hw_publish: number;
  hw_add_recipients: number;
  hw_delete_draft: null;
  hw_save_draft: number;
  hw_submit: Version;
  hw_review: number;
};
type Params = Record<string, unknown>;
export const homeworkUnavailable = 'Homework is not available yet.';
export async function homework<K extends keyof Responses>(
  name: K,
  params: Params = {},
) {
  const { data, error } = await client().rpc(name, params);
  if (error?.code === 'PGRST202' || error?.code === '42883')
    throw new Error(homeworkUnavailable);
  if (error) throw error;
  return data as Responses[K];
}
type ReadName =
  | 'hw_scopes'
  | 'hw_group_candidates'
  | 'hw_list'
  | 'hw_detail'
  | 'hw_roster'
  | 'hw_summary'
  | 'hw_candidates';
export function useHomework<K extends ReadName>(name: K, params: Params = {}) {
  const key = JSON.stringify(params);
  const generation = useRef(0);
  const [result, setResult] = useState<{
    key: string;
    data?: Responses[K];
    error?: string;
  }>();
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const data = await homework(name, JSON.parse(key));
      if (current === generation.current) setResult({ key, data });
    } catch (e) {
      if (current === generation.current)
        setResult({ key, error: errorMessage(e) });
    }
  }, [key, name]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh();
      });
      return () => {
        generation.current++;
        sub.remove();
      };
    }, [refresh]),
  );
  return {
    data: result?.key === key ? result.data : undefined,
    error: result?.key === key ? result.error : undefined,
    refresh,
  };
}
export function useHomeworkAction() {
  const { start, finish, busy } = useBusy();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const run = async (action: () => Promise<string | void>) => {
    if (!start()) return;
    setError('');
    setMessage('');
    try {
      setMessage((await action()) || '');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      finish();
    }
  };
  return { busy, message, error, run };
}
export const pageSize = 20;
const dates = new Intl.DateTimeFormat('en-MY', {
  timeZone: 'Asia/Kuala_Lumpur',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});
export const dueLabel = (date: string) => dates.format(new Date(date)) + ' MYT';
export const dateInput = (date: string) =>
  new Date(new Date(date).getTime() + 8 * 3600000)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');
export function parseDate(input: string) {
  const local = input.trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(local))
    throw Error('Enter a Malaysia time as YYYY-MM-DD HH:mm.');
  const d = new Date(local.replace(' ', 'T') + ':00+08:00');
  if (!Number.isFinite(d.getTime()) || dateInput(d.toISOString()) !== local)
    throw Error('Enter a valid Malaysia date and time.');
  return d.toISOString();
}
export function points(input: string) {
  if (!input.trim()) return null;
  if (!/^\d+(\.\d+)?$/.test(input.trim()) || !Number.isFinite(Number(input)))
    throw Error('Enter a valid number of points.');
  return Number(input);
}
