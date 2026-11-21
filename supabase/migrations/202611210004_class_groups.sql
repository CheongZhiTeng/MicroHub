-- Keep the established roster transaction, including audit and homework detachment,
-- private. Old clients must pass the same authorization as new clients.
alter function public.group_change(text,uuid,integer,uuid,uuid,integer,text,uuid) set schema homework_private;
revoke all on function homework_private.group_change(text,uuid,integer,uuid,uuid,integer,text,uuid) from public,anon,authenticated;
create function public.group_change(p_action text,p_group uuid,p_revision integer,p_person uuid default null,
 p_source uuid default null,p_source_revision integer default null,p_name text default null,p_replace uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(245619,1);
 if not public.is_super_admin() then raise exception 'Active teach access required'; end if;
 if p_action='archive' then raise exception 'Confirm deletion with your password'; end if;
 if p_action='assign' and (p_source is not null or exists(select from public.group_students where user_id=p_person)) then
   raise exception 'Remove the student from their current group first';
 end if;
 if p_action in ('teacher','appoint_teach') then
   if exists(select from public.club_groups where state<>'archived' and teacher_id=p_person and id<>p_group) then
     raise exception 'This teach already leads another group';
   end if;
   if not public.group_eligible(p_person) then raise exception 'Choose an active club member'; end if;
   if p_action='appoint_teach' then
     perform public.admin_set_account(p_person,'super_admin','active');
   elsif not exists(select from public.platform_roles where user_id=p_person and role='super_admin') then
     raise exception 'Confirm full teach access before appointment';
   end if;
   p_action:='teacher';
 end if;
 if p_action='assign' and exists(select from public.platform_roles where user_id=p_person and role='super_admin') then raise exception 'Choose a student'; end if;
 if p_action='activate' and not exists(select from public.club_groups g join public.platform_roles r on r.user_id=g.teacher_id where g.id=p_group and r.role='super_admin') then raise exception 'Confirm full teach access before appointment'; end if;
 return homework_private.group_change(p_action,p_group,p_revision,p_person,null,null,p_name,p_replace);
end $$;
revoke all on function public.group_change(text,uuid,integer,uuid,uuid,integer,text,uuid) from public,anon;
grant execute on function public.group_change(text,uuid,integer,uuid,uuid,integer,text,uuid) to authenticated;

-- Only a trusted worker which verified the actor's current password can call this.
create function public.group_delete_verified(p_actor uuid,p_group uuid,p_revision integer,p_verified_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform pg_advisory_xact_lock(245619,1);
 if p_verified_at is null or p_verified_at not between clock_timestamp()-interval '60 seconds' and clock_timestamp()
 then raise exception 'Password confirmation expired'; end if;
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 if not public.is_super_admin() then raise exception 'Active teach access required'; end if;
 result:=homework_private.group_change('archive',p_group,p_revision);
 update public.club_groups set teacher_id=null where id=result;
 return result;
end $$;
revoke all on function public.group_delete_verified(uuid,uuid,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.group_delete_verified(uuid,uuid,integer,timestamptz) to service_role;

create or replace function public.announcement_can_publish(p_group uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_super_admin() and (p_group is null or exists(select from public.club_groups where id=p_group and state='active'))
$$;

create or replace function public.group_workspace() returns jsonb language sql stable security definer set search_path='' as $$
  with rights as (select public.is_super_admin() as root, auth.uid() as me),
  people as (
    select p.id,p.display_name,p.name_en,p.name_zh,p.student_id,public.group_eligible(p.id) as eligible,
      s.group_id,coalesce(s.leader,false) as leader,
      exists(select from public.club_groups g where g.teacher_id=p.id and g.state<>'archived') as teacher, exists(select from public.platform_roles r where r.user_id=p.id and r.role='super_admin') as teach_access
    from public.profiles p left join public.group_students s on s.user_id=p.id
  ), visible as (
    select g.*, r.root as manage from public.club_groups g cross join rights r
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
    ((select root from rights) and p.group_id is null)),'[]'::jsonb))
$$;
