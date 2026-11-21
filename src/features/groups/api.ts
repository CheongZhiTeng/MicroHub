import { client } from '../../lib/supabase';
import type { ProfileNames } from '../../lib/profile-name';

export type Person = ProfileNames & {
  id: string;
  student_id: string;
  teacher: boolean;
  teach_access?: boolean;
  leader: boolean;
  eligible: boolean;
  group_id: string | null;
};
export type Group = {
  id: string;
  name: string;
  revision: number;
  state: 'draft' | 'active' | 'archived';
  teacher_id: string | null;
  manage: boolean;
  roster: Person[];
  changes: {
    id: number;
    action: string;
    happened_at: string;
    actor: string;
    subject: string | null;
  }[];
};
export type Workspace = { groups: Group[]; candidates: Person[] };
export type Change = {
  p_action: string;
  p_group: string | null;
  p_revision: number | null;
  p_person?: string;
  p_name?: string;
  p_source?: string;
  p_source_revision?: number;
  p_replace?: string;
};
export const actions: Record<string, string> = {
  create: 'Create group',
  teacher: 'Appoint teach',
  appoint_teach: 'Grant teach access and appoint',
  assign: 'Assign student',
  transfer_out: 'Transfer out',
  promote: 'Appoint leader',
  demote: 'Remove leader role',
  remove: 'Remove from group',
  activate: 'Activate group',
  archive: 'Delete group',
};
export async function loadGroups() {
  const { data, error } = await client().rpc('group_workspace');
  if (error?.code === 'PGRST202')
    throw new Error('Groups are awaiting a database update.');
  if (error) throw error;
  return data as Workspace;
}
export async function changeGroup(args: Change) {
  const { data, error } = await client().rpc('group_change', args);
  if (error) throw error;
  return data as string;
}

export async function deleteGroup(
  group: string,
  revision: number,
  password: string,
) {
  const { error } = await client().functions.invoke('delete-group', {
    body: { group, revision, password },
  });
  if (error) {
    const response = error.context;
    const result =
      typeof response?.json === 'function'
        ? await response.json().catch(() => null)
        : null;
    throw Error(result?.message ?? 'Could not confirm group deletion.');
  }
  return group;
}
