-- Return a single transaction snapshot for previews and exports, regardless of the
-- PostgREST row cap. Pagination remains available to existing clients.
create function public.hw_report_snapshot(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(rows) order by rows.student_id,rows.member_id),'[]'::jsonb)
 from generate_series(0,(select count(*)::integer/100 from public.assignment_recipients where assignment_id=p_id)) page
 cross join lateral (select * from public.hw_report(p_id,page) limit 100) rows where public.hw_staff(p_id)
$$;
create function public.hw_changes(p_id uuid,p_page integer) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(e) order by created_at desc,id),'[]'::jsonb) from
 (select id,action,actor_id,details,created_at from public.assignment_audit_events where assignment_id=p_id and public.hw_staff(p_id)
 order by created_at desc,id limit 21 offset greatest(0,p_page)::bigint*20)e
$$;
revoke all on function public.hw_report_snapshot(uuid),public.hw_changes(uuid,integer) from public,anon,authenticated;
grant execute on function public.hw_report_snapshot(uuid),public.hw_changes(uuid,integer) to authenticated;

-- Expire abandoned reservations even on days when nobody uploads. Deleted
-- metadata is queued until Storage confirms object deletion.
do $$ begin
 if exists(select from pg_extension where extname='pg_cron') then
 perform cron.schedule('microhub-homework-expire','17 * * * *',
 $job$delete from public.assignment_attachments where state='pending' and created_at<now()-interval '1 day'$job$);
 end if;
end $$;
create or replace function public.hw_list(p_staff boolean,p_filter text,p_search text,p_page integer)
returns jsonb language sql stable set search_path='' as $$
  with visible as (
    select a.group_id,a.group_name,a.id,a.title,a.lifecycle,coalesce(s.effective_due_at,a.due_at) as due_at,
      s.submission,s.grading,s.modification,s.late,s.draft_revision,s.latest,s.excused,s.detached
    from public.assignments a left join public.hw_recipient_status s on s.assignment_id=a.id and s.member_id=auth.uid()
    where ((p_staff and public.hw_scope_staff(a.group_id)) or (not p_staff and s.member_id=auth.uid()))
      and strpos(lower(a.title),lower(p_search))>0
  ), page as (
    select * from visible where case p_filter
      when 'todo' then not detached and not excused and (latest=0 or modification='Revision requested') and lifecycle<>'archived'
      when 'submitted' then latest>0 when 'returned' then grading='Returned'
      when 'draft' then lifecycle='draft' when 'published' then lifecycle='published' when 'closed' then lifecycle='closed' when 'archived' then lifecycle='archived' when 'all' then lifecycle<>'archived' else false end
    order by (modification='Revision requested') desc nulls last,due_at,id
    limit 21 offset (20 * greatest(p_page,0)::bigint)
  ) select coalesce(jsonb_agg(to_jsonb(page)),'[]') from page;
$$;
create or replace function public.hw_add_recipients(p_id uuid, p_members uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare a public.assignments; added uuid[]; eligible integer; requested integer;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
  if not public.hw_staff(p_id) then raise exception 'Administrator required'; end if;
  select * into a from public.assignments where id=p_id for update;
  if a.lifecycle is distinct from 'published' then raise exception 'Choose a published assignment.'; end if;
  select count(distinct id) into requested from unnest(p_members) id;
  if requested=0 then raise exception 'Select at least one member.'; end if;
  with candidates as materialized (
    select p.id,p.display_name,p.student_id from public.profiles p join public.memberships m on m.user_id=p.id
    join auth.users u on u.id=p.id where (a.group_id is null or exists(select from public.group_students gs where gs.group_id=a.group_id and gs.user_id=p.id)) and p.id=any(p_members) and p.status='active' and m.status='active' and u.email_confirmed_at is not null
  ), additions as (
    insert into public.assignment_recipients (assignment_id,member_id,member_name,student_id)
    select p_id,id,display_name,student_id from candidates on conflict(assignment_id,member_id) do update set detached=false
    where public.assignment_recipients.detached and not exists(select from homework_private.team_drafts td where td.assignment_id=p_id and td.batch is not null) returning member_id
  ) select (select count(*) from candidates),array(select member_id from additions) into eligible,added;
  if eligible<>requested then raise exception 'Some selected members are no longer active. Refresh the list.'; end if;
  if cardinality(added)>0 then
    insert into public.assignment_audit_events(assignment_id,actor_id,action,details)
      values(p_id,auth.uid(),'add_recipients',jsonb_build_object('members',added));
  end if;
  return cardinality(added);
end $$;
