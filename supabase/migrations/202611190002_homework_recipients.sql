-- Explicit additions preserve the published snapshot and existing work.
create function public.hw_add_recipients(p_id uuid, p_members uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare a public.assignments; added uuid[]; eligible integer; requested integer;
begin
  if not public.is_admin() then raise exception 'Administrator required'; end if;
  select * into a from public.assignments where id=p_id for update;
  if a.lifecycle is distinct from 'published' then raise exception 'Choose a published assignment.'; end if;
  select count(distinct id) into requested from unnest(p_members) id;
  if requested=0 then raise exception 'Select at least one member.'; end if;
  with candidates as materialized (
    select p.id,p.display_name,p.student_id from public.profiles p join public.memberships m on m.user_id=p.id
    join auth.users u on u.id=p.id where p.id=any(p_members) and p.status='active' and m.status='active' and u.email_confirmed_at is not null
  ), additions as (
    insert into public.assignment_recipients (assignment_id,member_id,member_name,student_id)
    select p_id,id,display_name,student_id from candidates on conflict do nothing returning member_id
  ) select (select count(*) from candidates),array(select member_id from additions) into eligible,added;
  if eligible<>requested then raise exception 'Some selected members are no longer active. Refresh the list.'; end if;
  if cardinality(added)>0 then
    insert into public.assignment_audit_events(assignment_id,actor_id,action,details)
      values(p_id,auth.uid(),'add_recipients',jsonb_build_object('members',added));
  end if;
  return cardinality(added);
end $$;

create function public.hw_delete_draft(p_id uuid,p_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare a public.assignments;
begin
  if not public.is_admin() then raise exception 'Administrator required'; end if;
  select * into a from public.assignments where id=p_id for update;
  if not found then return; end if;
  if a.lifecycle<>'draft' or a.revision is distinct from p_revision then raise exception 'Only an unchanged, unpublished draft can be deleted.'; end if;
  delete from public.assignments where id=p_id;
  insert into public.audit_logs(actor_id,action,target_id,details) values(auth.uid(),'homework.delete_draft',p_id,jsonb_build_object('title',a.title));
end $$;

revoke all on function public.hw_add_recipients(uuid,uuid[]),public.hw_delete_draft(uuid,integer) from public,anon,authenticated;
grant execute on function public.hw_add_recipients(uuid,uuid[]),public.hw_delete_draft(uuid,integer) to authenticated;

