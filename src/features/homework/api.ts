import { useCallback, useState } from 'react';
import { useFocusedQuery } from '../focused-query';
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
  joint?: boolean;
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
  supersedes?: string | null;
  id: string;
  kind: 'release' | 'revision';
  includes_grade: boolean;
  score: number | null;
  feedback: string;
  created_at: string;
  revision_due_at: string | null;
};
export type Version = {
  can_grade?: boolean;
  team_batch?: string | null;
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
  joint_open?: boolean;
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
  Pick<Recipient, 'submission' | 'grading' | 'late' | 'modification'> &
  Partial<
    Pick<Recipient, 'blocked' | 'draft_revision' | 'latest' | 'detached'>
  > & { pending?: number };
export type Summary = {
  todo: number;
  next: Item | null;
  submitted: number | null;
  pending: number | null;
};
export type ReportRow = {
  ready?: boolean;
  bulk_approved?: boolean;
  member_id: string;
  student_id: string;
  member_name: string;
  submission: string;
  grading: string | null;
  late: boolean | null;
  version_id: string | null;
  version: number;
  review_revision: number | null;
  released_score: number | null;
  effective_due_at: string;
  submitted_at: string | null;
};
type Responses = {
  daily_publish: number;
  daily_list: Item[];
  daily_queue: { member_id: string; version_id: string }[];
  hw_preview_count: number | null;
  hw_report_snapshot: ReportRow[];
  hw_changes: {
    id: string;
    action: string;
    created_at: string;
    actor_id: string;
    details: { reason?: string; old_due?: string; new_due?: string };
  }[];
  hw_work_mode: null;
  hw_media_only: null;
  hw_copy_assignment: number;
  hw_report: ReportRow[];
  hw_release_saved: null;
  hw_mark_bulk_ready: null;
  hw_schedule: null;
  hw_schedule_info: { run_at: string; failure: string | null } | null;
  hw_comments: {
    id: string;
    author_name: string;
    body: string;
    created_at: string;
  }[];
  hw_comment: null;
  hw_tools: { id: string; kind: string; title: string; content: string }[];
  hw_preferences: null;
  hw_inbox: {
    preferences: { due: boolean; feedback: boolean; grading: boolean };
    items: {
      id: string;
      title: string;
      kind: string;
      at_time: string;
      mode: string;
    }[];
  };
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
  class_homework_list: Item[];
  class_homework_summary: Summary;
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
  if (error?.code === 'PGRST202' && name === 'daily_publish') {
    const preview = await client().rpc('hw_preview_count', {
      p_id: params.p_id,
    });
    if (preview.error) throw preview.error;
    if (preview.data !== params.p_expected)
      throw Error('Audience changed. Check the count again.');
    const { data: old, error: failure } = await client().rpc('hw_publish', {
      p_id: params.p_id,
      p_revision: params.p_revision,
    });
    if (failure) throw failure;
    return old as Responses[K];
  }
  if (error?.code === 'PGRST202' && name === 'daily_list') {
    const { data: old, error: failure } = await client().rpc(
      'class_homework_list',
      params,
    );
    if (failure) throw failure;
    return old as Responses[K];
  }
  if (error?.code === 'PGRST202' || error?.code === '42883')
    throw new Error(homeworkUnavailable);
  if (error) throw error;
  return data as Responses[K];
}
type ReadName =
  | 'daily_list'
  | 'daily_queue'
  | 'hw_preview_count'
  | 'hw_changes'
  | 'hw_report'
  | 'hw_schedule_info'
  | 'hw_comments'
  | 'hw_tools'
  | 'hw_inbox'
  | 'hw_scopes'
  | 'hw_group_candidates'
  | 'hw_list'
  | 'class_homework_list'
  | 'class_homework_summary'
  | 'hw_detail'
  | 'hw_roster'
  | 'hw_summary'
  | 'hw_candidates';
export function useHomework<K extends ReadName>(name: K, params: Params = {}) {
  const key = JSON.stringify(params);
  const load = useCallback(() => homework(name, JSON.parse(key)), [name, key]);
  return useFocusedQuery(load);
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
