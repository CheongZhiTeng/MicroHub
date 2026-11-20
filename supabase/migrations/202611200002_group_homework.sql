alter table public.assignments add column group_name text;
-- Group duties are scoped to the assignment; platform roles are unchanged.
alter table public.assignments add column group_id uuid references public.club_groups(id);
alter table public.assignment_recipients add column detached boolean not null default false;
create index assignments_group on public.assignments(group_id);

create function public.hw_scope_staff(scope_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when scope_id is null then public.is_admin() else public.is_member() and
 (public.is_super_admin() or exists(select from public.club_groups g where g.id=scope_id and g.state='active' and
 (g.teacher_id=auth.uid() or exists(select from public.group_students s where s.group_id=g.id and s.leader and s.user_id=auth.uid())))) end
$$;
create function public.hw_staff(task uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.assignments a where a.id=task and public.hw_scope_staff(a.group_id))
$$;
create function public.hw_grade(task uuid,student uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.assignments a where a.id=task and public.hw_scope_staff(a.group_id) and (a.group_id is null or student<>auth.uid()))
$$;
create function public.hw_scopes() returns table(id uuid,name text) language sql stable security definer set search_path='' as $$
 select g.id,g.name from public.club_groups g where g.state='active' and public.hw_scope_staff(g.id) order by g.name,g.id
$$;
create function homework_private.detach_student() returns trigger language plpgsql set search_path='' security definer as $$
begin
 if tg_op='DELETE' or old.group_id is distinct from new.group_id then
 update public.assignment_recipients r set detached=true from public.assignments a
 where a.id=r.assignment_id and a.group_id=old.group_id and r.member_id=old.user_id;
 end if;
 return null;
end $$;
create trigger homework_group_departure after update of group_id or delete on public.group_students for each row execute function homework_private.detach_student();

alter policy read_recipients on public.assignment_recipients using
 (public.hw_staff(assignment_id) or (public.is_member() and member_id=auth.uid() and (not detached or exists(select from public.submission_versions v where v.assignment_id=assignment_recipients.assignment_id and v.member_id=auth.uid()))));
alter policy read_assignments on public.assignments using
 (public.hw_scope_staff(group_id) or (lifecycle<>'draft' and exists(select from public.assignment_recipients r where r.assignment_id=assignments.id and r.member_id=auth.uid())));
alter policy staff_targets on public.assignment_targets using (public.hw_staff(assignment_id));
alter policy read_versions on public.submission_versions using (public.hw_grade(assignment_id,member_id) or (public.is_member() and member_id=auth.uid()));
alter policy staff_reviews on public.assignment_reviews using (exists(select from public.submission_versions v where v.id=version_id and public.hw_grade(v.assignment_id,v.member_id)));
alter policy staff_audit on public.assignment_audit_events using (public.hw_staff(assignment_id));
alter policy own_drafts on public.submission_drafts using (public.is_member() and member_id=auth.uid() and exists(select from public.assignment_recipients r where r.assignment_id=submission_drafts.assignment_id and r.member_id=auth.uid() and not r.detached));

create or replace function public.hw_save_scoped(p_id uuid,p_revision integer,p_title text,p_instructions text,
  p_due timestamptz,p_points numeric,p_text boolean,p_link boolean,p_late boolean,p_audience text,p_targets uuid[],p_group uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare updated integer;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
  if not public.hw_scope_staff(p_group) then raise exception 'Administrator required'; end if;
  if p_revision=0 then
    insert into public.assignments(id,created_by,title,instructions,due_at,max_points,allow_text,allow_link,allow_late,audience,group_id)
    values(p_id,auth.uid(),trim(p_title),p_instructions,p_due,p_points,p_text,p_link,p_late,p_audience,p_group)
    on conflict(id) do nothing returning revision into updated;
  else
    update public.assignments set title=trim(p_title),instructions=p_instructions,due_at=p_due,max_points=p_points,
      allow_text=p_text,allow_link=p_link,allow_late=p_late,audience=p_audience,revision=revision+1
      where id=p_id and group_id is not distinct from p_group and lifecycle='draft' and revision=p_revision returning revision into updated;
  end if;
  if updated is null then raise exception 'Assignment changed. Reload the saved draft.'; end if;
  delete from public.assignment_targets where assignment_id=p_id;
  if p_audience='selected' then
    if p_group is not null and exists(select from unnest(p_targets) target where not exists(select from public.group_students where group_id=p_group and user_id=target)) then raise exception 'Choose students in this group.'; end if;
    insert into public.assignment_targets select distinct p_id,member from unnest(p_targets) member;
  end if;
  return updated;
end $$;
create or replace function public.hw_save_assignment(p_id uuid,p_revision integer,p_title text,p_instructions text,
  p_due timestamptz,p_points numeric,p_text boolean,p_link boolean,p_late boolean,p_audience text,p_targets uuid[])
returns integer language sql set search_path='' as $$
 select public.hw_save_scoped(p_id,p_revision,p_title,p_instructions,p_due,p_points,p_text,p_link,p_late,p_audience,p_targets,null)
$$;
create or replace function public.hw_publish(p_id uuid,p_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare a public.assignments; n integer;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
  if not public.hw_staff(p_id) then raise exception 'Administrator required'; end if;
  select * into a from public.assignments where id=p_id for update;
  if a.lifecycle='published' and a.revision=p_revision+1 then
    return (select count(*) from public.assignment_recipients where assignment_id=p_id);
  end if;
  if a.lifecycle is distinct from 'draft' or a.revision is distinct from p_revision then raise exception 'Assignment changed. Preview again.'; end if;
  insert into public.assignment_recipients(assignment_id,member_id,member_name,student_id)
    select p_id,p.id,p.display_name,p.student_id from public.profiles p join public.memberships m on m.user_id=p.id
    join auth.users u on u.id=p.id where p.status='active' and m.status='active' and u.email_confirmed_at is not null
    and (a.group_id is null or exists(select from public.group_students gs where gs.group_id=a.group_id and gs.user_id=p.id)) and (a.audience='all' or exists(select 1 from public.assignment_targets t where t.assignment_id=p_id and t.member_id=p.id));
  get diagnostics n = row_count;
  if n=0 or (a.audience='selected' and n<>(select count(*) from public.assignment_targets where assignment_id=p_id)) then
    raise exception 'Choose active members before publishing.'; end if;
  update public.assignments set lifecycle='published',published_at=clock_timestamp(),revision=revision+1 where id=p_id;
  insert into public.assignment_audit_events(assignment_id,actor_id,action,details)
    values(p_id,auth.uid(),'publish',jsonb_build_object('recipients',n,'audience',a.audience));
  return n;
end $$;
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
    select p_id,id,display_name,student_id from candidates on conflict do nothing returning member_id
  ) select (select count(*) from candidates),array(select member_id from additions) into eligible,added;
  if eligible<>requested then raise exception 'Some selected members are no longer active. Refresh the list.'; end if;
  if cardinality(added)>0 then
    insert into public.assignment_audit_events(assignment_id,actor_id,action,details)
      values(p_id,auth.uid(),'add_recipients',jsonb_build_object('members',added));
  end if;
  return cardinality(added);
end $$;
create or replace function public.hw_delete_draft(p_id uuid,p_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare a public.assignments;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
  if not public.hw_staff(p_id) then raise exception 'Administrator required'; end if;
  select * into a from public.assignments where id=p_id for update;
  if not found then return; end if;
  if a.lifecycle<>'draft' or a.revision is distinct from p_revision then raise exception 'Only an unchanged, unpublished draft can be deleted.'; end if;
  delete from public.assignments where id=p_id;
  insert into public.audit_logs(actor_id,action,target_id,details) values(auth.uid(),'homework.delete_draft',p_id,jsonb_build_object('title',a.title));
end $$;
create or replace function public.hw_submit(p_id uuid,p_base integer,p_revision integer,p_request uuid)
returns public.submission_versions language plpgsql security definer set search_path='' as $$
declare a public.assignments; r public.assignment_recipients; d public.submission_drafts;
  receipt public.submission_versions; latest integer; due_time timestamptz; submitted timestamptz; blocked text;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
  if not public.is_member() then raise exception 'Active membership required'; end if;
  select * into r from public.assignment_recipients where assignment_id=p_id and member_id=auth.uid() for update;
  if not found then raise exception 'Assignment unavailable'; end if;
  select * into receipt from public.submission_versions where assignment_id=p_id and member_id=auth.uid() and request_id=p_request;
  if found then return receipt; end if;
  if r.detached then raise exception 'You have left this group.'; end if;
  select * into strict a from public.assignments where id=p_id for share;
  select coalesce(max(version),0) into latest from public.submission_versions where assignment_id=p_id and member_id=auth.uid();
  if latest is distinct from p_base then raise exception 'A submission already changed. Reload the receipt.'; end if;
  select * into d from public.submission_drafts where assignment_id=p_id and member_id=auth.uid();
  if not found or d.revision is distinct from p_revision then raise exception 'Draft conflict. Compare with the server draft.'; end if;
  submitted := clock_timestamp();
  due_time := coalesce(r.revision_due_at,r.extension_at,a.due_at);
  blocked := homework_private.submission_block(a.lifecycle,r.excused,latest,r.revision_for,r.revision_due_at,coalesce(r.extension_at,a.due_at),a.allow_late,submitted);
  if blocked is not null then raise exception '%',blocked; end if;
  if (d.body !~ '[^[:space:]]' and d.link='') or (not a.allow_text and d.body<>'') or (not a.allow_link and d.link<>'')
    or (d.link<>'' and d.link !~* '^https?://[^/?#[:space:]]+[^[:space:]]*$') then raise exception 'Enter accepted text or a valid HTTP(S) link.'; end if;
  insert into public.submission_versions(assignment_id,member_id,version,request_id,body,link,submitted_at,effective_due_at,late)
    values(p_id,auth.uid(),latest+1,p_request,d.body,d.link,submitted,due_time,submitted>due_time) returning * into receipt;
  delete from public.submission_drafts where assignment_id=p_id and member_id=auth.uid();
  update public.assignment_recipients set revision_for=null,revision_due_at=null where assignment_id=p_id and member_id=auth.uid();
  return receipt;
end $$;
create or replace function public.hw_save_draft(p_id uuid,p_base integer,p_revision integer,p_body text,p_link text)
returns integer language plpgsql security definer set search_path='' as $$
declare a public.assignments; r public.assignment_recipients; latest integer; updated integer; blocked text;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
  if not public.is_member() then raise exception 'Active membership required'; end if;
  select * into r from public.assignment_recipients where assignment_id=p_id and member_id=auth.uid() for update;
  if not found then raise exception 'Assignment unavailable'; end if;
  if r.detached then raise exception 'You have left this group.'; end if;
  select * into strict a from public.assignments where id=p_id for share;
  select coalesce(max(version),0) into latest from public.submission_versions where assignment_id=p_id and member_id=auth.uid();
  if latest is distinct from p_base then raise exception 'A submission already changed. Reload the receipt.'; end if;
  blocked := homework_private.submission_block(a.lifecycle,r.excused,latest,r.revision_for,r.revision_due_at,coalesce(r.extension_at,a.due_at),a.allow_late,clock_timestamp());
  if blocked is not null then raise exception '%',blocked; end if;
  if (not a.allow_text and p_body<>'') or (not a.allow_link and p_link<>'') then raise exception 'This content type is disabled.'; end if;
  if p_revision=0 then
    insert into public.submission_drafts values(p_id,auth.uid(),p_body,p_link,1,clock_timestamp())
      on conflict do nothing returning revision into updated;
  else
    update public.submission_drafts set body=p_body,link=p_link,revision=revision+1,updated_at=clock_timestamp()
      where assignment_id=p_id and member_id=auth.uid() and revision=p_revision returning revision into updated;
  end if;
  if updated is null then raise exception 'Draft conflict. Compare with the server draft.'; end if;
  return updated;
end $$;
create or replace function public.hw_review(p_version uuid,p_revision integer,p_action text,p_score numeric,p_feedback text,
  p_include_grade boolean,p_revision_due timestamptz,p_request uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v public.submission_versions; a public.assignments; current_revision integer; latest integer;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
  select * into strict v from public.submission_versions where id=p_version;
  if not public.hw_grade(v.assignment_id,v.member_id) then raise exception 'Administrator required'; end if;
  if p_action='revision' and exists(select from public.assignment_recipients where assignment_id=v.assignment_id and member_id=v.member_id and detached) then raise exception 'Student has left this group.'; end if;
  perform 1 from public.assignment_recipients where assignment_id=v.assignment_id and member_id=v.member_id for update;
  select * into strict a from public.assignments where id=v.assignment_id;
  select coalesce((select revision from public.assignment_reviews where version_id=p_version),0) into current_revision;
  if exists(select 1 from public.assignment_review_events where version_id=p_version and request_id=p_request) then return current_revision; end if;
  if p_revision is distinct from current_revision then raise exception 'Review conflict. Reload the grading draft.'; end if;
  select max(version) into latest from public.submission_versions where assignment_id=v.assignment_id and member_id=v.member_id;
  if p_action not in ('save','release','revision') or p_action is null then raise exception 'Invalid review action'; end if;
  if p_action<>'save' and latest<>v.version then raise exception 'A newer submission exists. Open its version before returning feedback.'; end if;
  if p_score is not null and (a.max_points is null or p_score<0 or p_score>a.max_points or p_score='NaN'::numeric) then raise exception 'Score is outside the assignment range.'; end if;
  if p_action='release' and p_include_grade is not true then raise exception 'Confirm grade release.'; end if;
  if p_action<>'save' and p_include_grade and a.max_points is not null and p_score is null then raise exception 'Enter a score before release.'; end if;
  if p_action='revision' and (p_feedback !~ '[^[:space:]]' or (p_revision_due is not null and (not isfinite(p_revision_due) or p_revision_due<=clock_timestamp()))) then raise exception 'Enter revision instructions and a future deadline.'; end if;
  insert into public.assignment_reviews values(p_version,p_score,p_feedback,current_revision+1,auth.uid())
    on conflict(version_id) do update set score=excluded.score,feedback=excluded.feedback,revision=excluded.revision,reviewer=excluded.reviewer;
  if p_action<>'save' then
    insert into public.assignment_review_events(version_id,request_id,reviewer,kind,includes_grade,score,feedback,revision_due_at)
      values(p_version,p_request,auth.uid(),p_action,p_include_grade,case when p_include_grade then p_score end,p_feedback,case when p_action='revision' then p_revision_due end);
    if p_action='revision' then
      update public.assignment_recipients set revision_for=v.version,revision_due_at=p_revision_due where assignment_id=v.assignment_id and member_id=v.member_id;
    end if;
    insert into public.assignment_audit_events(assignment_id,actor_id,action,details) values(v.assignment_id,auth.uid(),p_action,jsonb_build_object('version_id',p_version,'request',p_request));
  end if;
  return current_revision+1;
end $$;
create or replace view public.hw_recipient_status with (security_invoker=true) as
select r.assignment_id,r.member_id,r.member_name,r.student_id,r.excused,
  coalesce(r.revision_due_at,r.extension_at,a.due_at) as effective_due_at,
  r.revision_due_at,r.revision_for,v.id as version_id,coalesce(v.version,0) as latest,
  v.late, d.revision as draft_revision,
  case when r.excused then 'Excused' when v.id is not null then 'Submitted'
    when now()>coalesce(r.extension_at,a.due_at) then 'Missing' when d.revision is not null then 'Draft' else 'Not submitted' end as submission,
  case when v.id is null then null when exists(select 1 from public.assignment_review_events e where e.version_id=v.id and e.includes_grade) then 'Returned'
    when g.version_id is not null then 'Grading draft' else 'Awaiting review' end as grading,
  case when r.revision_for is not null then 'Revision requested' when v.version>1 then 'Resubmitted' else null end as modification,
  case when r.detached then 'You have left this group.' else homework_private.submission_block(a.lifecycle,r.excused,coalesce(v.version,0),r.revision_for,r.revision_due_at,coalesce(r.extension_at,a.due_at),a.allow_late,now()) end as blocked,r.detached,r.extension_at
from public.assignment_recipients r join public.assignments a on a.id=r.assignment_id
left join lateral (select s.id,s.version,s.late from public.submission_versions s where s.assignment_id=r.assignment_id and s.member_id=r.member_id order by s.version desc limit 1) v on true
left join public.submission_drafts d on d.assignment_id=r.assignment_id and d.member_id=r.member_id
left join public.assignment_reviews g on g.version_id=v.id;
create or replace function public.hw_detail(p_id uuid,p_member uuid default null)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('assignment',to_jsonb(a),
    'can_manage',public.hw_staff(p_id),'targets',(select coalesce(jsonb_agg(t.member_id),'[]') from public.assignment_targets t where assignment_id=p_id),
    'status',(select to_jsonb(s) from public.hw_recipient_status s where assignment_id=p_id and member_id=coalesce(p_member,auth.uid())),
    'draft',(select to_jsonb(d) from public.submission_drafts d where assignment_id=p_id and member_id=coalesce(p_member,auth.uid())),
    'versions',(select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('review',(
      select to_jsonb(g) from public.assignment_reviews g where g.version_id=v.id),
      'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]') from public.assignment_review_events e where e.version_id=v.id)) order by v.version desc),'[]')
      from public.submission_versions v where assignment_id=p_id and member_id=coalesce(p_member,auth.uid())),
    'counts',case when public.hw_staff(p_id) then (select jsonb_build_object('eligible',count(*) filter(where not excused),'late',count(*) filter(where late and not excused),'missing',count(*) filter(where submission='Missing'),'excused',count(*) filter(where excused),'returned',count(*) filter(where grading='Returned'),'assigned',count(*),'submitted',count(*) filter(where latest>0 and not excused),
      'pending',count(*) filter(where latest>0 and grading<>'Returned' and revision_for is null and not excused)) from public.hw_recipient_status where assignment_id=p_id) end)
  from public.assignments a where a.id=p_id;
