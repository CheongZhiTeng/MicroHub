-- A shared initial hand-in belongs to the published group recipient snapshot.
-- Each member receives an immutable receipt, private feedback and personal revision windows.
alter table public.assignments add column joint boolean not null default false,add check (not joint or group_id is not null);
alter table public.submission_versions add column team_batch uuid, add column submitted_by uuid references public.profiles(id);
alter table public.assignment_attachments add column joint boolean not null default false;
create table homework_private.team_drafts(
 assignment_id uuid primary key references public.assignments on delete cascade,body text not null default '' check(length(body)<=20000),
 link text not null default '' check(length(link)<=2048),revision integer not null,updated_at timestamptz not null default now(),
 batch uuid, submitted_revision integer
);
create function public.hw_work_mode(p_id uuid,p_revision integer,p_joint boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.hw_staff(p_id) then raise exception 'Administrator required'; end if;
 update public.assignments set joint=p_joint,revision=revision+1 where id=p_id and lifecycle='draft' and revision=p_revision and (not p_joint or group_id is not null);
 if not found then raise exception 'Choose a current group draft.'; end if;
end $$;
create function public.hw_joint_member(task uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_member() and exists(select from public.assignment_recipients r join public.assignments a on a.id=r.assignment_id
 where r.member_id=auth.uid() and a.id=task and a.joint and not r.detached and not r.excused)
$$;
create function public.hw_joint_draft(task uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(d)-'batch'-'submitted_revision' from homework_private.team_drafts d
 where d.assignment_id=task and d.batch is null and public.hw_joint_member(task)
$$;
create function public.hw_grade_version(ver uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.submission_versions v where v.id=ver and public.hw_grade(v.assignment_id,v.member_id)
 and (v.team_batch is null or not exists(select from public.submission_versions own where own.team_batch=v.team_batch and own.member_id=auth.uid())))
$$;
alter policy staff_reviews on public.assignment_reviews using(public.hw_grade_version(version_id));

alter function public.hw_save_draft(uuid,integer,integer,text,text) set schema homework_private;
alter function public.hw_submit(uuid,integer,integer,uuid) set schema homework_private;
revoke all on function homework_private.hw_save_draft(uuid,integer,integer,text,text),homework_private.hw_submit(uuid,integer,integer,uuid) from public,anon,authenticated;
create function public.hw_save_draft(p_id uuid,p_base integer,p_revision integer,p_body text,p_link text) returns integer
language plpgsql security definer set search_path='' as $$
declare a public.assignments;r public.assignment_recipients; rev integer;
begin
 perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
 if not public.is_member() then raise exception 'Active membership required'; end if;
 if p_base<>0 or not exists(select from public.assignments where id=p_id and joint)
 or (exists(select from homework_private.team_drafts where assignment_id=p_id and batch is not null) and not exists(select from public.submission_versions where assignment_id=p_id and member_id=auth.uid())) then
 return homework_private.hw_save_draft(p_id,p_base,p_revision,p_body,p_link); end if;
 select * into strict a from public.assignments where id=p_id for update;
 if not public.hw_joint_member(p_id) then raise exception 'Assignment unavailable'; end if;
 select * into strict r from public.assignment_recipients where assignment_id=p_id and member_id=auth.uid();
 if homework_private.submission_block(a.lifecycle,r.excused,0,null,null,coalesce(r.extension_at,a.due_at),a.allow_late,clock_timestamp()) is not null then raise exception 'Submission window changed'; end if;
 if (not a.allow_text and p_body<>'') or (not a.allow_link and p_link<>'') then raise exception 'This content type is disabled.'; end if;
 if p_revision=0 then insert into homework_private.team_drafts(assignment_id,body,link,revision) values(p_id,p_body,p_link,1) on conflict do nothing returning revision into rev;
 else update homework_private.team_drafts set body=p_body,link=p_link,revision=revision+1,updated_at=clock_timestamp() where assignment_id=p_id and revision=p_revision and batch is null returning revision into rev; end if;
 if rev is null then raise exception 'Draft conflict. Compare with the server draft.'; end if;
 return rev;
end $$;
create function public.hw_submit(p_id uuid,p_base integer,p_revision integer,p_request uuid) returns public.submission_versions
language plpgsql security definer set search_path='' as $$
declare a public.assignments; r public.assignment_recipients; d homework_private.team_drafts; receipt public.submission_versions;
 batch_id uuid:=gen_random_uuid(); at_time timestamptz; deadline timestamptz; blocked text;
begin
 perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
 if not public.is_member() then raise exception 'Active membership required'; end if;
 if p_base<>0 or not exists(select from public.assignments where id=p_id and joint)
 or (exists(select from homework_private.team_drafts where assignment_id=p_id and batch is not null) and not exists(select from public.submission_versions where assignment_id=p_id and member_id=auth.uid())) then return homework_private.hw_submit(p_id,p_base,p_revision,p_request); end if;
 select * into strict a from public.assignments where id=p_id for update;
 if not public.hw_joint_member(p_id) then raise exception 'Assignment unavailable'; end if;
 select * into d from homework_private.team_drafts where assignment_id=p_id;
 if d.batch is not null then
 select * into receipt from public.submission_versions where assignment_id=p_id and member_id=auth.uid() and team_batch=d.batch;
 if found and (receipt.request_id=p_request or d.submitted_revision=p_revision) then return receipt; end if;
 raise exception 'A submission already changed. Reload the receipt.'; end if;
 if d.revision is null or d.revision is distinct from p_revision then raise exception 'Draft conflict. Compare with the server draft.'; end if;
 if exists(select from public.assignment_attachments where assignment_id=p_id and joint and version_id is null and state='pending') then raise exception 'Finish or remove pending uploads.'; end if;
 if (d.body !~ '[^[:space:]]' and d.link='' and not exists(select from public.assignment_attachments where assignment_id=p_id and joint and version_id is null and state='ready'))
 or (d.link<>'' and d.link !~* '^https?://[^/?#[:space:]]+[^[:space:]]*$') then raise exception 'Enter accepted text or a valid HTTP(S) link.'; end if;
 at_time:=clock_timestamp();
 for r in select * from public.assignment_recipients where assignment_id=p_id and not detached and not excused and public.group_eligible(member_id) order by member_id for update loop
 deadline:=coalesce(r.extension_at,a.due_at);
 blocked:=homework_private.submission_block(a.lifecycle,false,0,null,null,deadline,a.allow_late,at_time);
 if blocked is not null then raise exception '%',blocked; end if;
 insert into public.submission_versions(assignment_id,member_id,version,request_id,body,link,submitted_at,effective_due_at,late,team_batch,submitted_by)
 values(p_id,r.member_id,1,p_request,d.body,d.link,at_time,deadline,at_time>deadline,batch_id,auth.uid());
 end loop;
 select * into strict receipt from public.submission_versions where assignment_id=p_id and member_id=auth.uid() and team_batch=batch_id;
 update public.assignment_attachments set version_id=receipt.id where assignment_id=p_id and joint and version_id is null and state='ready';
 update homework_private.team_drafts set batch=batch_id,submitted_revision=revision where assignment_id=p_id;
 return receipt;
end $$;
create function public.hw_joint_file(task uuid,ver uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when ver is null then public.hw_joint_member(task) else public.is_member() and exists(
 select from public.submission_versions v join public.submission_versions own on own.team_batch=v.team_batch where v.id=ver and v.assignment_id=task and own.member_id=auth.uid()) end
$$;
create policy joint_files on public.assignment_attachments for select to authenticated using (joint and state<>'discarded' and public.hw_joint_file(assignment_id,version_id));
create index team_receipts on public.submission_versions(team_batch,member_id) where team_batch is not null;
create function homework_private.mark_joint_file() returns trigger language plpgsql set search_path='' as $$
begin
 new.joint:=not exists(select from homework_private.team_drafts where assignment_id=new.assignment_id and batch is not null) and not new.reference and exists(select from public.assignments where id=new.assignment_id and joint) and not exists(select from public.submission_versions where assignment_id=new.assignment_id and member_id=new.owner_id);
 return new;
end $$;
create trigger joint_file_kind before insert on public.assignment_attachments for each row execute function homework_private.mark_joint_file();
create or replace function public.hw_file_reserve(p_id uuid,p_file uuid,p_reference boolean,p_name text,p_mime text,p_size integer,p_digest text,p_base integer)
returns text language plpgsql security definer set search_path='' as $$
declare a public.assignments; r public.assignment_recipients; latest integer; f public.assignment_attachments; n integer;
begin
 perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
 if not public.is_member() then raise exception 'Active membership required'; end if;
 select * into strict a from public.assignments where id=p_id for update;
 if p_reference then
   if not public.hw_staff(p_id) or a.lifecycle<>'draft' then raise exception 'Draft management required'; end if;
 else
   select * into r from public.assignment_recipients where assignment_id=p_id and member_id=auth.uid() for update;
   if not found or r.detached then raise exception 'Assignment unavailable'; end if;
   select coalesce(max(version),0) into latest from public.submission_versions where assignment_id=p_id and member_id=auth.uid();
   if latest is distinct from p_base or homework_private.submission_block(a.lifecycle,r.excused,latest,r.revision_for,r.revision_due_at,coalesce(r.extension_at,a.due_at),a.allow_late,clock_timestamp()) is not null then raise exception 'Submission window changed'; end if;
   if p_size>a.file_bytes or (a.file_mode='photo' and p_mime not like 'image/%') or (a.file_mode='document' and p_mime like 'image/%') then raise exception 'File exceeds assignment limits'; end if;
 end if;
 select * into f from public.assignment_attachments where id=p_file;
 if exists(select from homework_private.file_cleanup where id=p_file) then raise exception 'Upload expired'; end if;
 if f.id is not null then
   if f.assignment_id=p_id and f.owner_id=auth.uid() and f.reference=p_reference and f.digest=p_digest and f.state<>'discarded' and f.version_id is null then return f.state; end if;
   raise exception 'File changed. Select it again.';
 end if;
 select count(*) into n from public.assignment_attachments where assignment_id=p_id and reference=p_reference and state<>'discarded' and version_id is null and (p_reference or owner_id=auth.uid() or (a.joint and p_base=0 and joint));
 if n>=(case when p_reference then 10 else a.file_limit end) then raise exception 'Attachment limit reached'; end if;
 insert into public.assignment_attachments(id,assignment_id,owner_id,reference,filename,mime,size_bytes,digest)
 values(p_file,p_id,auth.uid(),p_reference,p_name,p_mime,p_size,p_digest);
 return 'pending';
end $$;
create or replace function public.hw_file_finish(p_file uuid,p_digest text) returns void language plpgsql security definer set search_path='' as $$
declare f public.assignment_attachments; a public.assignments;
begin
 select * into strict f from public.assignment_attachments where id=p_file;
 select * into strict a from public.assignments where id=f.assignment_id for update;
 if not f.reference then
 perform 1 from public.assignment_recipients where assignment_id=f.assignment_id and member_id=f.owner_id and not detached for update;
 if not found then raise exception 'Student has left this group.'; end if;
 end if;
 update public.assignment_attachments set state='ready' where id=p_file and digest=p_digest and state='pending';
 if not found then
 if exists(select from public.assignment_attachments where id=p_file and state='ready' and digest=p_digest) then return; end if;
 raise exception 'Upload expired';
 end if;
 if f.joint then
 insert into homework_private.team_drafts(assignment_id,revision) values(f.assignment_id,1) on conflict(assignment_id)
 do update set revision=homework_private.team_drafts.revision+1,updated_at=now() where homework_private.team_drafts.batch is null;
 elsif not f.reference then
 insert into public.submission_drafts(assignment_id,member_id,body,link,revision,updated_at)
 select f.assignment_id,f.owner_id,coalesce(v.body,''),coalesce(v.link,''),1,now() from (select 1) seed left join lateral
 (select body,link from public.submission_versions where assignment_id=f.assignment_id and member_id=f.owner_id order by version desc limit 1) v on true
 on conflict(assignment_id,member_id) do update set revision=public.submission_drafts.revision+1,updated_at=now();
 else update public.assignments set revision=revision+1 where id=f.assignment_id; end if;
end $$;
create or replace function public.hw_file_remove(p_file uuid) returns void language plpgsql security definer set search_path='' as $$
declare f public.assignment_attachments;
begin
 select * into strict f from public.assignment_attachments where id=p_file;
 perform 1 from public.assignments where id=f.assignment_id for update;
 if not public.is_member() then raise exception 'Active membership required'; end if;
 if f.reference then
 if not public.hw_staff(f.assignment_id) or not exists(select from public.assignments where id=f.assignment_id and lifecycle='draft') then raise exception 'Draft management required'; end if;
 else
 if f.owner_id<>auth.uid() and not(f.joint and public.hw_joint_member(f.assignment_id)) then raise exception 'Private attachment'; end if;
 perform 1 from public.assignment_recipients where assignment_id=f.assignment_id and member_id=auth.uid() and not detached for update;
 if not found then raise exception 'Assignment unavailable'; end if;
 end if;
 delete from public.assignment_attachments where id=p_file and version_id is null;
 if not found then raise exception 'Submitted versions are immutable'; end if;
 if f.reference then update public.assignments set revision=revision+1 where id=f.assignment_id;
 elsif f.joint then update homework_private.team_drafts set revision=revision+1,updated_at=now() where assignment_id=f.assignment_id and batch is null;
 else update public.submission_drafts set revision=revision+1 where assignment_id=f.assignment_id and member_id=auth.uid(); end if;
end $$;
create or replace function public.hw_review(p_version uuid,p_revision integer,p_action text,p_score numeric,p_feedback text,
  p_include_grade boolean,p_revision_due timestamptz,p_request uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v public.submission_versions; a public.assignments; current_revision integer; latest integer;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
  select * into strict v from public.submission_versions where id=p_version;
  if not public.hw_grade_version(v.id) then raise exception 'Administrator required'; end if;
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
-- RLS prevents a teammate from reading the anchor owner's private receipt.
-- Map the file to the requested member's own version without exposing that receipt.
create function public.hw_joint_receipt(anchor uuid,who uuid) returns uuid language sql stable security definer set search_path='' as $$
 select v.id from public.submission_versions src join public.submission_versions v on v.team_batch=src.team_batch and v.member_id=who
 where src.id=anchor and (public.hw_staff(v.assignment_id) or (who=auth.uid() and public.is_member()))
$$;
create function public.hw_joint_open(task uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.hw_joint_member(task) and not exists(select from homework_private.team_drafts where assignment_id=task and batch is not null)
$$;
revoke all on function public.hw_joint_open(uuid) from public,anon,authenticated;
grant execute on function public.hw_joint_open(uuid) to authenticated;

create or replace function public.hw_detail(p_id uuid,p_member uuid default null)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('assignment',to_jsonb(a),
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
  from public.assignments a where a.id=p_id;
$$;
create function homework_private.no_new_team_after_submission() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select from homework_private.team_drafts where assignment_id=new.assignment_id and batch is not null)
 and not exists(select from public.assignment_recipients where assignment_id=new.assignment_id and member_id=new.member_id)
 then raise exception 'The group has already submitted.'; end if;return new;
end $$;
create trigger freeze_submitted_team before insert on public.assignment_recipients for each row execute function homework_private.no_new_team_after_submission();
do $$ declare f regprocedure;begin for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in
 ('hw_work_mode','hw_joint_member','hw_joint_draft','hw_grade_version','hw_save_draft','hw_submit','hw_joint_file','hw_joint_receipt') loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to authenticated',f);
end loop;end $$;
