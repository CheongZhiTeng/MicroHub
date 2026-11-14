-- Run manually in the Supabase SQL Editor as project owner, after the intended
-- school account signs up and verifies its email. This is not a migration.
-- Replace the literal; never use raw_user_meta_data for elevated roles.
begin;
lock table public.platform_roles in exclusive mode;
do $$
declare
  school_email text := 'REPLACE_WITH_VERIFIED_SCHOOL_EMAIL';
  first_admin uuid;
begin
  if exists(select 1 from public.platform_roles where role = 'super_admin') then
    raise exception 'Super Admin already exists; use the authorized role RPC';
  end if;
  select u.id into first_admin from auth.users u join public.profiles p on p.id=u.id
    where u.email=school_email and u.email_confirmed_at is not null and p.status='active';
  if first_admin is null then raise exception 'Verified active school account not found'; end if;
  insert into public.memberships(user_id) values(first_admin) on conflict(user_id) do update set status='active';
  update public.platform_roles set role='super_admin' where user_id=first_admin;
  insert into public.audit_logs(actor_id,action,target_id) values(first_admin,'super_admin.bootstrap',first_admin);
end $$;
commit;
