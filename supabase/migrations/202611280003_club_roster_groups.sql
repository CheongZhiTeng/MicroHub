-- A teach leads a group through club_groups; students belong through group_students.
-- Keep the student assignment separate so office changes never remove the teach from their own group.
create or replace view club_private.roster as
 select p.id,p.student_id,p.name_en,p.name_zh,p.display_name,p.status::text as account,
 m.status::text as membership,m.committee_position_id as position_id,
 coalesce(r.office,case when r.role='super_admin' then 'teach' else r.role::text end) as identity,
 s.group_id,coalesce(led.name,g.name) as group_name,
 md5(row(m.updated_at,r.updated_at,p.updated_at,r.office,s.group_id,s.leader,led.id,m.committee_position_id)::text) as version,
 coalesce(led.id,s.group_id) as roster_group_id
 from public.memberships m join public.profiles p on p.id=m.user_id join public.platform_roles r on r.user_id=p.id
 left join public.group_students s on s.user_id=p.id left join public.club_groups g on g.id=s.group_id
 left join lateral (select cg.id,cg.name from public.club_groups cg where cg.teacher_id=p.id
   and cg.state<>'archived' order by cg.id limit 1) led on true;

alter function public.club_admin_panel(text,text,text,text,integer) set schema club_private;
revoke all on function club_private.club_admin_panel(text,text,text,text,integer) from public,anon,authenticated;
create function public.club_admin_panel(p_tab text,p_search text default '',p_filter text default '',p_group text default '',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'Full administrator required.'; end if;
 if p_tab='groups' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id)
    from public.club_groups where state<>'archived'),'[]'::jsonb);
 end if;
 if p_tab='members' then
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.student_id) from
   (select * from club_private.roster r where (p_filter='' or p_filter in (identity,membership,account)
    or (p_filter='eligible' and membership='active' and account='active'))
    and (p_group='' or roster_group_id::text=p_group)
    and strpos(lower(concat_ws(' ',name_en,name_zh,display_name,student_id)),lower(p_search))>0
    order by student_id limit 21 offset greatest(0,p_page)::bigint*20) x),'[]'::jsonb);
 end if;
 return club_private.club_admin_panel(p_tab,p_search,p_filter,p_group,p_page);
end $$;
revoke all on function public.club_admin_panel(text,text,text,text,integer) from public,anon;
grant execute on function public.club_admin_panel(text,text,text,text,integer) to authenticated;
