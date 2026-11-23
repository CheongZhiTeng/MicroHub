-- Keep all list reads under the caller's existing row policies.
create function public.daily_queue(p_id uuid) returns table(member_id uuid, version_id uuid)
language sql stable set search_path='' as $$
 select s.member_id,s.version_id from public.hw_recipient_status s where s.assignment_id=p_id
 and public.hw_staff(p_id) and s.latest>0 and not s.detached and not s.excused and s.revision_for is null
 and s.grading<>'Returned' and public.hw_grade_version(s.version_id) order by s.student_id,s.member_id
$$;
create function public.daily_list(p_staff boolean,p_scope text,p_filter text,p_search text,p_page integer)
returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(j || case when p_staff then jsonb_build_object('pending',(select count(*) from public.daily_queue((j->>'id')::uuid)))
 else jsonb_build_object('blocked',coalesce(s.blocked,case when (j->>'detached')::boolean then 'You have left this group.' end)) end order by ord),'[]')
 from jsonb_array_elements(public.class_homework_list(p_staff,p_filter,p_search,p_page,p_scope)) with ordinality rows(j,ord)
 left join public.hw_recipient_status s on s.assignment_id=(j->>'id')::uuid and s.member_id=auth.uid()
$$;
create function public.daily_due(p_scope text,p_after timestamptz,p_before timestamptz)
returns table(id uuid,title text,group_name text,due_at timestamptz) language sql stable set search_path='' as $$
 select a.id,a.title,a.group_name,s.effective_due_at from public.hw_recipient_status s join public.assignments a on a.id=s.assignment_id
 where public.is_member() and s.member_id=auth.uid() and not s.detached and not s.excused and a.lifecycle in ('published','closed')
 and s.effective_due_at>=p_after and s.effective_due_at<p_before and public.class_scope_matches(a.group_id,p_scope)
 order by s.effective_due_at,a.id
$$;
create function public.class_reach(p_group uuid) returns integer language plpgsql stable security definer set search_path='' as $$
begin
 if not public.announcement_can_publish(p_group) then raise exception 'Active teach access required'; end if;
 return (select count(*) from public.memberships m where public.group_eligible(m.user_id) and
 (p_group is null or exists(select from public.platform_roles r where r.user_id=m.user_id and r.role='super_admin')
 or exists(select from public.group_students s where s.group_id=p_group and s.user_id=m.user_id)
 or exists(select from public.club_groups g where g.id=p_group and g.teacher_id=m.user_id)));
end $$;
-- All three writes reuse their original permission, revision and audit checks.
create function public.daily_publish(p_id uuid,p_revision integer,p_expected integer) returns integer language plpgsql set search_path='' as $$
declare n integer;begin
 n:=public.hw_publish(p_id,p_revision);
 if n is distinct from p_expected then raise exception 'Audience changed. Check the count again.'; end if;return n;
end $$;
create function public.daily_announcement(p_id uuid,p_group uuid,p_title text,p_body text,p_expected integer) returns uuid language plpgsql set search_path='' as $$
begin
 if public.class_reach(p_group) is distinct from p_expected then raise exception 'Audience changed. Check the count again.';end if;
 return public.announcement_publish(p_id,p_group,p_title,p_body);
end $$;
create function public.daily_event(p_id uuid,p_group uuid,p_revision integer,p_title text,p_location text,p_description text,p_start timestamptz,p_end timestamptz,p_cancel boolean,p_expected integer) returns uuid language plpgsql set search_path='' as $$
begin
 if public.class_reach(p_group) is distinct from p_expected then raise exception 'Audience changed. Check the count again.';end if;
 return public.class_event_save(p_id,p_group,p_revision,p_title,p_location,p_description,p_start,p_end,p_cancel);
end $$;
do $$ declare f regprocedure;begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in
 ('daily_queue','daily_list','daily_due','class_reach','daily_publish','daily_announcement','daily_event') loop
 execute format('revoke all on function %s from public,anon',f);execute format('grant execute on function %s to authenticated',f);
 end loop;end $$;
