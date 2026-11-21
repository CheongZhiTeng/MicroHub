-- Leaving a group preserves one's own historical receipts while withdrawing
-- live instructions, discussion and reference files, including direct table reads.
alter policy read_assignments on public.assignments using
 (public.hw_scope_staff(group_id) or (lifecycle<>'draft' and exists(select from public.assignment_recipients r
 where r.assignment_id=assignments.id and r.member_id=auth.uid() and not r.detached)));
create function public.hw_own_history(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('assignment',jsonb_build_object('id',a.id,'title',a.title,'instructions','','group_name',a.group_name,
 'group_id',a.group_id,'lifecycle','archived','due_at',last.effective_due_at,'revision',a.revision,'max_points',a.max_points,
 'allow_text',false,'allow_link',false,'allow_late',false,'audience',a.audience),
 'can_manage',false,'joint_open',false,'counts',null,'targets','[]'::jsonb,'draft',null,
 'status',jsonb_build_object('member_id',r.member_id,'member_name',r.member_name,'student_id',r.student_id,'latest',last.version,
 'effective_due_at',last.effective_due_at,'late',last.late,'submission','Submitted','grading',case when exists(select from public.assignment_review_events e where e.version_id=last.id and e.includes_grade) then 'Returned' else 'Awaiting review' end,
 'detached',true,'blocked','You have left this group.'),
 'versions',(select jsonb_agg(to_jsonb(v)||jsonb_build_object('can_grade',false,'review',null,
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]') from public.assignment_review_events e where e.version_id=v.id)) order by v.version desc)
 from public.submission_versions v where v.member_id=r.member_id and v.assignment_id=a.id),
 'files',(select coalesce(jsonb_agg((to_jsonb(f)-'digest')||jsonb_build_object('version_id',own.id)),'[]')
 from public.submission_versions own join public.submission_versions anchor on (anchor.id=own.id or anchor.team_batch=own.team_batch)
 join public.assignment_attachments f on f.version_id=anchor.id where own.assignment_id=a.id and own.member_id=r.member_id and f.state='ready'))
 from public.assignment_recipients r join public.assignments a on a.id=r.assignment_id
 join lateral(select * from public.submission_versions v where v.assignment_id=a.id and v.member_id=r.member_id order by version desc limit 1) last on true
 where public.is_member() and r.assignment_id=p_id and r.member_id=auth.uid() and r.detached
$$;
create function public.hw_history_list() returns table(group_id uuid,group_name text,id uuid,title text,lifecycle text,due_at timestamptz,
 submission text,grading text,modification text,late boolean,draft_revision integer,latest integer,excused boolean,detached boolean)
language sql stable security definer set search_path='' as $$
 select a.group_id,a.group_name,a.id,a.title,'archived',v.effective_due_at,'Submitted',
 case when exists(select from public.assignment_review_events e where e.version_id=v.id and e.includes_grade) then 'Returned' else 'Awaiting review' end,
 null::text,v.late,null::integer,v.version,r.excused,true
 from public.assignment_recipients r join public.assignments a on a.id=r.assignment_id
 join lateral(select * from public.submission_versions ver where ver.assignment_id=a.id and ver.member_id=r.member_id order by version desc limit 1)v on true
 where r.detached and public.is_member() and r.member_id=auth.uid() and not public.hw_staff(a.id)
$$;
revoke all on function public.hw_own_history(uuid),public.hw_history_list() from public,anon,authenticated;
grant execute on function public.hw_own_history(uuid),public.hw_history_list() to authenticated;
create or replace function public.hw_detail(p_id uuid,p_member uuid default null)
returns jsonb language sql stable set search_path='' as $$
  select coalesce((select jsonb_build_object('assignment',to_jsonb(a),
    'files',(select coalesce(jsonb_agg((to_jsonb(f)-'digest')||jsonb_build_object('version_id',coalesce(public.hw_joint_receipt(f.version_id,coalesce(p_member,auth.uid())),f.version_id)) order by f.created_at),'[]') from public.assignment_attachments f
 where f.assignment_id=a.id and (f.reference or f.owner_id=coalesce(p_member,auth.uid()) or (f.joint and (public.hw_joint_receipt(f.version_id,coalesce(p_member,auth.uid())) is not null or (f.version_id is null and public.hw_joint_member(a.id)))))),
    'joint_open',public.hw_joint_open(a.id),'can_manage',public.hw_staff(p_id),'targets',(select coalesce(jsonb_agg(t.member_id),'[]') from public.assignment_targets t where assignment_id=p_id),
    'status',(select to_jsonb(s) from public.hw_recipient_status s where assignment_id=p_id and member_id=coalesce(p_member,auth.uid())),
    'draft',coalesce(case when coalesce(p_member,auth.uid())=auth.uid() then public.hw_joint_draft(a.id) end,(select to_jsonb(d) from public.submission_drafts d where assignment_id=p_id and member_id=coalesce(p_member,auth.uid()))),
    'versions',(select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('can_grade',public.hw_grade_version(v.id),'review',(
      select to_jsonb(g) from public.assignment_reviews g where g.version_id=v.id),
      'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]') from public.assignment_review_events e where e.version_id=v.id)) order by v.version desc),'[]')
      from public.submission_versions v where assignment_id=p_id and member_id=coalesce(p_member,auth.uid())),
    'counts',case when public.hw_staff(p_id) then (select jsonb_build_object('eligible',count(*) filter(where not excused),'late',count(*) filter(where late and not excused),'missing',count(*) filter(where submission='Missing'),'excused',count(*) filter(where excused),'returned',count(*) filter(where grading='Returned'),'assigned',count(*),'submitted',count(*) filter(where latest>0 and not excused),
      'pending',count(*) filter(where latest>0 and grading<>'Returned' and revision_for is null and not excused)) from public.hw_recipient_status where assignment_id=p_id) end)
  from public.assignments a where a.id=p_id),case when p_member is null or p_member=auth.uid() then public.hw_own_history(p_id) end);
