-- Consent applies to one saved revision. Existing reviews start private.
alter table public.assignment_reviews add column bulk_revision integer;

create function public.hw_mark_bulk_ready(p_version uuid,p_revision integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.hw_grade_version(p_version) then raise exception 'Administrator required'; end if;
  update public.assignment_reviews g set bulk_revision=g.revision
  from public.submission_versions v join public.assignments a on a.id=v.assignment_id
  where g.version_id=p_version and v.id=g.version_id and g.revision=p_revision
    and (a.max_points is null or g.score is not null);
  if not found then raise exception 'Save a complete current grading draft first.'; end if;
end $$;
revoke all on function public.hw_mark_bulk_ready(uuid,integer) from public,anon;
grant execute on function public.hw_mark_bulk_ready(uuid,integer) to authenticated;

create or replace function public.hw_report_snapshot(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(rows)||jsonb_build_object('bulk_approved',coalesce(g.bulk_revision=g.revision,false),
 'ready',coalesce(g.bulk_revision=g.revision,false)) order by rows.student_id,rows.member_id),'[]'::jsonb)
 from generate_series(0,(select count(*)::integer/100 from public.assignment_recipients where assignment_id=p_id)) page
 cross join lateral (select * from public.hw_report(p_id,page) limit 100) rows
 left join public.assignment_reviews g on g.version_id=rows.version_id
 where public.hw_staff(p_id)
$$;

create or replace function public.hw_release_saved(p_id uuid,p_version uuid,p_revision integer,p_request uuid)
returns void language plpgsql security definer set search_path='' as $$
declare g public.assignment_reviews;
begin
 if not public.hw_grade_version(p_version) or not exists(select from public.submission_versions where id=p_version and assignment_id=p_id)
 then raise exception 'Administrator required'; end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(245619,1);
 perform 1 from public.assignment_recipients r join public.submission_versions v on v.member_id=r.member_id and v.assignment_id=r.assignment_id where v.id=p_version for update of r;
 if exists(select from public.assignment_review_events where version_id=p_version and request_id=p_request and kind='release') then return; end if;
 select * into strict g from public.assignment_reviews where version_id=p_version;
 if g.revision is distinct from p_revision or g.bulk_revision is distinct from g.revision then raise exception 'Review conflict. Mark this saved grade for bulk return.'; end if;
 perform public.hw_review(p_version,p_revision,'release',g.score,g.feedback,true,null,p_request);
end $$;
