-- Apply sort and filters before paging. The original four-argument API
-- remains available to clients during rollout.
create function public.hw_roster(p_id uuid,p_filter text,p_search text,p_page integer,p_sort text)
returns setof public.hw_recipient_status language sql stable set search_path='' as $$
  select s.* from public.hw_recipient_status s
  left join public.submission_versions v on v.id=s.version_id
  where public.is_admin() and s.assignment_id=p_id
    and (strpos(lower(s.member_name),lower(p_search))>0 or strpos(s.student_id,p_search)>0)
    and case p_filter when 'all' then true when 'late' then s.late
      when 'pending' then s.latest>0 and s.grading<>'Returned' and s.revision_for is null and not s.excused
      else p_filter in (s.submission,s.grading,s.modification) end
  order by case when p_sort='recent' then v.submitted_at end desc nulls last,
    case when p_sort='name' then lower(s.member_name) end,s.student_id,s.member_id
  limit 21 offset (20 * greatest(p_page,0)::bigint);
$$;
revoke all on function public.hw_roster(uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.hw_roster(uuid,text,text,integer,text) to authenticated;

create or replace function public.hw_roster(p_id uuid,p_filter text,p_search text,p_page integer)
returns setof public.hw_recipient_status language sql stable set search_path='' as $$
  select * from public.hw_roster(p_id,p_filter,p_search,p_page,'student');
$$;

