-- Homework MVP A. All mutations pass through checked transactions; reads use RLS.
create table public.assignments (
  id uuid primary key,
  created_by uuid not null references public.profiles(id),
  title text not null check (length(trim(title)) between 1 and 160),
  instructions text not null check (length(instructions) <= 20000),
  due_at timestamptz not null check (isfinite(due_at)),
  max_points numeric check (max_points > 0 and max_points <= 100000),
  allow_text boolean not null, allow_link boolean not null, allow_late boolean not null,
  audience text not null check (audience in ('all','selected')),
  lifecycle text not null default 'draft' check (lifecycle in ('draft','published','closed','archived')),
  revision integer not null default 1, published_at timestamptz,
  check (allow_text or allow_link)
);
-- Draft audience is visible only to staff. Actual recipients are frozen on publication.
create table public.assignment_targets (
  assignment_id uuid references public.assignments(id) on delete cascade,
  member_id uuid references public.profiles(id), primary key (assignment_id, member_id)
);
create table public.assignment_recipients (
  assignment_id uuid references public.assignments(id),
  member_id uuid references public.profiles(id),
  student_id text not null, member_name text not null,
  extension_at timestamptz, excused boolean not null default false,
  revision_for integer, revision_due_at timestamptz,
  primary key (assignment_id, member_id)
);
create index recipients_by_member on public.assignment_recipients(member_id, assignment_id);
create table public.submission_drafts (
  assignment_id uuid, member_id uuid, primary key (assignment_id, member_id),
  foreign key (assignment_id,member_id) references public.assignment_recipients,
  body text not null check (length(body)<=20000), link text not null check (length(link)<=2048),
  revision integer not null, updated_at timestamptz not null default now()
);
create table public.submission_versions (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null, member_id uuid not null,
  foreign key (assignment_id,member_id) references public.assignment_recipients,
  version integer not null, request_id uuid not null, body text not null, link text not null,
  submitted_at timestamptz not null, effective_due_at timestamptz not null, late boolean not null,
  unique (assignment_id,member_id,version), unique (assignment_id,member_id,request_id)
);
-- The student's read policy never touches working grade values.
create table public.assignment_reviews (
  version_id uuid primary key references public.submission_versions(id),
  score numeric, feedback text not null check (length(feedback)<=12000),
  revision integer not null, reviewer uuid not null references public.profiles(id)
);
create table public.assignment_review_events (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.submission_versions(id),
  request_id uuid not null, reviewer uuid not null references public.profiles(id),
  kind text not null check (kind in ('release','revision')),
  includes_grade boolean not null, score numeric, feedback text not null,
  revision_due_at timestamptz, created_at timestamptz not null default clock_timestamp(),
  unique (version_id,request_id)
);
create index review_events_by_version on public.assignment_review_events(version_id,created_at desc);
create table public.assignment_audit_events (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.assignments(id),
  actor_id uuid not null references public.profiles(id), action text not null, details jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);

