create table public.club_announcements (
  id uuid primary key,
  group_id uuid references public.club_groups(id),
  author_id uuid not null references public.profiles(id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  published_at timestamptz not null default clock_timestamp()
);
create index club_announcements_scope_time
  on public.club_announcements(group_id, published_at desc, id desc);
alter table public.club_announcements enable row level security;
revoke all on public.club_announcements from public, anon, authenticated;

create function public.announcement_can_publish(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_member() and (
    (p_group is null and public.is_admin())
    or exists (
      select from public.club_groups g
      where g.state = 'active'
        and (p_group is null or g.id = p_group)
        and (g.teacher_id = auth.uid() or (p_group is not null and public.is_super_admin()))
    )
  )
$$;

create function public.announcement_feed(p_page integer default 0, p_preview boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  items jsonb;
  scopes jsonb := '[]'::jsonb;
begin
  if not public.is_member() then
    raise exception 'Active club membership is required.' using errcode = '42501';
  end if;

  with visible as (
    select a.id, a.title, a.body, a.published_at, a.group_id, g.name as group_name
    from public.club_announcements a
    left join public.club_groups g on g.id = a.group_id
    where a.group_id is null or (
      g.state = 'active' and (
        g.teacher_id = auth.uid() or public.is_super_admin()
        or exists (select from public.group_students s where s.group_id = g.id and s.user_id = auth.uid())
      )
    )
  ), page as (
    select id, title, case when not p_preview then body end as body, published_at, group_name
    from (
      select v.*, row_number() over (partition by (group_id is null) order by published_at desc, id desc) as scope_rank
      from visible v
    ) ranked
    where not p_preview or scope_rank <= 2
    order by published_at desc, id desc
    limit case when p_preview then 4 else 21 end
    offset case when p_preview then 0 else greatest(p_page, 0)::bigint * 20 end
  )
  select coalesce(jsonb_agg(to_jsonb(page) order by published_at desc, id desc), '[]'::jsonb)
  into items from page;

  if not p_preview then
    select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) order by g.name, g.id), '[]'::jsonb)
    into scopes from public.club_groups g
    where g.state = 'active' and public.announcement_can_publish(g.id);
  end if;
  return jsonb_build_object(
    'items', items, 'groups', scopes,
    'can_publish_club', (not p_preview and public.announcement_can_publish(null))
  );
end $$;

create function public.announcement_publish(p_id uuid, p_group uuid, p_title text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  saved public.club_announcements;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(245619, 1);
  if not public.announcement_can_publish(p_group) then
    raise exception 'You cannot publish to this audience.' using errcode = '42501';
  end if;
  insert into public.club_announcements(id, group_id, author_id, title, body)
  values (p_id, p_group, auth.uid(), btrim(p_title), btrim(p_body))
  on conflict (id) do nothing returning * into saved;
  if found then
    insert into public.audit_logs(actor_id, action, target_id, details)
    values (auth.uid(), 'announcement.publish', p_id, jsonb_build_object('group_id', p_group));
  else
    select * into strict saved from public.club_announcements where id = p_id;
    if saved.author_id is distinct from auth.uid() or saved.group_id is distinct from p_group
      or saved.title is distinct from btrim(p_title) or saved.body is distinct from btrim(p_body) then
      raise exception 'Announcement request already used.' using errcode = '23505';
    end if;
  end if;
  return p_id;
end $$;

revoke all on function public.announcement_can_publish(uuid), public.announcement_feed(integer, boolean),
  public.announcement_publish(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.announcement_feed(integer, boolean),
  public.announcement_publish(uuid, uuid, text, text) to authenticated;