$$;
create or replace function public.hw_list(p_staff boolean,p_filter text,p_search text,p_page integer)
returns jsonb language sql stable set search_path='' as $$
  with visible as (
    select a.group_id,a.group_name,a.id,a.title,a.lifecycle,coalesce(s.effective_due_at,a.due_at) as due_at,
      s.submission,s.grading,s.modification,s.late,s.draft_revision,s.latest,s.excused,s.detached
    from public.assignments a left join public.hw_recipient_status s on s.assignment_id=a.id and s.member_id=auth.uid()
    where ((p_staff and public.hw_scope_staff(a.group_id)) or (not p_staff and s.member_id=auth.uid()))
      and strpos(lower(a.title),lower(p_search))>0
    union all select * from public.hw_history_list() h where not p_staff and strpos(lower(h.title),lower(p_search))>0
  ), page as (
    select * from visible where case p_filter
      when 'todo' then not detached and not excused and (latest=0 or modification='Revision requested') and lifecycle<>'archived'
      when 'submitted' then latest>0 when 'returned' then grading='Returned'
      when 'draft' then lifecycle='draft' when 'published' then lifecycle='published' when 'closed' then lifecycle='closed' when 'archived' then lifecycle='archived' when 'all' then lifecycle<>'archived' else false end
    order by (modification='Revision requested') desc nulls last,due_at,id
    limit 21 offset (20 * greatest(p_page,0)::bigint)
  ) select coalesce(jsonb_agg(to_jsonb(page)),'[]') from page;
$$;
create table homework_private.maintenance(singleton boolean primary key check(singleton),origin text not null,token uuid not null default gen_random_uuid());
create function public.hw_storage_origin(p_origin text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_origin ~ '^https://[a-z0-9]+[.]supabase[.]co$' then
 insert into homework_private.maintenance(singleton,origin) values(true,p_origin) on conflict(singleton) do nothing;
 end if;
end $$;
create function public.hw_storage_worker(p_token text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from homework_private.maintenance where token::text=p_token)
$$;
revoke all on function public.hw_storage_origin(text),public.hw_storage_worker(text) from public,anon,authenticated;
grant execute on function public.hw_storage_origin(text),public.hw_storage_worker(text) to service_role;
do $$ begin
 if exists(select from pg_extension where extname='pg_cron') and exists(select from pg_available_extensions where name='pg_net') then
 create extension if not exists pg_net;
 perform cron.schedule('microhub-homework-storage-cleanup','*/15 * * * *',
 $job$select net.http_post(url:=origin||'/functions/v1/homework-files?mode=cleanup',
 headers:=jsonb_build_object('x-maintenance-token',token::text),body:='{}'::jsonb) from homework_private.maintenance
 where exists(select from homework_private.file_cleanup)$job$);
 end if;
end $$;
create or replace view public.hw_recipient_status with (security_invoker=true) as
select r.assignment_id,r.member_id,r.member_name,r.student_id,r.excused,
  coalesce(r.revision_due_at,r.extension_at,a.due_at) as effective_due_at,
  r.revision_due_at,r.revision_for,v.id as version_id,coalesce(v.version,0) as latest,
  v.late, coalesce(d.revision,case when r.member_id=auth.uid() then (public.hw_joint_draft(a.id)->>'revision')::integer end) as draft_revision,
  case when r.excused then 'Excused' when v.id is not null then 'Submitted'
    when now()>coalesce(r.extension_at,a.due_at) then 'Missing' when d.revision is not null or (r.member_id=auth.uid() and public.hw_joint_draft(a.id) is not null) then 'Draft' else 'Not submitted' end as submission,
  case when v.id is null then null when exists(select 1 from public.assignment_review_events e where e.version_id=v.id and e.includes_grade) then 'Returned'
    when g.version_id is not null then 'Grading draft' else 'Awaiting review' end as grading,
  case when r.revision_for is not null then 'Revision requested' when v.version>1 then 'Resubmitted' else null end as modification,
  case when r.detached then 'You have left this group.' else homework_private.submission_block(a.lifecycle,r.excused,coalesce(v.version,0),r.revision_for,r.revision_due_at,coalesce(r.extension_at,a.due_at),a.allow_late,now()) end as blocked,r.detached,r.extension_at,r.exception_revision
from public.assignment_recipients r join public.assignments a on a.id=r.assignment_id
left join lateral (select s.id,s.version,s.late from public.submission_versions s where s.assignment_id=r.assignment_id and s.member_id=r.member_id order by s.version desc limit 1) v on true
left join public.submission_drafts d on d.assignment_id=r.assignment_id and d.member_id=r.member_id
left join public.assignment_reviews g on g.version_id=v.id;
