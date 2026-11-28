create index attendance_audit_session on attendance_private.audit(session_id,action,id desc);

-- Staff can review recent corrections. Neither correction notes nor code
-- generations are included in student responses.
create function public.attendance_panel(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare detail jsonb; changes jsonb;
begin
 detail:=public.attendance_detail(p_id);
 if not (detail->>'manager')::boolean then return detail; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc),'[]'::jsonb) into changes from (
  select a.id,a.at_time,a.reason,a.previous,a.replacement,r.name_en,r.name_zh,p.display_name as actor
  from attendance_private.audit a join attendance_private.records r on r.session_id=a.session_id and r.student=a.student
  join public.profiles p on p.id=a.actor where a.session_id=p_id and a.action='correct' order by a.id desc limit 20
 ) x;
 return detail || jsonb_build_object('corrections',changes,'generation',
  (select count(*) from attendance_private.audit where session_id=p_id and action='rotate'));
end$$;

create function public.attendance_rotate(p_id uuid,p_generation integer) returns text
language plpgsql security definer set search_path='' as $$
declare g uuid;
begin
 select group_id into g from attendance_private.sessions where id=p_id for update;
 if not found or not attendance_private.manages(g) then raise exception 'Teach access required'; end if;
 if p_generation is distinct from (select count(*) from attendance_private.audit where session_id=p_id and action='rotate')
 then raise exception 'Record changed. Refresh and try again.'; end if;
 return public.attendance_control(p_id,'rotate');
end$$;
revoke all on function public.attendance_panel(uuid),public.attendance_rotate(uuid,integer) from public,anon,authenticated;
grant execute on function public.attendance_panel(uuid),public.attendance_rotate(uuid,integer) to authenticated;
