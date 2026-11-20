alter table public.assignment_recipients add column exception_revision integer not null default 0;
create function public.hw_maintain(p_id uuid,p_revision integer,p_action text,p_reason text,p_due timestamptz default null,
  p_instructions text default null,p_late boolean default null) returns void language plpgsql security definer set search_path='' as $$
declare a public.assignments; next_state text;
begin
 perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
 if not public.hw_staff(p_id) then raise exception 'Administrator required'; end if;
 select * into strict a from public.assignments where id=p_id for update;
 if a.revision is distinct from p_revision then raise exception 'Assignment changed. Refresh and try again.'; end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'Enter a reason for the change.'; end if;
 next_state:=case when p_action='close' and a.lifecycle='published' then 'closed'
 when p_action='reopen' and a.lifecycle='closed' then 'published'
 when p_action='archive' and a.lifecycle in ('published','closed') then 'archived'
 when p_action='edit' and a.lifecycle in ('published','closed') then a.lifecycle end;
 if next_state is null then raise exception 'Change unavailable in this state.'; end if;
 if p_action='edit' and (p_due is null or p_late is null or p_instructions is null) then raise exception 'Check the assignment settings.'; end if;
 update public.assignments set lifecycle=next_state,revision=revision+1,
 due_at=case when p_action='edit' then p_due else due_at end,
 instructions=case when p_action='edit' then p_instructions else instructions end,
 allow_late=case when p_action='edit' then p_late else allow_late end where id=p_id;
 insert into public.assignment_audit_events(assignment_id,actor_id,action,details)
 values(p_id,auth.uid(),p_action,jsonb_build_object('reason',trim(p_reason),'old_state',a.lifecycle,'new_state',next_state,
 'old_due',a.due_at,'new_due',coalesce(p_due,a.due_at),'old_late',a.allow_late,'new_late',coalesce(p_late,a.allow_late),
 'old_instructions',a.instructions,'new_instructions',coalesce(p_instructions,a.instructions)));
end $$;
create function public.hw_exception(p_id uuid,p_member uuid,p_revision integer,p_excused boolean,p_extension timestamptz,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.assignments; r public.assignment_recipients;
begin
 perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
 if not public.hw_grade(p_id,p_member) then raise exception 'Administrator required'; end if;
 select * into strict a from public.assignments where id=p_id for share;
 select * into strict r from public.assignment_recipients where assignment_id=p_id and member_id=p_member for update;
 if a.lifecycle not in ('published','closed') or r.detached or r.exception_revision is distinct from p_revision then raise exception 'Recipient changed. Refresh and try again.'; end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 1000 or p_excused is null then raise exception 'Enter a reason for the change.'; end if;
 if p_extension is not null and (not isfinite(p_extension) or p_extension<a.due_at) then raise exception 'An extension must reach the assignment deadline.'; end if;
 update public.assignment_recipients set extension_at=p_extension,excused=p_excused,exception_revision=exception_revision+1
 where assignment_id=p_id and member_id=p_member;
 insert into public.assignment_audit_events(assignment_id,actor_id,action,details)
 values(p_id,auth.uid(),'exception',jsonb_build_object('member',p_member,'reason',p_reason,'extension',p_extension,'previous_extension',r.extension_at,'excused',p_excused,'previous_excused',r.excused));
end $$;
revoke all on function public.hw_maintain(uuid,integer,text,text,timestamptz,text,boolean),public.hw_exception(uuid,uuid,integer,boolean,timestamptz,text) from public,anon,authenticated;
grant execute on function public.hw_maintain(uuid,integer,text,text,timestamptz,text,boolean),public.hw_exception(uuid,uuid,integer,boolean,timestamptz,text) to authenticated;
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
  case when r.detached then 'You have left this group.' else homework_private.submission_block(a.lifecycle,r.excused,coalesce(v.version,0),r.revision_for,r.revision_due_at,coalesce(r.extension_at,a.due_at),a.allow_late,now()) end as blocked,r.detached,r.extension_at,r.exception_revision
from public.assignment_recipients r join public.assignments a on a.id=r.assignment_id
left join lateral (select s.id,s.version,s.late from public.submission_versions s where s.assignment_id=r.assignment_id and s.member_id=r.member_id order by s.version desc limit 1) v on true
left join public.submission_drafts d on d.assignment_id=r.assignment_id and d.member_id=r.member_id
left join public.assignment_reviews g on g.version_id=v.id;
