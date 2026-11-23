import { useCallback } from 'react';
import { client } from '../lib/supabase';
import { useFocusedQuery } from './focused-query';

export const announcementsUnavailable =
  'Announcements are awaiting a database update.';
export const announcementsPageSize = 20;

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  published_at: string;
  group_name: string | null;
};

type AnnouncementFeed = {
  items: Announcement[];
  groups: { id: string; name: string }[];
  can_publish_club: boolean;
};

export function useAnnouncements(page = 0, preview = false, scope = 'all') {
  const load = useCallback(async () => {
    const { data, error } = await client().rpc(
      scope === 'all' ? 'announcement_feed' : 'class_announcements',
      {
        ...(scope === 'all' ? {} : { p_scope: scope }),
        p_page: page,
        p_preview: preview,
      },
    );
    if (error?.code === 'PGRST202' || error?.code === '42883')
      throw Error(announcementsUnavailable);
    if (error) throw error;
    return data as AnnouncementFeed;
  }, [page, preview, scope]);
  return useFocusedQuery(load);
}

export async function publishAnnouncement(
  id: string,
  group: string,
  title: string,
  body: string,
  expected?: number | null,
) {
  const { error } = await client().rpc(
    typeof expected === 'number'
      ? 'daily_announcement'
      : 'announcement_publish',
    {
      ...(typeof expected === 'number' ? { p_expected: expected } : {}),
      p_id: id,
      p_group: group || null,
      p_title: title,
      p_body: body,
    },
  );
  if (error) throw error;
}
