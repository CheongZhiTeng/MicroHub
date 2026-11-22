-- Profile photos use immutable object names so a replacement never changes an existing link.
alter table public.profiles add column avatar_id uuid;
create table public.profile_avatar_files (
  id uuid primary key,
  owner_id uuid not null references public.profiles(id),
  clean_after timestamptz default now() + interval '1 hour'
);
create index profile_avatar_cleanup on public.profile_avatar_files(clean_after) where clean_after is not null;
alter table public.profile_avatar_files enable row level security;
revoke all on public.profile_avatar_files from public, anon, authenticated;
grant select, insert, delete on public.profile_avatar_files to service_role;

create function public.avatar_commit(p_actor uuid, p_previous uuid, p_next uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare previous uuid;
begin
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  select avatar_id into strict previous from public.profiles where id = p_actor for update;
  if not public.is_active_user() then raise exception 'Active account required' using errcode='42501'; end if;
  if previous is distinct from p_previous then raise exception 'Photo changed. Open your profile again.' using errcode='40001'; end if;
  if p_next is not null then
    update public.profile_avatar_files set clean_after = null
    where id = p_next and owner_id = p_actor and clean_after > clock_timestamp();
    if not found then raise exception 'Invalid photo'; end if;
  end if;
  update public.profiles set avatar_id = p_next where id = p_actor;
  update public.profile_avatar_files set clean_after = now() where id = previous and id is distinct from p_next;
end $$;
revoke all on function public.avatar_commit(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.avatar_commit(uuid,uuid,uuid) to service_role;

create function public.avatar_can_read(p_path text) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select from public.profiles p where p.avatar_id is not null
   and p_path = 'avatars/' || p.id::text || '/' || p.avatar_id::text || '.jpg'
   and ((p.id = (select auth.uid()) and public.is_active_user()) or (public.is_member() and public.group_eligible(p.id))));
$$;
revoke all on function public.avatar_can_read(text) from public,anon;
grant execute on function public.avatar_can_read(text) to authenticated;
