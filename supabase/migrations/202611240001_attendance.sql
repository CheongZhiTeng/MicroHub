-- All times and roster decisions are made on the server. A frozen row with no
-- mark becomes absent at the cutoff, even if no client or scheduler is online.
create schema attendance_private;
revoke all on schema attendance_private from public,anon,authenticated;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table attendance_private.sessions(
  id uuid primary key, title text not null check(length(title) between 1 and 120),
  group_id uuid references public.club_groups, group_name text,
  creator uuid not null references public.profiles, opened timestamptz not null,
  expires timestamptz not null, closed timestamptz,
  secret bytea not null, digest bytea not null
);
create index attendance_session_time on attendance_private.sessions(opened desc,id);
create table attendance_private.records(
  session_id uuid references attendance_private.sessions, student uuid references public.profiles,
  name_en text not null, name_zh text not null, status text check(status in ('Present','Absent','Late')),
  checked_at timestamptz, revision integer not null default 0, primary key(session_id,student)
);
create index attendance_personal_history on attendance_private.records(student,session_id);
create table attendance_private.audit(
  id bigint generated always as identity primary key, session_id uuid references attendance_private.sessions,
  actor uuid not null, student uuid, action text not null, previous text, replacement text,
  reason text, at_time timestamptz not null default clock_timestamp()
);
create table attendance_private.throttle(
  kind text not null, bucket uuid not null, start_at timestamptz not null, failures integer not null, primary key(kind,bucket)
);
-- Only a revision signal may be streamed. Fetch names/status separately after a fresh scope check.
create table public.attendance_signals(
  session_id uuid primary key references attendance_private.sessions, revision integer not null default 0
);
alter table public.attendance_signals enable row level security;
revoke all on public.attendance_signals from public,anon,authenticated;
grant select on public.attendance_signals to authenticated;

create function attendance_private.manages(g uuid) returns boolean
language sql stable set search_path='' as $$
 select public.is_super_admin() and (g is null or exists(
   select from public.club_groups where id=g and teacher_id=auth.uid()))
$$;
create function attendance_private.in_scope(g uuid) returns boolean
language sql stable set search_path='' as $$
 select public.is_member() and (g is null or exists(
   select from public.club_groups c where c.id=g and c.state='active' and
   (attendance_private.manages(g) or exists(select from public.group_students s
    where s.group_id=g and s.user_id=auth.uid() and not public.is_super_admin()))))
$$;
create function public.attendance_live_access(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select from attendance_private.sessions s where id=p_id and
  least(expires,closed)>statement_timestamp() and attendance_private.in_scope(group_id))
$$;
create policy attendance_revision_read on public.attendance_signals for select to authenticated
 using(public.attendance_live_access(session_id));
do $$begin
 if exists(select from pg_publication where pubname='supabase_realtime' and not puballtables) then
  alter publication supabase_realtime add table public.attendance_signals;
 end if;
end$$;

create function public.attendance_scopes() returns table(id uuid,name text,students bigint)
language sql stable security definer set search_path='' as $$
 select g.id,g.name,(select count(*) from homework_private.students(g.id))
 from (select null::uuid id,'Big class'::text name union all
  select c.id,c.name from public.club_groups c where c.state='active') g
 where attendance_private.manages(g.id) order by g.id nulls first
$$;
create function attendance_private.code() returns text language plpgsql set search_path='' as $$
declare b bytea; n integer;
begin
 loop
  b:=extensions.gen_random_bytes(3);
  n:=get_byte(b,0)*65536+get_byte(b,1)*256+get_byte(b,2);
  exit when n<16000000;
 end loop;
 return lpad((n%1000000)::text,6,'0');
