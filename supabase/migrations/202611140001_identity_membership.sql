-- Initial MVP boundary: identity, one club, applications, roles, audit.
create type public.technical_role as enum ('member', 'admin', 'super_admin');
create type public.account_status as enum ('active', 'suspended');
create type public.membership_status as enum ('active', 'inactive');
create type public.application_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  student_id text not null unique check (student_id ~ '^[0-9]{6}$'),
  display_name text not null default '' check (char_length(display_name) <= 100),
  class_name text not null default '' check (char_length(class_name) <= 40),
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.platform_roles (
  user_id uuid primary key references public.profiles(id),
  role public.technical_role not null default 'member',
  updated_at timestamptz not null default now()
);
create table public.club_settings (
  singleton boolean primary key default true check (singleton),
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  updated_at timestamptz not null default now()
);
insert into public.club_settings(name) values ('MicroHub');
create table public.committee_positions (
  id uuid primary key default gen_random_uuid(),
  title text not null unique check (char_length(title) between 1 and 80)
);
create table public.memberships (
  user_id uuid primary key references public.profiles(id),
  status public.membership_status not null default 'active',
  committee_position_id uuid references public.committee_positions(id),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  status public.application_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  check ((status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status <> 'pending' and reviewed_at is not null and reviewed_by is not null))
);
create unique index one_pending_application on public.membership_applications(user_id) where status = 'pending';
create index applications_user_created on public.membership_applications(user_id, created_at desc);
create index memberships_position on public.memberships(committee_position_id);
create index applications_reviewer on public.membership_applications(reviewed_by);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_actor_time on public.audit_logs(actor_id, created_at desc);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger profile_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger club_updated before update on public.club_settings for each row execute function public.touch_updated_at();
create trigger role_updated before update on public.platform_roles for each row execute function public.touch_updated_at();
create trigger membership_updated before update on public.memberships for each row execute function public.touch_updated_at();

-- This applies even if a client bypasses the application and calls Auth directly.
create function public.enforce_school_identity() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or new.email !~ '^sa[0-9]{6}@foonyewsa\.edu\.my$' then
    raise exception 'Only official school email addresses may register' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.email is distinct from old.email then
    raise exception 'School account email is immutable; contact the school administrator' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger school_identity before insert or update of email on auth.users for each row execute function public.enforce_school_identity();
create function public.provision_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, student_id) values(new.id, substring(new.email from 3 for 6));
  insert into public.platform_roles(user_id) values(new.id);
  return new;
end $$;
create trigger provision_profile after insert on auth.users for each row execute function public.provision_profile();

create function public.is_verified() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u where u.id = (select auth.uid())
    and u.email_confirmed_at is not null and u.email ~ '^sa[0-9]{6}@foonyewsa\.edu\.my$');
$$;
create function public.is_active_user() returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_verified() and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'active');
$$;
create function public.is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_user() and exists(select 1 from public.memberships m where m.user_id = (select auth.uid()) and m.status = 'active');
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_member() and exists(select 1 from public.platform_roles r where r.user_id = (select auth.uid()) and r.role in ('admin','super_admin'));
$$;
create function public.is_super_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_member() and exists(select 1 from public.platform_roles r where r.user_id = (select auth.uid()) and r.role = 'super_admin');
$$;

alter table public.profiles enable row level security;
alter table public.platform_roles enable row level security;
alter table public.club_settings enable row level security;
alter table public.committee_positions enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_applications enable row level security;
alter table public.audit_logs enable row level security;

-- No default Supabase grants: explicitly expose only safe operations/columns.
revoke all on public.profiles, public.platform_roles, public.club_settings, public.committee_positions, public.memberships, public.membership_applications, public.audit_logs from anon, authenticated;
grant select on public.profiles, public.platform_roles, public.club_settings, public.committee_positions, public.memberships, public.membership_applications, public.audit_logs to authenticated;
grant update(display_name, class_name) on public.profiles to authenticated;
create policy profile_read on public.profiles for select to authenticated using (
  (public.is_verified() and id = (select auth.uid())) or public.is_admin()
  or (public.is_member() and status = 'active' and exists(select 1 from public.memberships m where m.user_id = profiles.id and m.status = 'active'))
);
create policy profile_edit on public.profiles for update to authenticated using (public.is_active_user() and id = (select auth.uid())) with check (public.is_active_user() and id = (select auth.uid()));
create policy role_read on public.platform_roles for select to authenticated using (public.is_member() or (public.is_verified() and user_id = (select auth.uid())));
create policy club_read on public.club_settings for select to authenticated using (public.is_member());
create policy position_read on public.committee_positions for select to authenticated using (public.is_member());
create policy membership_read on public.memberships for select to authenticated using (public.is_member() or (public.is_verified() and user_id = (select auth.uid())));
create policy application_read on public.membership_applications for select to authenticated using (public.is_active_user() and (user_id = (select auth.uid()) or public.is_admin()));
create policy audit_read on public.audit_logs for select to authenticated using (public.is_super_admin());