do $$
declare t text;
begin
  foreach t in array array['assignments','assignment_targets','assignment_recipients','submission_drafts',
    'submission_versions','assignment_reviews','assignment_review_events','assignment_audit_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
create policy read_recipients on public.assignment_recipients for select to authenticated using
  ((select public.is_admin()) or ((select public.is_member()) and member_id=(select auth.uid())));
create policy read_assignments on public.assignments for select to authenticated using
  ((select public.is_admin()) or (lifecycle <> 'draft' and exists
    (select 1 from public.assignment_recipients r where r.assignment_id=id and r.member_id=(select auth.uid()))));
create policy staff_targets on public.assignment_targets for select to authenticated using ((select public.is_admin()));
create policy own_drafts on public.submission_drafts for select to authenticated using
  ((select public.is_member()) and member_id=(select auth.uid()));
create policy read_versions on public.submission_versions for select to authenticated using
  ((select public.is_admin()) or ((select public.is_member()) and member_id=(select auth.uid())));
create policy staff_reviews on public.assignment_reviews for select to authenticated using ((select public.is_admin()));
create policy returned_feedback on public.assignment_review_events for select to authenticated using
  (exists(select 1 from public.submission_versions v where v.id=version_id));
create policy staff_audit on public.assignment_audit_events for select to authenticated using ((select public.is_admin()));

create function public.hw_save_assignment(p_id uuid,p_revision integer,p_title text,p_instructions text,
  p_due timestamptz,p_points numeric,p_text boolean,p_link boolean,p_late boolean,p_audience text,p_targets uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare updated integer;
begin
  if not public.is_admin() then raise exception 'Administrator required'; end if;
  if p_revision=0 then
    insert into public.assignments(id,created_by,title,instructions,due_at,max_points,allow_text,allow_link,allow_late,audience)
    values(p_id,auth.uid(),trim(p_title),p_instructions,p_due,p_points,p_text,p_link,p_late,p_audience)
    on conflict(id) do nothing returning revision into updated;
  else
    update public.assignments set title=trim(p_title),instructions=p_instructions,due_at=p_due,max_points=p_points,
      allow_text=p_text,allow_link=p_link,allow_late=p_late,audience=p_audience,revision=revision+1
      where id=p_id and lifecycle='draft' and revision=p_revision returning revision into updated;
  end if;
  if updated is null then raise exception 'Assignment changed. Reload the saved draft.'; end if;
  delete from public.assignment_targets where assignment_id=p_id;
  if p_audience='selected' then
    insert into public.assignment_targets select distinct p_id,member from unnest(p_targets) member;
  end if;
  return updated;
end $$;

create function public.hw_publish(p_id uuid,p_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare a public.assignments; n integer;
begin
  if not public.is_admin() then raise exception 'Administrator required'; end if;
  select * into a from public.assignments where id=p_id for update;
  if a.lifecycle='published' and a.revision=p_revision+1 then
    return (select count(*) from public.assignment_recipients where assignment_id=p_id);
  end if;
  if a.lifecycle is distinct from 'draft' or a.revision is distinct from p_revision then raise exception 'Assignment changed. Preview again.'; end if;
  insert into public.assignment_recipients(assignment_id,member_id,member_name,student_id)
    select p_id,p.id,p.display_name,p.student_id from public.profiles p join public.memberships m on m.user_id=p.id
    join auth.users u on u.id=p.id where p.status='active' and m.status='active' and u.email_confirmed_at is not null
    and (a.audience='all' or exists(select 1 from public.assignment_targets t where t.assignment_id=p_id and t.member_id=p.id));
  get diagnostics n = row_count;
  if n=0 or (a.audience='selected' and n<>(select count(*) from public.assignment_targets where assignment_id=p_id)) then
    raise exception 'Choose active members before publishing.'; end if;
  update public.assignments set lifecycle='published',published_at=clock_timestamp(),revision=revision+1 where id=p_id;
  insert into public.assignment_audit_events(assignment_id,actor_id,action,details)
    values(p_id,auth.uid(),'publish',jsonb_build_object('recipients',n,'audience',a.audience));
  return n;
end $$;

-- One lock per recipient serializes devices, graders, and future individual exceptions.
-- Evaluate the clock after acquiring the lock, including on retries.
create schema homework_private;
revoke all on schema homework_private from public, anon, authenticated;
create function homework_private.submission_block(lifecycle text,excused boolean,latest integer,
  revision_for integer,revision_due timestamptz,due_at timestamptz,allow_late boolean,at_time timestamptz)
returns text language sql immutable set search_path='' as $$
 select case when excused then 'You are excused from this assignment.'
   when lifecycle in ('draft','archived') then 'This assignment is unavailable for submission.'
   when latest>0 and revision_for is distinct from latest then 'A new version requires a revision request.'
   when latest>0 and revision_due is not null and at_time>revision_due then 'Your revision window has ended.'
   when lifecycle='closed' and not (latest>0 and revision_for is not distinct from latest and revision_due is not null and at_time<=revision_due)
     then 'This assignment is closed.'
   when not allow_late and at_time>coalesce(revision_due,due_at) then 'The deadline has passed and late submissions are closed.'
   else null end;
$$;

create function public.hw_save_draft(p_id uuid,p_base integer,p_revision integer,p_body text,p_link text)
returns integer language plpgsql security definer set search_path='' as $$
declare a public.assignments; r public.assignment_recipients; latest integer; updated integer; blocked text;
begin
  if not public.is_member() then raise exception 'Active membership required'; end if;
  select * into r from public.assignment_recipients where assignment_id=p_id and member_id=auth.uid() for update;
  if not found then raise exception 'Assignment unavailable'; end if;
  select * into strict a from public.assignments where id=p_id;
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

create function public.hw_submit(p_id uuid,p_base integer,p_revision integer,p_request uuid)
returns public.submission_versions language plpgsql security definer set search_path='' as $$
declare a public.assignments; r public.assignment_recipients; d public.submission_drafts;
  receipt public.submission_versions; latest integer; due_time timestamptz; submitted timestamptz; blocked text;
begin
  if not public.is_member() then raise exception 'Active membership required'; end if;
  select * into r from public.assignment_recipients where assignment_id=p_id and member_id=auth.uid() for update;
  if not found then raise exception 'Assignment unavailable'; end if;
  select * into receipt from public.submission_versions where assignment_id=p_id and member_id=auth.uid() and request_id=p_request;
  if found then return receipt; end if;
  select * into strict a from public.assignments where id=p_id;
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

create function public.hw_review(p_version uuid,p_revision integer,p_action text,p_score numeric,p_feedback text,
  p_include_grade boolean,p_revision_due timestamptz,p_request uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v public.submission_versions; a public.assignments; current_revision integer; latest integer;
begin
  if not public.is_admin() then raise exception 'Administrator required'; end if;
  select * into strict v from public.submission_versions where id=p_version;
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


-- Invoker views and RPCs preserve the caller's row policies for search, counts and direct links.
create view public.hw_recipient_status with (security_invoker=true) as
select r.assignment_id,r.member_id,r.member_name,r.student_id,r.excused,
  coalesce(r.revision_due_at,r.extension_at,a.due_at) as effective_due_at,
  r.revision_due_at,r.revision_for,v.id as version_id,coalesce(v.version,0) as latest,
  v.late, d.revision as draft_revision,
  case when r.excused then 'Excused' when v.id is not null then 'Submitted'
    when now()>coalesce(r.extension_at,a.due_at) then 'Missing' when d.revision is not null then 'Draft' else 'Not submitted' end as submission,
  case when v.id is null then null when exists(select 1 from public.assignment_review_events e where e.version_id=v.id and e.includes_grade) then 'Returned'
    when g.version_id is not null then 'Grading draft' else 'Awaiting review' end as grading,
  case when r.revision_for is not null then 'Revision requested' when v.version>1 then 'Resubmitted' else null end as modification,
  homework_private.submission_block(a.lifecycle,r.excused,coalesce(v.version,0),r.revision_for,r.revision_due_at,coalesce(r.extension_at,a.due_at),a.allow_late,now()) as blocked
from public.assignment_recipients r join public.assignments a on a.id=r.assignment_id
left join lateral (select s.id,s.version,s.late from public.submission_versions s where s.assignment_id=r.assignment_id and s.member_id=r.member_id order by s.version desc limit 1) v on true
left join public.submission_drafts d on d.assignment_id=r.assignment_id and d.member_id=r.member_id
left join public.assignment_reviews g on g.version_id=v.id;
revoke all on public.hw_recipient_status from public,anon,authenticated;
grant select on public.hw_recipient_status to authenticated;

create function public.hw_list(p_staff boolean,p_filter text,p_search text,p_page integer)
returns jsonb language sql stable set search_path='' as $$
  with visible as (
    select a.id,a.title,a.lifecycle,coalesce(s.effective_due_at,a.due_at) as due_at,
      s.submission,s.grading,s.modification,s.late,s.draft_revision,s.latest,s.excused
    from public.assignments a left join public.hw_recipient_status s on s.assignment_id=a.id and s.member_id=auth.uid()
    where ((p_staff and public.is_admin()) or (not p_staff and s.member_id=auth.uid()))
      and strpos(lower(a.title),lower(p_search))>0
  ), page as (
    select * from visible where case p_filter
      when 'todo' then not excused and (latest=0 or modification='Revision requested') and lifecycle<>'archived'
      when 'submitted' then latest>0 when 'returned' then grading='Returned'
      when 'draft' then lifecycle='draft' when 'published' then lifecycle='published' when 'all' then true else false end
    order by (modification='Revision requested') desc nulls last,due_at,id
    limit 21 offset (20 * greatest(p_page,0)::bigint)
  ) select coalesce(jsonb_agg(to_jsonb(page)),'[]') from page;
$$;
create function public.hw_summary()
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('todo',(select count(*) from public.hw_recipient_status s join public.assignments a on a.id=s.assignment_id
      where member_id=auth.uid() and not excused and a.lifecycle<>'archived' and (latest=0 or revision_for is not null)),
    'next',public.hw_list(false,'todo','',0)->0,
    'submitted',case when public.is_admin() then (select count(*) from public.hw_recipient_status where latest>0 and not excused) end,
    'pending',case when public.is_admin() then (select count(*) from public.hw_recipient_status where latest>0 and grading<>'Returned' and revision_for is null and not excused) end);
$$;
create function public.hw_detail(p_id uuid,p_member uuid default null)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('assignment',to_jsonb(a),
    'targets',(select coalesce(jsonb_agg(t.member_id),'[]') from public.assignment_targets t where assignment_id=p_id),
    'status',(select to_jsonb(s) from public.hw_recipient_status s where assignment_id=p_id and member_id=coalesce(p_member,auth.uid())),
    'draft',(select to_jsonb(d) from public.submission_drafts d where assignment_id=p_id and member_id=coalesce(p_member,auth.uid())),
    'versions',(select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('review',(
      select to_jsonb(g) from public.assignment_reviews g where g.version_id=v.id),
      'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]') from public.assignment_review_events e where e.version_id=v.id)) order by v.version desc),'[]')
      from public.submission_versions v where assignment_id=p_id and member_id=coalesce(p_member,auth.uid())),
    'counts',case when public.is_admin() then (select jsonb_build_object('assigned',count(*),'submitted',count(*) filter(where latest>0 and not excused),
      'pending',count(*) filter(where latest>0 and grading<>'Returned' and revision_for is null and not excused)) from public.hw_recipient_status where assignment_id=p_id) end)
  from public.assignments a where a.id=p_id;