end$$;
create function public.attendance_open(p_id uuid,p_group uuid,p_title text,p_minutes integer,p_expected integer)
returns text language plpgsql security definer set search_path='' as $$
declare code text; pepper bytea; opened_at timestamptz; n integer; prior attendance_private.sessions;
begin
 if not attendance_private.manages(p_group) then raise exception 'Teach access required'; end if;
 if p_group is not null then
  perform 1 from public.club_groups where id=p_group and teacher_id=auth.uid() and state='active' for share;
  if not found then raise exception 'Group unavailable'; end if;
 end if;
 if p_title is null or length(trim(p_title)) not between 1 and 120 or p_minutes is null or p_minutes not between 1 and 120 then
  raise exception 'Enter a title and a duration from 1 to 120 minutes.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,1701));
 select * into prior from attendance_private.sessions where id=p_id;
 if found then
  if prior.creator=auth.uid() and prior.group_id is not distinct from p_group then return null; end if;
  raise exception 'Session unavailable';
 end if;
 code:=attendance_private.code(); pepper:=extensions.gen_random_bytes(32); opened_at:=clock_timestamp();
 insert into attendance_private.sessions values(p_id,trim(p_title),p_group,(select name from public.club_groups where id=p_group),
 auth.uid(),opened_at,opened_at+make_interval(mins=>p_minutes),null,pepper,extensions.hmac(convert_to(code,'UTF8'),pepper,'sha256'));
 insert into attendance_private.records(session_id,student,name_en,name_zh)
 select p_id,p.id,coalesce(nullif(p.name_en,''),nullif(p.display_name,''),p.student_id),
 coalesce(nullif(p.name_zh,''),nullif(p.name_en,''),nullif(p.display_name,''),p.student_id)
 from homework_private.students(p_group) s join public.profiles p on p.id=s.id;
 get diagnostics n=row_count;
 if n is distinct from p_expected then raise exception 'Audience changed. Check the count again.'; end if;
 insert into public.attendance_signals(session_id) values(p_id);
 insert into attendance_private.audit(session_id,actor,action) values(p_id,auth.uid(),'open');
 return code;
end$$;
create function public.attendance_control(p_id uuid,p_action text) returns text
language plpgsql security definer set search_path='' as $$
declare s attendance_private.sessions; code text; next_hash bytea;
begin
 select * into s from attendance_private.sessions where id=p_id for update;
 if not found or not attendance_private.manages(s.group_id) then raise exception 'Teach access required'; end if;
 if least(s.expires,s.closed)<=clock_timestamp() then
  if p_action='close' then return null; end if;
  raise exception 'Check-in has ended.';
 end if;
 if p_action='rotate' then
  loop
   code:=attendance_private.code(); next_hash:=extensions.hmac(convert_to(code,'UTF8'),s.secret,'sha256');
   exit when next_hash<>s.digest;
  end loop;
  update attendance_private.sessions set digest=next_hash where id=p_id;
 elsif p_action='close' then
  update attendance_private.sessions set closed=clock_timestamp() where id=p_id;
 else raise exception 'Invalid action'; end if;
 insert into attendance_private.audit(session_id,actor,action) values(p_id,auth.uid(),p_action);
 update public.attendance_signals set revision=revision+1 where session_id=p_id;
 return code;
end$$;

create function public.attendance_check(p_id uuid,p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s attendance_private.sessions; r attendance_private.records; stamp timestamptz; blind bytea;
begin
 if not public.is_member() then raise exception 'Active membership required'; end if;
 select * into s from attendance_private.sessions where id=p_id for update;
 if not found or not attendance_private.in_scope(s.group_id) or homework_private.homework_staff_member(auth.uid()) then raise exception 'Session unavailable'; end if;
 select * into r from attendance_private.records where session_id=p_id and student=auth.uid() for update;
 if not found then raise exception 'Session unavailable'; end if;
 if r.checked_at is not null then return jsonb_build_object('status',r.status,'checked_at',r.checked_at); end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1702));
 stamp:=clock_timestamp();
 if least(s.expires,s.closed)<=stamp then return jsonb_build_object('error','Check-in has ended.'); end if;
 if exists(select from attendance_private.throttle where
  (kind='account' and bucket=auth.uid() and start_at>stamp-interval '5 minutes' and failures>=5)
  or (kind='session' and bucket=p_id and start_at>stamp-interval '1 minute' and failures>=40)) then
  return jsonb_build_object('error','Too many attempts. Try again later.');
 end if;
 -- Blind both fixed-length digests before comparison.
 blind:=extensions.gen_random_bytes(32);
 if p_code is null or p_code !~ '^[0-9]{6}$' or extensions.hmac(s.digest,blind,'sha256')<>
   extensions.hmac(extensions.hmac(convert_to(p_code,'UTF8'),s.secret,'sha256'),blind,'sha256') then
  insert into attendance_private.throttle as t values('account',auth.uid(),stamp,1),('session',p_id,stamp,1)
  on conflict(kind,bucket) do update set
   failures=case when t.start_at<=stamp-(case when t.kind='session' then interval '1 minute' else interval '5 minutes' end) then 1 else t.failures+1 end,
   start_at=case when t.start_at<=stamp-(case when t.kind='session' then interval '1 minute' else interval '5 minutes' end) then stamp else t.start_at end;
  return jsonb_build_object('error','Invalid check-in code.');
 end if;
 update attendance_private.records set status='Present',checked_at=stamp,revision=revision+1 where session_id=p_id and student=auth.uid();
 update public.attendance_signals set revision=revision+1 where session_id=p_id;
 return jsonb_build_object('status','Present','checked_at',stamp);
