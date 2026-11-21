-- A corrected release points to the exact earlier release it replaces.
alter table public.assignment_review_events add column supersedes uuid references public.assignment_review_events(id);
with history as (
 select id,lag(id) over(partition by version_id order by created_at,id) previous
 from public.assignment_review_events where includes_grade
) update public.assignment_review_events e set supersedes=h.previous from history h where e.id=h.id and h.previous is not null;
create function homework_private.mark_correction() returns trigger language plpgsql set search_path='' as $$
begin
 if new.includes_grade then
 select id into new.supersedes from public.assignment_review_events where version_id=new.version_id and includes_grade order by created_at desc,id desc limit 1;
 end if;
 return new;
end $$;
create trigger homework_correction before insert on public.assignment_review_events for each row execute function homework_private.mark_correction();

-- A changed grading draft can be bulk-returned even after a previous release.
-- Compute readiness under the caller's permissions, including joint self-grading.
create or replace function public.hw_report_snapshot(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(rows)||jsonb_build_object('ready',g.version_id is not null and public.hw_grade_version(g.version_id)
 and (e.id is null or g.score is distinct from e.score or g.feedback is distinct from e.feedback))
 order by rows.student_id,rows.member_id),'[]'::jsonb)
 from generate_series(0,(select count(*)::integer/100 from public.assignment_recipients where assignment_id=p_id)) page
 cross join lateral (select * from public.hw_report(p_id,page) limit 100) rows
 left join public.assignment_reviews g on g.version_id=rows.version_id
 left join lateral (select x.id,x.score,x.feedback from public.assignment_review_events x where x.version_id=rows.version_id order by x.created_at desc,x.id desc limit 1)e on true
 where public.hw_staff(p_id)
$$;