create function public.apply_for_membership() returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if not public.is_active_user() then raise exception 'Verified active school account required' using errcode = '42501'; end if;
  -- Serialize a user's applications and approval; RLS alone cannot prevent races.
  perform 1 from public.profiles where id = auth.uid() for update;
  if public.is_member() then raise exception 'Already an active member' using errcode = '23514'; end if;
  if exists(select 1 from public.memberships where user_id = auth.uid() and status = 'inactive') then
    raise exception 'Contact an administrator to restore membership' using errcode = '42501';
  end if;
  if not exists(select 1 from public.profiles where id = auth.uid() and length(trim(display_name)) > 0 and length(trim(class_name)) > 0) then
    raise exception 'Complete your name and class before applying' using errcode = '23514';
  end if;
  select id into result from public.membership_applications where user_id = auth.uid() and status = 'pending';
  if result is not null then return result; end if;
  if exists(select 1 from public.membership_applications where user_id = auth.uid() and created_at > now() - interval '1 day') then
    raise exception 'Please wait 24 hours before applying again' using errcode = '23514';
  end if;
  insert into public.membership_applications(user_id) values(auth.uid()) returning id into result;
  return result;
end $$;

create function public.review_membership(p_application_id uuid, p_approve boolean) returns void language plpgsql security definer set search_path = '' as $$
declare applicant uuid; current_status public.application_status;
begin
  if not public.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if p_approve is null then raise exception 'Decision required' using errcode = '23514'; end if;
  select user_id into applicant from public.membership_applications where id = p_application_id;
  if applicant is null then raise exception 'Application not found' using errcode = 'P0002'; end if;
  perform 1 from public.profiles where id = applicant for update;
  select status into current_status from public.membership_applications where id = p_application_id for update;
  if current_status <> 'pending' then raise exception 'Application already reviewed' using errcode = '23514'; end if;
  if not exists(select 1 from public.profiles p join auth.users u on u.id = p.id where p.id = applicant and p.status = 'active' and u.email_confirmed_at is not null) then
    raise exception 'Applicant is not eligible' using errcode = '42501';
  end if;
  if p_approve then
    insert into public.memberships(user_id) values(applicant) on conflict(user_id) do update set status = 'active';
  end if;
  update public.membership_applications set status = case when p_approve then 'approved'::public.application_status else 'rejected'::public.application_status end, reviewed_at = now(), reviewed_by = auth.uid() where id = p_application_id;
  insert into public.audit_logs(actor_id, action, target_id, details) values(auth.uid(), 'membership.review', applicant, jsonb_build_object('application_id', p_application_id, 'approved', p_approve));
end $$;

create function public.admin_set_account(p_user_id uuid, p_role public.technical_role, p_status public.account_status) returns void language plpgsql security definer set search_path = '' as $$
begin
  -- One global transaction lock serializes all role/suspension changes.
  perform pg_advisory_xact_lock(8142026);
  if not public.is_super_admin() then raise exception 'Super Admin required' using errcode = '42501'; end if;
  if p_role is null or p_status is null then raise exception 'Role and status required' using errcode = '23514'; end if;
  if not exists(select 1 from public.memberships m join auth.users u on u.id = m.user_id where m.user_id = p_user_id and m.status = 'active' and u.email_confirmed_at is not null) then
    raise exception 'Verified active membership required' using errcode = '23514';
  end if;
  if exists(select 1 from public.platform_roles where user_id = p_user_id and role = 'super_admin')
    and (p_role <> 'super_admin' or p_status <> 'active')
    and (select count(*) from public.platform_roles r join public.profiles p on p.id = r.user_id join public.memberships m on m.user_id = r.user_id join auth.users u on u.id = r.user_id where r.role = 'super_admin' and p.status = 'active' and m.status = 'active' and u.email_confirmed_at is not null) <= 1 then
    raise exception 'Cannot disable the final Super Admin' using errcode = '23514';
  end if;
  update public.platform_roles set role = p_role where user_id = p_user_id;
  update public.profiles set status = p_status where id = p_user_id;
  insert into public.audit_logs(actor_id, action, target_id, details) values(auth.uid(), 'account.update', p_user_id, jsonb_build_object('role', p_role, 'status', p_status));
end $$;

create function public.update_club(p_name text, p_description text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Super Admin required' using errcode = '42501'; end if;
  update public.club_settings set name = trim(p_name), description = trim(p_description) where singleton;
  insert into public.audit_logs(actor_id, action) values(auth.uid(), 'club.update');
end $$;

revoke execute on function public.touch_updated_at(), public.enforce_school_identity(), public.provision_profile(), public.is_verified(), public.is_active_user(), public.is_member(), public.is_admin(), public.is_super_admin(), public.apply_for_membership(), public.review_membership(uuid, boolean), public.admin_set_account(uuid, public.technical_role, public.account_status), public.update_club(text,text) from public, anon, authenticated;
grant execute on function public.is_verified(), public.is_active_user(), public.is_member(), public.is_admin(), public.is_super_admin(), public.apply_for_membership(), public.review_membership(uuid, boolean), public.admin_set_account(uuid, public.technical_role, public.account_status), public.update_club(text,text) to authenticated;
