create function public.class_scope_matches(gid uuid, scope text)
returns boolean language sql stable security definer set search_path='' as $$
 select case when scope='all' then true when scope='big' then gid is null
 when scope='mine' then exists(select from public.club_groups g where g.id=gid and g.state='active' and
 (g.teacher_id=auth.uid() or exists(select from public.group_students s where s.group_id=g.id and s.user_id=auth.uid())))
 else public.is_super_admin() and gid::text=scope end
$$;
revoke all on function public.class_scope_matches(uuid,text) from public,anon;
grant execute on function public.class_scope_matches(uuid,text) to authenticated;

create table public.class_events (
 id uuid primary key, group_id uuid references public.club_groups(id), title text not null check(length(btrim(title)) between 1 and 160),
 location text not null check(length(location)<=200), description text not null check(length(description)<=10000),
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at),
 revision integer not null default 1, cancelled boolean not null default false
);
create index class_event_time on public.class_events(starts_at,id);
alter table public.class_events enable row level security;
revoke all on public.class_events from public,anon,authenticated;

create function public.class_events_feed(p_scope text,p_after timestamptz,p_before timestamptz,p_page integer,p_preview boolean)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(v) order by v.starts_at,v.id),'[]'::jsonb) from (
 select e.*,g.name group_name from public.class_events e left join public.club_groups g on g.id=e.group_id
 where public.is_member() and (e.group_id is null or (g.state='active' and (public.is_super_admin() or public.class_scope_matches(e.group_id,'mine'))))
 and public.class_scope_matches(e.group_id,p_scope)
 and e.ends_at>coalesce(p_after,now()) and (p_before is null or e.starts_at<p_before)
 and (not p_preview or not e.cancelled)
 order by e.starts_at,e.id limit case when p_preview then 3 else 21 end offset greatest(0,p_page)::bigint*20
 ) v
$$;
create function public.class_event_save(p_id uuid,p_group uuid,p_revision integer,p_title text,p_location text,p_description text,p_start timestamptz,p_end timestamptz,p_cancel boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.class_events;
begin
 perform pg_advisory_xact_lock_shared(245619,1);
 if not public.announcement_can_publish(p_group) then raise exception 'Active teach access required'; end if;
 if p_revision=0 and not p_cancel then
   insert into public.class_events(id,group_id,title,location,description,starts_at,ends_at)
   values(p_id,p_group,btrim(p_title),p_location,p_description,p_start,p_end) on conflict do nothing;
   if not found then
    select * into strict e from public.class_events where id=p_id;
    if (e.group_id,e.title,e.location,e.description,e.starts_at,e.ends_at,e.revision) is distinct from
     (p_group,btrim(p_title),p_location,p_description,p_start,p_end,1) then raise exception 'Event changed. Refresh and try again.'; end if;
    return p_id;
   end if;
 else
   update public.class_events set title=btrim(p_title), location=p_location,description=p_description,starts_at=p_start,ends_at=p_end,cancelled=p_cancel,revision=revision+1
   where id=p_id and group_id is not distinct from p_group and revision=p_revision and not cancelled;
   if not found then raise exception 'Event changed. Refresh and try again.'; end if;
 end if;
 insert into public.audit_logs(actor_id,action,target_id,details) values(auth.uid(),case when p_cancel then 'event.cancel' when p_revision=0 then 'event.create' else 'event.edit' end,p_id,jsonb_build_object('group_id',p_group));
 return p_id;
end $$;
revoke all on function public.class_event_save(uuid,uuid,integer,text,text,text,timestamptz,timestamptz,boolean),public.class_events_feed(text,timestamptz,timestamptz,integer,boolean) from public,anon;
grant execute on function public.class_event_save(uuid,uuid,integer,text,text,text,timestamptz,timestamptz,boolean),public.class_events_feed(text,timestamptz,timestamptz,integer,boolean) to authenticated;

create function public.class_announcements(p_page integer, p_preview boolean,p_scope text)
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
    where public.class_scope_matches(a.group_id,p_scope) and (a.group_id is null or (
      g.state = 'active' and (
        g.teacher_id = auth.uid() or public.is_super_admin()
        or exists (select from public.group_students s where s.group_id = g.id and s.user_id = auth.uid())
      )
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


create function public.class_homework_list(p_staff boolean,p_filter text,p_search text,p_page integer,p_scope text)
returns jsonb language sql stable set search_path='' as $$
  with visible as (
    select a.group_id,a.group_name,a.id,a.title,a.lifecycle,coalesce(s.effective_due_at,a.due_at) as due_at,
      s.submission,s.grading,s.modification,s.late,s.draft_revision,s.latest,s.excused,s.detached
    from public.assignments a left join public.hw_recipient_status s on s.assignment_id=a.id and s.member_id=auth.uid()
    where ((p_staff and public.hw_scope_staff(a.group_id)) or (not p_staff and s.member_id=auth.uid()))
      and strpos(lower(a.title),lower(p_search))>0
    union all select * from public.hw_history_list() h where not p_staff and strpos(lower(h.title),lower(p_search))>0
  ), page as (
    select * from visible where public.class_scope_matches(group_id,p_scope) and case p_filter
      when 'todo' then not detached and not excused and (latest=0 or modification='Revision requested') and lifecycle<>'archived'
      when 'submitted' then latest>0 when 'returned' then grading='Returned'
      when 'draft' then lifecycle='draft' when 'published' then lifecycle='published' when 'closed' then lifecycle='closed' when 'archived' then lifecycle='archived' when 'all' then lifecycle<>'archived' else false end
    order by (modification='Revision requested') desc nulls last,due_at,id
    limit 21 offset (20 * greatest(p_page,0)::bigint)
  ) select coalesce(jsonb_agg(to_jsonb(page)),'[]') from page;
$$;

revoke all on function public.class_announcements(integer,boolean,text), public.class_homework_list(boolean,text,text,integer,text) from public,anon;
grant execute on function public.class_announcements(integer,boolean,text), public.class_homework_list(boolean,text,text,integer,text) to authenticated;

create function public.class_homework_summary(p_scope text)
returns jsonb language sql stable set search_path='' as $$
 with statuses as (
   select s.*,a.lifecycle from public.hw_recipient_status s join public.assignments a on a.id=s.assignment_id
   where public.class_scope_matches(a.group_id,p_scope) and not s.excused and not s.detached
 )
 select jsonb_build_object(
   'todo',count(*) filter(where member_id=auth.uid() and lifecycle<>'archived' and (latest=0 or revision_for is not null)),
   'next',public.class_homework_list(false,'todo','',0,p_scope)->0,
   'submitted',case when public.is_admin() or exists(select from public.hw_scopes()) then count(*) filter(where public.hw_staff(assignment_id) and latest>0) end,
   'pending',case when public.is_admin() or exists(select from public.hw_scopes()) then count(*) filter(where public.hw_staff(assignment_id) and latest>0 and grading<>'Returned' and revision_for is null) end
 ) from statuses
$$;
revoke all on function public.class_homework_summary(text) from public,anon;
grant execute on function public.class_homework_summary(text) to authenticated;
