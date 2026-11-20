alter table public.assignments
 add column file_limit integer not null default 0 check(file_limit between 0 and 10),
 add column file_bytes integer not null default 5242880 check(file_bytes between 1 and 10485760),
 add column file_mode text not null default 'any' check(file_mode in ('any','photo','document'));
create table public.assignment_attachments(
 id uuid primary key, assignment_id uuid not null references public.assignments(id) on delete cascade,
 owner_id uuid not null references public.profiles(id), reference boolean not null,
 version_id uuid references public.submission_versions(id), filename text not null check(length(filename) between 1 and 160),
 mime text not null check(mime in ('image/png','image/jpeg','application/pdf','text/plain')),
 size_bytes integer not null check(size_bytes between 1 and 10485760), digest text not null check(digest ~ '^[a-f0-9]{64}$'),
 state text not null default 'pending' check(state in ('pending','ready','discarded')), created_at timestamptz not null default now()
);
create index attachment_binding on public.assignment_attachments(assignment_id,owner_id,version_id);
alter table public.assignment_attachments enable row level security;
revoke all on public.assignment_attachments from public,anon,authenticated;
grant select on public.assignment_attachments to authenticated;
create policy attachment_read on public.assignment_attachments for select to authenticated using (
 public.is_member() and state<>'discarded' and
 ((reference and exists(select from public.assignments a where a.id=assignment_id) and (state='ready' or public.hw_staff(assignment_id)))
 or (not reference and ((owner_id=auth.uid() and exists(select from public.assignment_recipients r where r.assignment_id=assignment_attachments.assignment_id and r.member_id=auth.uid() and (not r.detached or version_id is not null)))
 or (version_id is not null and public.hw_grade(assignment_id,owner_id))))));
-- The Edge function signs short-lived downloads only after selecting metadata under caller RLS.
create table homework_private.file_cleanup(id uuid primary key,digest text not null);
create function homework_private.queue_file() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into homework_private.file_cleanup values(old.id,old.digest) on conflict do nothing; return null; end $$;
create trigger queue_file_cleanup after delete on public.assignment_attachments for each row execute function homework_private.queue_file();