$$;
create function public.hw_roster(p_id uuid,p_filter text,p_search text,p_page integer)
returns setof public.hw_recipient_status language sql stable set search_path='' as $$
  select s.* from public.hw_recipient_status s where public.is_admin() and assignment_id=p_id
    and (strpos(lower(member_name),lower(p_search))>0 or strpos(student_id,p_search)>0)
    and case p_filter when 'all' then true when 'late' then late when 'pending' then latest>0 and grading<>'Returned' and revision_for is null and not excused
    else p_filter in (submission,grading,modification) end
    order by student_id,member_id limit 21 offset (20 * greatest(p_page,0)::bigint);
$$;
create function public.hw_candidates(p_search text,p_page integer)
returns table(id uuid,student_id text,display_name text) language sql stable set search_path='' as $$
  select p.id,p.student_id,p.display_name from public.profiles p join public.memberships m on m.user_id=p.id
  where public.is_admin() and m.status='active' and p.status='active'
  and (strpos(lower(p.display_name),lower(p_search))>0 or strpos(p.student_id,p_search)>0)
  order by p.student_id limit 21 offset (20 * greatest(p_page,0)::bigint);
$$;

do $$
declare f regprocedure;
begin
  for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in
    ('hw_save_assignment','hw_publish','hw_save_draft','hw_submit','hw_review','hw_list','hw_summary','hw_detail','hw_roster','hw_candidates')
  loop
    execute format('revoke all on function %s from public,anon,authenticated',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end $$;