end$$;

create function public.attendance_correct(p_id uuid,p_student uuid,p_revision integer,p_status text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare s attendance_private.sessions; r attendance_private.records;
begin
 select * into s from attendance_private.sessions where id=p_id for update;
 if not found or not attendance_private.manages(s.group_id) then raise exception 'Teach access required'; end if;
 if least(s.expires,s.closed)>clock_timestamp() then raise exception 'Close check-in before correcting the roster.'; end if;
 if p_status is null or p_status not in ('Present','Late','Absent') or p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'Choose a status and enter a reason.'; end if;
 select * into r from attendance_private.records where session_id=p_id and student=p_student for update;
 if not found or r.revision is distinct from p_revision then raise exception 'Record changed. Refresh and try again.'; end if;
 if p_status=coalesce(r.status,'Absent') then return; end if;
 insert into attendance_private.audit(session_id,actor,student,action,previous,replacement,reason)
 values(p_id,auth.uid(),p_student,'correct',coalesce(r.status,'Absent'),p_status,trim(p_reason));
 update attendance_private.records set status=p_status,revision=revision+1 where session_id=p_id and student=p_student;
end$$;

create function public.attendance_list(p_history boolean default false,p_page integer default 0)
returns table(id uuid,title text,group_name text,opened timestamptz,ends timestamptz,personal text)
language sql stable security definer set search_path='' as $$
 select s.id,s.title,s.group_name,s.opened,least(s.expires,s.closed),
 case when r.student is null then null else coalesce(r.status,case when p_history then 'Absent' else 'Waiting' end) end
 from attendance_private.sessions s left join attendance_private.records r on r.session_id=s.id and r.student=auth.uid()
 where public.is_member() and (least(s.expires,s.closed)<=statement_timestamp())=p_history
 and (case when p_history then attendance_private.manages(s.group_id) or r.student is not null else attendance_private.in_scope(s.group_id) end)
 order by s.opened desc,s.id limit 21 offset (20*greatest(0,p_page)::bigint)
$$;
create function public.attendance_summary() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('total',count(*),'attended',count(*) filter(where status in ('Present','Late')),
 'late',count(*) filter(where status='Late')) from attendance_private.records r join attendance_private.sessions s on s.id=r.session_id
 where public.is_member() and r.student=auth.uid() and least(s.expires,s.closed)<=statement_timestamp()
$$;
create function public.attendance_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s attendance_private.sessions; live boolean; manager boolean; mine attendance_private.records; roster jsonb;
begin
 if not public.is_member() then raise exception 'Session unavailable'; end if;
 select * into s from attendance_private.sessions where id=p_id;
 if not found then raise exception 'Session unavailable'; end if;
 live:=least(s.expires,s.closed)>statement_timestamp();
 manager:=attendance_private.manages(s.group_id);
 select * into mine from attendance_private.records where session_id=p_id and student=auth.uid();
 if live and not attendance_private.in_scope(s.group_id) or not live and not manager and mine.student is null then raise exception 'Session unavailable'; end if;
 if live or manager then
  select coalesce(jsonb_agg(jsonb_build_object('en',name_en,'zh',name_zh,'status',coalesce(status,case when live then 'Waiting' else 'Absent' end))
   || case when manager then jsonb_build_object('student',student,'revision',revision) else '{}'::jsonb end order by name_en,student),'[]'::jsonb)
   into roster from attendance_private.records where session_id=p_id;
 end if;
 return jsonb_build_object('id',s.id,'title',s.title,'group_name',s.group_name,'live',live,'manager',manager,
 'opened',s.opened,'ends',least(s.expires,s.closed),'server_now',statement_timestamp(),'roster',roster,
 'personal',case when mine.student is null then null else coalesce(mine.status,case when live then 'Waiting' else 'Absent' end) end,
 'checked_at',mine.checked_at);
end$$;

revoke all on all tables in schema attendance_private from public,anon,authenticated;
revoke all on all functions in schema attendance_private from public,anon,authenticated;
do $$ declare f regprocedure;
begin
 for f in select p.oid::regprocedure from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in
 ('attendance_live_access','attendance_scopes','attendance_open','attendance_control','attendance_check','attendance_correct','attendance_list','attendance_summary','attendance_detail')
 loop execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to authenticated',f); end loop;
end$$;