create function public.hw_file_settings(p_id uuid,p_revision integer,p_limit integer,p_bytes integer,p_mode text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.hw_staff(p_id) then raise exception 'Administrator required'; end if;
 update public.assignments set file_limit=p_limit,file_bytes=p_bytes,file_mode=p_mode,revision=revision+1
 where id=p_id and revision=p_revision and lifecycle='draft';
 if not found then raise exception 'Assignment changed. Preview again.'; end if;
end $$;
create function public.hw_file_reserve(p_id uuid,p_file uuid,p_reference boolean,p_name text,p_mime text,p_size integer,p_digest text,p_base integer)
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
 select count(*) into n from public.assignment_attachments where assignment_id=p_id and reference=p_reference and state<>'discarded' and version_id is null and (p_reference or owner_id=auth.uid());
 if n>=(case when p_reference then 10 else a.file_limit end) then raise exception 'Attachment limit reached'; end if;
 insert into public.assignment_attachments(id,assignment_id,owner_id,reference,filename,mime,size_bytes,digest)
 values(p_file,p_id,auth.uid(),p_reference,p_name,p_mime,p_size,p_digest);
 return 'pending';
end $$;
-- Only the trusted uploader may acknowledge inspected bytes in Storage.
create function public.hw_file_finish(p_file uuid,p_digest text) returns void language plpgsql security definer set search_path='' as $$
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
 if not f.reference then
 insert into public.submission_drafts(assignment_id,member_id,body,link,revision,updated_at)
 select f.assignment_id,f.owner_id,coalesce(v.body,''),coalesce(v.link,''),1,now() from (select 1) seed left join lateral
 (select body,link from public.submission_versions where assignment_id=f.assignment_id and member_id=f.owner_id order by version desc limit 1) v on true
 on conflict(assignment_id,member_id) do update set revision=public.submission_drafts.revision+1,updated_at=now();
 else update public.assignments set revision=revision+1 where id=f.assignment_id; end if;
end $$;
create function public.hw_file_remove(p_file uuid) returns void language plpgsql security definer set search_path='' as $$
declare f public.assignment_attachments;
begin
 select * into strict f from public.assignment_attachments where id=p_file;
 perform 1 from public.assignments where id=f.assignment_id for update;
 if not public.is_member() then raise exception 'Active membership required'; end if;
 if f.reference then
 if not public.hw_staff(f.assignment_id) or not exists(select from public.assignments where id=f.assignment_id and lifecycle='draft') then raise exception 'Draft management required'; end if;
 else
 if f.owner_id<>auth.uid() then raise exception 'Private attachment'; end if;
 perform 1 from public.assignment_recipients where assignment_id=f.assignment_id and member_id=auth.uid() and not detached for update;
 if not found then raise exception 'Assignment unavailable'; end if;
 end if;
 delete from public.assignment_attachments where id=p_file and version_id is null;
 if not found then raise exception 'Submitted versions are immutable'; end if;
 if f.reference then update public.assignments set revision=revision+1 where id=f.assignment_id;
 else update public.submission_drafts set revision=revision+1 where assignment_id=f.assignment_id and member_id=auth.uid(); end if;
end $$;
create function public.hw_cleanup_files(p_done uuid[] default '{}') returns table(file_id uuid,file_digest text) language plpgsql security definer set search_path='' as $$
begin
 delete from homework_private.file_cleanup where id=any(p_done);
 delete from public.assignment_attachments where state='pending' and created_at<now()-interval '1 day';
 return query select id,digest from homework_private.file_cleanup order by id limit 50;
end $$;
revoke all on function public.hw_file_settings(uuid,integer,integer,integer,text),public.hw_file_reserve(uuid,uuid,boolean,text,text,integer,text,integer), public.hw_file_remove(uuid),public.hw_file_finish(uuid,text),public.hw_cleanup_files(uuid[]) from public,anon,authenticated;
grant execute on function public.hw_file_settings(uuid,integer,integer,integer,text),public.hw_file_reserve(uuid,uuid,boolean,text,text,integer,text,integer),public.hw_file_remove(uuid) to authenticated;
grant execute on function public.hw_file_finish(uuid,text),public.hw_cleanup_files(uuid[]) to service_role;
create or replace function public.hw_submit(p_id uuid,p_base integer,p_revision integer,p_request uuid)
returns public.submission_versions language plpgsql security definer set search_path='' as $$
declare a public.assignments; r public.assignment_recipients; d public.submission_drafts;
  receipt public.submission_versions; latest integer; due_time timestamptz; submitted timestamptz; blocked text;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
  if not public.is_member() then raise exception 'Active membership required'; end if;
  perform 1 from public.assignments where id=p_id for share;
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
  if exists(select from public.assignment_attachments where assignment_id=p_id and owner_id=auth.uid() and not reference and version_id is null and state='pending') then raise exception 'Finish or remove pending uploads.'; end if;
  if (d.body !~ '[^[:space:]]' and d.link='' and not exists(select from public.assignment_attachments where assignment_id=p_id and owner_id=auth.uid() and not reference and version_id is null and state='ready')) or (not a.allow_text and d.body<>'') or (not a.allow_link and d.link<>'')
    or (d.link<>'' and d.link !~* '^https?://[^/?#[:space:]]+[^[:space:]]*$') then raise exception 'Enter accepted text or a valid HTTP(S) link.'; end if;
  insert into public.submission_versions(assignment_id,member_id,version,request_id,body,link,submitted_at,effective_due_at,late)
    values(p_id,auth.uid(),latest+1,p_request,d.body,d.link,submitted,due_time,submitted>due_time) returning * into receipt;
  update public.assignment_attachments set version_id=receipt.id where assignment_id=p_id and owner_id=auth.uid() and not reference and version_id is null and state='ready';
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
  perform 1 from public.assignments where id=p_id for share;
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
create or replace function public.hw_detail(p_id uuid,p_member uuid default null)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('assignment',to_jsonb(a),
    'files',(select coalesce(jsonb_agg(to_jsonb(f)-'digest' order by f.created_at),'[]') from public.assignment_attachments f where f.assignment_id=a.id and (f.reference or f.owner_id=coalesce(p_member,auth.uid()))),
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
