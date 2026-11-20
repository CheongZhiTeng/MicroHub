-- Group duties are scoped to the club roster and never grant a platform role.
create table public.club_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  state text not null default 'draft' check (state in ('draft','active','archived')),
  teacher_id uuid references public.profiles(id),
  revision integer not null default 1,
  check (state <> 'active' or teacher_id is not null)
);
create unique index club_group_name on public.club_groups(lower(name)) where state <> 'archived';
create table public.group_students (
  user_id uuid primary key references public.profiles(id),
  group_id uuid not null references public.club_groups(id),
  leader boolean not null default false
);
create index group_roster on public.group_students(group_id);
create table public.group_changes (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.club_groups(id),
  actor uuid not null references public.profiles(id),
  action text not null,
  subject uuid references public.profiles(id),
  happened_at timestamptz not null default now()
);
create index group_recent_changes on public.group_changes(group_id,id desc);
alter table public.club_groups enable row level security;
alter table public.group_students enable row level security;
alter table public.group_changes enable row level security;
revoke all on public.club_groups, public.group_students, public.group_changes from public, anon, authenticated;

create function public.group_eligible(person uuid) returns boolean
language sql stable set search_path='' as $$
  select exists(select from public.memberships m join public.profiles p on p.id=m.user_id
    join auth.users u on u.id=p.id where p.id=person and m.status='active' and p.status='active' and u.email_confirmed_at is not null)
$$;

