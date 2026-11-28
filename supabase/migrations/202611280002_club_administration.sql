create schema club_private;
revoke all on schema club_private from public, anon, authenticated;
alter table public.platform_roles add column office text
  check (office is null or (office in ('president','vice_president') and role='super_admin'));
alter table public.committee_positions add column active boolean not null default true;

create function club_private.executive() returns boolean
language sql stable set search_path='' as $$
 select public.is_super_admin() and exists(select from public.platform_roles where user_id=auth.uid() and office is not null)
$$;
create or replace function attendance_private.manages(g uuid) returns boolean
language sql stable set search_path='' as $$
 select public.is_super_admin() and (g is null or club_private.executive() or exists(
   select from public.club_groups where id=g and teacher_id=auth.uid()))
$$;
create or replace function public.attendance_open(p_id uuid,p_group uuid,p_title text,p_minutes integer,p_expected integer)
returns text language plpgsql security definer set search_path='' as $$
declare code text; pepper bytea; opened_at timestamptz; n integer; prior attendance_private.sessions;
begin
 perform pg_advisory_xact_lock_shared(245619,1);
 if not attendance_private.manages(p_group) then raise exception 'Teach access required'; end if;
 if p_group is not null then
  perform 1 from public.club_groups where id=p_group and attendance_private.manages(p_group) and state='active' for share;
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
    select p_id,id,display_name,student_id from candidates on conflict (assignment_id,member_id) do update set staff_excluded=false, excused=false, detached=false
    where assignment_recipients.staff_excluded returning member_id
  ) select (select count(*) from candidates),array(select member_id from additions) into eligible,added;
  if eligible<>requested then raise exception 'Some selected members are no longer active. Refresh the list.'; end if;
  if cardinality(added)>0 then
    insert into public.assignment_audit_events(assignment_id,actor_id,action,details)
      values(p_id,auth.uid(),'add_recipients',jsonb_build_object('members',added));
  end if;
  return cardinality(added);
end $$;


-- Keep legacy role changes subject to the same group and final-admin checks.
alter function public.admin_set_account(uuid,public.technical_role,public.account_status) set schema club_private;
create function public.admin_set_account(p_user_id uuid,p_role public.technical_role,p_status public.account_status)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(245619,1);
 if not public.is_super_admin() then raise exception 'Super Admin required'; end if;
 if (p_role<>'super_admin' or p_status<>'active') and exists(
  select from public.club_groups where teacher_id=p_user_id and state<>'archived')
 then raise exception 'Hand over the group first.'; end if;
 if p_role<>'super_admin' then update public.platform_roles set office=null where user_id=p_user_id; end if;
 perform club_private.admin_set_account(p_user_id,p_role,p_status);
end $$;
create function club_private.exclude_attendance() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from attendance_private.records r using attendance_private.sessions s
 where r.session_id=s.id and r.student=new.user_id and r.checked_at is null
 and least(s.closed,s.expires)>clock_timestamp();
 return new;
end $$;
create trigger attendance_promotion after update of role on public.platform_roles
 for each row when (new.role='super_admin' and old.role<>new.role) execute function club_private.exclude_attendance();

create table club_private.invites (
 id uuid primary key default gen_random_uuid(), digest bytea not null unique,
 issuer uuid not null references public.profiles, expires timestamptz not null default now()+interval '7 days',
 revoked boolean not null default false, redeemed_by uuid references public.profiles, created_at timestamptz not null default now()
);
create function club_private.audit(action text,target uuid,details jsonb default '{}'::jsonb)
returns void language sql set search_path='' as $$
 insert into public.audit_logs(actor_id,action,target_id,details) values(auth.uid(),$1,$2,$3)
$$;
create function public.club_invite_issue() returns text language plpgsql security definer set search_path='' as $$
declare code text; invitation uuid;
begin
 if not public.is_super_admin() then raise exception 'Full administrator required.'; end if;
 code:=encode(extensions.gen_random_bytes(16),'hex');
 insert into club_private.invites(digest,issuer) values(extensions.digest(code,'sha256'),auth.uid()) returning id into invitation;
 perform club_private.audit('invite.create',invitation);
 return code;
