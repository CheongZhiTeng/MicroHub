-- A teaching assignment or global super-admin role excludes homework receipt.
create function homework_private.homework_staff_member(person uuid) returns boolean
language sql stable set search_path='' as $$
 select exists(select from public.platform_roles where user_id=person and role='super_admin')
 or exists(select from public.club_groups where teacher_id=person and state<>'archived')
$$;

create function homework_private.students(scope_id uuid)
returns table(id uuid,display_name text,student_id text) language sql stable set search_path='' as $$
 select p.id,p.display_name,p.student_id from public.profiles p
 join public.memberships m on m.user_id=p.id join auth.users u on u.id=p.id
 where p.status='active' and m.status='active' and u.email_confirmed_at is not null
 and not homework_private.homework_staff_member(p.id)
 and (scope_id is null or exists(select from public.group_students s where s.group_id=scope_id and s.user_id=p.id))
$$;

create function homework_private.audience(a public.assignments)
returns table(id uuid,display_name text,student_id text) language sql stable set search_path='' as $$
 select s.* from homework_private.students(a.group_id) s where a.audience='all'
 or exists(select from public.assignment_targets t where t.assignment_id=a.id and t.member_id=s.id)
$$;

create function public.hw_preview_count(p_id uuid) returns integer language sql stable security definer set search_path='' as $$
 select (select count(*)::integer from homework_private.audience(a)) from public.assignments a
 where a.id=p_id and a.lifecycle='draft' and public.hw_staff(a.id)
$$;
revoke all on function public.hw_preview_count(uuid) from public,anon;
grant execute on function public.hw_preview_count(uuid) to authenticated;

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
  if exists(select from public.assignment_attachments where assignment_id=p_id and reference and state='pending') then raise exception 'Finish or remove pending uploads.'; end if;
  insert into public.assignment_recipients(assignment_id,member_id,member_name,student_id)
    select p_id,p.id,p.display_name,p.student_id from homework_private.audience(a) p;
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
    select p.id,p.display_name,p.student_id from homework_private.students(a.group_id) p where p.id=any(p_members)
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

create or replace function public.hw_group_candidates(p_group uuid,p_search text,p_page integer)
returns table(id uuid,student_id text,display_name text) language sql stable security definer set search_path='' as $$
 select s.id,s.student_id,s.display_name from homework_private.students(p_group) s
 where public.hw_scope_staff(p_group) and (strpos(lower(s.display_name),lower(p_search))>0 or strpos(s.student_id,p_search)>0)
 order by s.student_id limit 21 offset (20*greatest(p_page,0)::bigint)
$$;
create or replace function public.hw_candidates(p_search text,p_page integer)
returns table(id uuid,student_id text,display_name text) language sql stable set search_path='' as $$
 select * from public.hw_group_candidates(null,p_search,p_page)
$$;

-- Keep the actual receipt rows (and any private drafts, scores and files).
alter table public.assignment_recipients add column staff_excluded boolean not null default false,
 add check(not staff_excluded or excused);
update public.assignment_recipients set staff_excluded=true,excused=true,revision_for=null,revision_due_at=null
where homework_private.homework_staff_member(member_id);
delete from public.assignment_targets t using public.assignments a where t.assignment_id=a.id
 and a.lifecycle='draft' and homework_private.homework_staff_member(t.member_id);

create function homework_private.exclude_teacher(person uuid) returns void language sql set search_path='' as $$
 update public.assignment_recipients set staff_excluded=true,excused=true,revision_for=null,revision_due_at=null
 where member_id=person and not staff_excluded;
 delete from public.assignment_targets t using public.assignments a where t.assignment_id=a.id and a.lifecycle='draft' and t.member_id=person;
$$;
create function homework_private.on_teacher_appointment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='platform_roles' then perform homework_private.exclude_teacher(new.user_id);
 else perform homework_private.exclude_teacher(new.teacher_id); end if;
 return new;
end $$;
create trigger homework_super_admin after insert or update of role on public.platform_roles
for each row when(new.role='super_admin') execute function homework_private.on_teacher_appointment();
create trigger homework_teacher after insert or update of teacher_id,state on public.club_groups
for each row when(new.teacher_id is not null and new.state<>'archived') execute function homework_private.on_teacher_appointment();
revoke all on function homework_private.exclude_teacher(uuid),homework_private.on_teacher_appointment(),
 homework_private.students(uuid),homework_private.audience(public.assignments),homework_private.homework_staff_member(uuid)
 from public,anon,authenticated;
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
left join public.assignment_reviews g on g.version_id=v.id
where not r.staff_excluded or v.id is not null;