-- Small, single-club roster. One transaction lock serializes changes spanning
-- groups (including teacher appointments and transfers). Revisions guard stale forms.
create function public.group_change(
  p_action text, p_group uuid, p_revision integer, p_person uuid default null,
  p_source uuid default null, p_source_revision integer default null, p_name text default null,
  p_replace uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  g public.club_groups; old_group uuid; old_role boolean; actor uuid := auth.uid();
  root boolean; n integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(245619, 1);
  root := public.is_super_admin();
  if not public.is_member() then raise exception 'Membership required'; end if;
  if p_action='create' then
    if not root then raise exception 'Super Admin required'; end if;
    insert into public.club_groups(name) values(btrim(p_name)) returning * into g;
  else
    select * into g from public.club_groups where id=p_group for update;
    if g.id is null or g.state='archived' or (not root and g.teacher_id is distinct from actor) then
      raise exception 'Group management access required';
    end if;
    if g.revision is distinct from p_revision then raise exception 'Roster changed. Refresh and try again.'; end if;
    if p_action in ('teacher','archive') and not root then raise exception 'Super Admin required'; end if;
    select group_id,leader into old_group,old_role from public.group_students where user_id=p_person;
    if p_action in ('teacher','assign','promote') and not public.group_eligible(p_person) then raise exception 'Choose an active club member'; end if;
    case p_action
      when 'teacher' then
        if old_group is not null then raise exception 'Remove the student placement first'; end if;
        update public.club_groups set teacher_id=p_person where id=g.id;
      when 'assign' then
        if old_group is not null and (not root or old_group=g.id) then raise exception 'Student already assigned'; end if;
        if old_group is distinct from p_source or (old_group is not null and p_source_revision is distinct from
          (select revision from public.club_groups where id=old_group)) then raise exception 'Roster changed. Refresh and try again.'; end if;
        if exists(select from public.club_groups where teacher_id=p_person and state<>'archived') then raise exception 'Member is a group teacher'; end if;
        if old_group is not null then
          if old_role and exists(select from public.club_groups where id=old_group and state='active') and not exists(
            select from public.group_students where group_id=old_group and leader and user_id<>p_person and public.group_eligible(user_id)
          ) then raise exception 'Replace the last leader first'; end if;
          update public.club_groups set revision=revision+1 where id=old_group;
          insert into public.group_changes(group_id,actor,action,subject) values(old_group,actor,'transfer_out',p_person);
        end if;
        insert into public.group_students values(p_person,g.id,false)
          on conflict(user_id) do update set group_id=excluded.group_id,leader=false;
      when 'promote' then
        if old_group is distinct from g.id or old_role then raise exception 'Choose a student in this group'; end if;
        if p_replace is not null then
          update public.group_students set leader=false where user_id=p_replace and group_id=g.id and leader;
          if not found then raise exception 'Choose a current leader'; end if;
          insert into public.group_changes(group_id,actor,action,subject) values(g.id,actor,'demote',p_replace);
        end if;
        select count(*) into n from public.group_students where group_id=g.id and leader;
        if n>=2 then raise exception 'Each group has at most two leaders'; end if;
        update public.group_students set leader=true where user_id=p_person;
      when 'demote','remove' then
        if old_group is distinct from g.id or (p_action='demote' and not old_role) then raise exception 'Choose a member of this group'; end if;
        if old_role and g.state='active' and not exists(select from public.group_students
          where group_id=g.id and user_id<>p_person and leader and public.group_eligible(user_id))
          then raise exception 'Replace the last leader first'; end if;
        if p_action='remove' then delete from public.group_students where user_id=p_person;
        else update public.group_students set leader=false where user_id=p_person; end if;
      when 'activate' then
        if g.state<>'draft' or not public.group_eligible(g.teacher_id) or not exists(select from public.group_students
           where group_id=g.id and leader and public.group_eligible(user_id)) then raise exception 'An active teacher and leader are required'; end if;
        update public.club_groups set state='active' where id=g.id;
      when 'archive' then
        insert into public.group_changes(group_id,actor,action,subject)
          select g.id,actor,'remove',user_id from public.group_students where group_id=g.id;
        delete from public.group_students where group_id=g.id;
        update public.club_groups set state='archived' where id=g.id;
      else raise exception 'Unknown group change';
    end case;
    update public.club_groups set revision=revision+1 where id=g.id;
  end if;
  insert into public.group_changes(group_id,actor,action,subject) values(g.id,actor,p_action,p_person);
  return g.id;
end $$;

create function public.group_workspace() returns jsonb language sql stable security definer set search_path='' as $$
  with rights as (select public.is_super_admin() as root, auth.uid() as me),
  people as (
    select p.id,p.display_name,p.name_en,p.name_zh,p.student_id,public.group_eligible(p.id) as eligible,
      s.group_id,coalesce(s.leader,false) as leader,
      exists(select from public.club_groups g where g.teacher_id=p.id and g.state<>'archived') as teacher
    from public.profiles p left join public.group_students s on s.user_id=p.id
  ), visible as (
    select g.*, (r.root or g.teacher_id=r.me) as manage from public.club_groups g cross join rights r
    where public.is_member() and (r.root or (g.state<>'archived' and g.teacher_id=r.me) or
      (g.state='active' and exists(select from public.group_students s where s.group_id=g.id and s.user_id=r.me)))
  )
  select jsonb_build_object('groups',coalesce((select jsonb_agg(to_jsonb(v) || jsonb_build_object(
    'roster',coalesce((select jsonb_agg(to_jsonb(p) order by p.student_id) from people p where
      (p.group_id=v.id or p.id=v.teacher_id) and (p.eligible or v.manage)),'[]'::jsonb),
    'changes',case when v.manage then (select coalesce(jsonb_agg(to_jsonb(h) order by h.id desc),'[]'::jsonb) from
      (select c.id,c.action,c.happened_at, a.student_id as actor, s.student_id as subject from public.group_changes c
       join public.profiles a on a.id=c.actor left join public.profiles s on s.id=c.subject
       where c.group_id=v.id order by c.id desc limit 30) h) else '[]'::jsonb end
  ) order by v.name) from visible v),'[]'::jsonb),
  'candidates',coalesce((select jsonb_agg(to_jsonb(p) order by p.student_id) from people p where p.eligible and
    ((select root from rights) or (p.group_id is null and not p.teacher and exists(select from visible where manage and state<>'archived')))),'[]'::jsonb))
$$;
revoke all on function public.group_eligible(uuid),public.group_workspace(),public.group_change(text,uuid,integer,uuid,uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.group_workspace(),public.group_change(text,uuid,integer,uuid,uuid,integer,text,uuid) to authenticated;