end $$;
create function public.club_invite_revoke(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'Full administrator required.'; end if;
 update club_private.invites set revoked=true where id=p_id and not revoked and redeemed_by is null;
 if found then perform club_private.audit('invite.revoke',p_id); end if;
end $$;
create function public.club_invite_redeem(p_code text) returns void language plpgsql security definer set search_path='' as $$
declare invitation club_private.invites;
begin
 if not public.is_active_user() then raise exception 'Active account required'; end if;
 perform 1 from public.profiles where id=auth.uid() and nullif(trim(name_en),'') is not null
 and nullif(trim(name_zh),'') is not null and trim(class_name)<>'' for update;
 if not found then raise exception 'Complete both names and class first.'; end if;
 select * into invitation from club_private.invites where digest=extensions.digest(lower(trim(p_code)),'sha256') for update;
 if not found then raise exception 'Invitation unavailable.'; end if;
 if invitation.redeemed_by=auth.uid() and public.is_member() then return; end if;
 if invitation.revoked or invitation.redeemed_by is not null or invitation.expires<=clock_timestamp() then raise exception 'Invitation unavailable.'; end if;
 if exists(select from public.memberships where user_id=auth.uid()) then raise exception 'Contact an administrator about your membership.'; end if;
 insert into public.memberships(user_id) values(auth.uid());
 update public.membership_applications set status='approved',reviewed_at=now(),reviewed_by=invitation.issuer where user_id=auth.uid() and status='pending';
 update club_private.invites set redeemed_by=auth.uid() where id=invitation.id;
 perform club_private.audit('invite.redeem',invitation.id);
end $$;

create view club_private.roster as
 select p.id,p.student_id,p.name_en,p.name_zh,p.display_name,p.status::text as account,
 m.status::text as membership,m.committee_position_id as position_id,
 coalesce(r.office,case when r.role='super_admin' then 'teach' else r.role::text end) as identity,
 s.group_id,g.name as group_name,
 md5(row(m.updated_at,r.updated_at,p.updated_at,r.office,s.group_id,m.committee_position_id)::text) as version
 from public.memberships m join public.profiles p on p.id=m.user_id join public.platform_roles r on r.user_id=p.id
 left join public.group_students s on s.user_id=p.id left join public.club_groups g on g.id=s.group_id;

create function public.club_member_change(p_id uuid,p_version text,p_action text,p_value text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare person club_private.roster; role public.technical_role; status public.account_status;
begin
 perform pg_advisory_xact_lock(245619,1);
 if not public.is_super_admin() then raise exception 'Full administrator required.'; end if;
 if nullif(trim(p_reason),'') is null or length(p_reason)>500 then raise exception 'Enter a reason.'; end if;
 perform 1 from public.profiles where id=p_id for update;
 select * into person from club_private.roster where id=p_id;
 if not found or person.version is distinct from p_version then raise exception 'Record changed. Refresh and try again.'; end if;
 if person.membership='inactive' and p_action<>'restore' then raise exception 'Restore membership first.'; end if;
 select r.role,p.status into role,status from public.platform_roles r join public.profiles p on p.id=r.user_id where p.id=p_id;
 if p_action='identity' then
  if p_value not in ('president','vice_president','teach','member','admin') or p_value is null then raise exception 'Invalid identity'; end if;
  if person.group_id is not null and p_value in ('president','vice_president','teach') then perform public.group_change('remove', person.group_id,
   (select revision from public.club_groups where id=person.group_id),p_id); end if;
  perform public.admin_set_account(p_id, case when p_value in ('president','vice_president','teach') then 'super_admin' else p_value::public.technical_role end,status);
  update public.platform_roles set office=case when p_value in ('president','vice_president') then p_value end where user_id=p_id;
 elsif p_action in ('suspend','resume') then
  perform public.admin_set_account(p_id,role,case when p_action='suspend' then 'suspended'::public.account_status else 'active'::public.account_status end);
 elsif p_action='remove' then
  perform public.admin_set_account(p_id,'member',status);
  if person.group_id is not null then perform public.group_change('remove',person.group_id,(select revision from public.club_groups where id=person.group_id),p_id); end if;
  update public.memberships set status='inactive',committee_position_id=null where user_id=p_id;
 elsif p_action='restore' and person.membership='inactive' then
  update public.memberships set status='active',joined_at=now() where user_id=p_id;
 elsif p_action='position' then
  if p_value is not null then
   perform 1 from public.committee_positions where id=p_value::uuid and active for share;
   if not found then raise exception 'Position unavailable.'; end if;
  end if;
  update public.memberships set committee_position_id=p_value::uuid where user_id=p_id;
 else raise exception 'Invalid action'; end if;
 perform club_private.audit('member.'||p_action,p_id,jsonb_build_object('reason',trim(p_reason),
 'before',jsonb_build_object('identity',person.identity,'account',person.account,'membership',person.membership,'position',person.position_id),
 'after',(select jsonb_build_object('identity',r.identity,'account',r.account,'membership',r.membership,'position',r.position_id) from club_private.roster r where r.id=p_id)));
end $$;

create function public.club_position_save(p_id uuid,p_title text,p_active boolean,p_previous text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'Full administrator required.'; end if;
 if p_previous is null then
  insert into public.committee_positions(id,title,active) values(p_id,trim(p_title),p_active);
 else
  update public.committee_positions set title=trim(p_title),active=p_active where id=p_id and title=p_previous and active;
  if not found then raise exception 'Record changed. Refresh and try again.'; end if;
 end if;
 if not p_active then update public.memberships set committee_position_id=null where committee_position_id=p_id; end if;
 perform club_private.audit('position.save',p_id,jsonb_build_object('before',p_previous,'after',trim(p_title),'active',p_active));
end $$;

create function public.club_admin_panel(p_tab text,p_search text default '',p_filter text default '',p_group text default '',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; skip bigint:=greatest(0,p_page)::bigint*20;
begin
 if not public.is_super_admin() then raise exception 'Full administrator required.'; end if;
 case p_tab when 'overview' then
  return jsonb_build_object('pending',(select count(*) from public.membership_applications where status='pending'),
  'members',(select count(*) from club_private.roster where membership='active' and account='active'),
  'suspended',(select count(*) from club_private.roster where account='suspended'),
  'invites',(select count(*) from club_private.invites where not revoked and redeemed_by is null and expires>now()));
 when 'members' then
  select jsonb_agg(to_jsonb(x) order by x.student_id) into result from
  (select * from club_private.roster r where (p_filter='' or p_filter in (identity,membership,account) or (p_filter='eligible' and membership='active' and account='active'))
   and (p_group='' or group_id::text=p_group)
   and strpos(lower(concat_ws(' ',name_en,name_zh,display_name,student_id)),lower(p_search))>0
   order by student_id limit 21 offset skip) x;
 when 'invites' then
  select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id) into result from
  (select id,created_at,expires,case when revoked then 'revoked' when redeemed_by is not null then 'used' when expires<=now() then 'expired' else 'available' end as state
   from club_private.invites where p_filter<>'available' or (not revoked and redeemed_by is null and expires>now()) order by created_at desc,id limit 21 offset skip) x;
 when 'audit' then
  select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id) into result from
  (select a.id,a.action,a.created_at,a.target_id,a.details,p.display_name actor from public.audit_logs a left join public.profiles p on p.id=a.actor_id
   where (p_filter='' or strpos(a.action,p_filter)=1) and (p_group='' or (a.created_at at time zone 'Asia/Kuala_Lumpur')::date=nullif(p_group,'')::date)
   and (p_search='' or strpos(lower(concat_ws(' ',p.name_en,p.name_zh,p.display_name,p.student_id)),lower(p_search))>0)
   order by a.created_at desc,a.id limit 21 offset skip) x;
 else raise exception 'Invalid tab'; end case;
 return coalesce(result,'[]'::jsonb);
end $$;
revoke all on all functions in schema club_private from public,anon,authenticated;
do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in
 ('admin_set_account','club_admin_panel','club_member_change','club_invite_issue','club_invite_revoke','club_invite_redeem','club_position_save') loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to authenticated',f); end loop;
end $$;
alter table public.club_settings add column logo_id uuid references public.profile_avatar_files(id), add column logo_owner uuid references public.profiles;
create function public.club_logo_commit(p_actor uuid,p_previous uuid,p_next uuid) returns void
language plpgsql security definer set search_path='' as $$
declare previous uuid;
begin
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 if not public.is_super_admin() then raise exception 'Full administrator required.'; end if;
 select logo_id into strict previous from public.club_settings where singleton for update;
 if previous is distinct from p_previous then raise exception 'Logo changed. Refresh and try again.' using errcode='40001'; end if;
 if p_next is not null then
  update public.profile_avatar_files set clean_after=null where id=p_next and owner_id=p_actor and clean_after>clock_timestamp();
  if not found then raise exception 'Invalid photo'; end if;
 end if;
 update public.club_settings set logo_id=p_next,logo_owner=case when p_next is not null then p_actor end where singleton;
 update public.profile_avatar_files set clean_after=now() where id=previous and id is distinct from p_next;
 perform club_private.audit('club.logo',null,jsonb_build_object('before',previous,'after',p_next));
end $$;
revoke all on function public.club_logo_commit(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.club_logo_commit(uuid,uuid,uuid) to service_role;
create or replace function public.avatar_can_read(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.profiles p where p.avatar_id is not null and p_path='avatars/'||p.id||'/'||p.avatar_id||'.jpg'
  and ((p.id=auth.uid() and public.is_active_user()) or (public.is_member() and public.group_eligible(p.id))))
 or (public.is_member() and exists(select from public.club_settings where p_path='avatars/'||logo_owner||'/'||logo_id||'.jpg'))
$$;

-- Sensitive writes go through a versioned member change or a confirmed group appointment.
revoke execute on function public.admin_set_account(uuid,public.technical_role,public.account_status) from authenticated;
alter function public.group_change(text,uuid,integer,uuid,uuid,integer,text,uuid) set schema club_private;
revoke execute on function club_private.group_change(text,uuid,integer,uuid,uuid,integer,text,uuid) from public,anon,authenticated;
create function public.group_change(p_action text,p_group uuid,p_revision integer,p_person uuid default null,
 p_source uuid default null,p_source_revision integer default null,p_name text default null,p_replace uuid default null,p_reason text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; previous text;
begin
 perform pg_advisory_xact_lock(245619,1);
 if p_action='appoint_teach' then
  if nullif(trim(p_reason),'') is null or length(p_reason)>500 then raise exception 'Enter a reason.'; end if;
  select identity into previous from club_private.roster where id=p_person;
 end if;
 result:=club_private.group_change(p_action,p_group,p_revision,p_person,p_source,p_source_revision,p_name,p_replace);
 if p_action='appoint_teach' then
  perform club_private.audit('member.identity',p_person,jsonb_build_object('reason',trim(p_reason),'before',previous,
  'after',(select identity from club_private.roster where id=p_person),'group',result));
 end if;
 return result;
end $$;
revoke all on function public.group_change(text,uuid,integer,uuid,uuid,integer,text,uuid,text) from public,anon;
grant execute on function public.group_change(text,uuid,integer,uuid,uuid,integer,text,uuid,text) to authenticated;

create or replace function public.update_club(p_name text,p_description text) returns void
language plpgsql security definer set search_path='' as $$
declare previous jsonb;
begin
 if not public.is_super_admin() then raise exception 'Full administrator required.'; end if;
 select jsonb_build_object('name',name,'description',description) into previous from public.club_settings where singleton for update;
 update public.club_settings set name=trim(p_name),description=trim(p_description) where singleton;
 perform club_private.audit('club.update',null,jsonb_build_object('before',previous,'after',jsonb_build_object('name',trim(p_name),'description',trim(p_description))));
end $$;