$$;
create or replace function public.hw_roster(p_id uuid,p_filter text,p_search text,p_page integer,p_sort text)
returns setof public.hw_recipient_status language sql stable set search_path='' as $$
  select s.* from public.hw_recipient_status s
  left join public.submission_versions v on v.id=s.version_id
  where public.hw_staff(p_id) and s.assignment_id=p_id
    and (strpos(lower(s.member_name),lower(p_search))>0 or strpos(s.student_id,p_search)>0)
    and case p_filter when 'all' then true when 'late' then s.late
      when 'pending' then s.latest>0 and s.grading<>'Returned' and s.revision_for is null and not s.excused
      else p_filter in (s.submission,s.grading,s.modification) end
  order by case when p_sort='recent' then v.submitted_at end desc nulls last,
    case when p_sort='name' then lower(s.member_name) end,s.student_id,s.member_id
  limit 21 offset (20 * greatest(p_page,0)::bigint);
$$;
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
      when 'draft' then lifecycle='draft' when 'published' then lifecycle='published' when 'all' then true else false end
    order by (modification='Revision requested') desc nulls last,due_at,id
    limit 21 offset (20 * greatest(p_page,0)::bigint)
  ) select coalesce(jsonb_agg(to_jsonb(page)),'[]') from page;
$$;
create or replace function public.hw_summary()
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('todo',(select count(*) from public.hw_recipient_status s join public.assignments a on a.id=s.assignment_id
      where member_id=auth.uid() and not detached and not excused and a.lifecycle<>'archived' and (latest=0 or revision_for is not null)),
    'next',public.hw_list(false,'todo','',0)->0,
    'submitted',case when public.is_admin() or exists(select from public.hw_scopes()) then (select count(*) from public.hw_recipient_status where public.hw_staff(assignment_id) and latest>0 and not excused) end,
    'pending',case when public.is_admin() or exists(select from public.hw_scopes()) then (select count(*) from public.hw_recipient_status where public.hw_staff(assignment_id) and latest>0 and grading<>'Returned' and revision_for is null and not excused) end);
$$;
create or replace function public.hw_group_candidates(p_group uuid,p_search text,p_page integer)
returns table(id uuid,student_id text,display_name text) language sql stable security definer set search_path='' as $$
  select p.id,p.student_id,p.display_name from public.profiles p join public.memberships m on m.user_id=p.id
  where public.hw_scope_staff(p_group) and exists(select from public.group_students s where s.group_id=p_group and s.user_id=p.id) and m.status='active' and p.status='active'
  and (strpos(lower(p.display_name),lower(p_search))>0 or strpos(p.student_id,p_search)>0)
  order by p.student_id limit 21 offset (20 * greatest(p_page,0)::bigint);
$$;

do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in
 ('hw_scope_staff','hw_staff','hw_grade','hw_scopes','hw_save_scoped','hw_group_candidates') loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to authenticated',f);
 end loop;
end $$;

create function homework_private.label_homework_group() returns trigger language plpgsql set search_path='' as $$
begin
 select name into new.group_name from public.club_groups where id=new.group_id;
 return new;
end $$;
create trigger label_homework_group before insert on public.assignments for each row
execute function homework_private.label_homework_group();
