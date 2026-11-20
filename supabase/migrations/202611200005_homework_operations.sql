create table public.homework_schedules(
 assignment_id uuid primary key references public.assignments on delete cascade, run_at timestamptz not null,
 publisher uuid not null references public.profiles, revision integer not null, failure text
);
alter table public.homework_schedules enable row level security;
revoke all on public.homework_schedules from public,anon,authenticated;
grant select on public.homework_schedules to authenticated;
create policy schedule_staff on public.homework_schedules for select to authenticated using(public.hw_staff(assignment_id));
create function public.hw_schedule(p_id uuid,p_revision integer,p_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare a public.assignments;
begin
 if not public.hw_staff(p_id) then raise exception 'Administrator required'; end if;
 select * into strict a from public.assignments where id=p_id for update;
 if a.lifecycle<>'draft' or a.revision is distinct from p_revision then raise exception 'Assignment changed. Preview again.'; end if;
 if p_at is not null and (not isfinite(p_at) or p_at<=now() or p_at>=a.due_at) then raise exception 'Choose a future time before the deadline.'; end if;
 update public.assignments set revision=revision+1 where id=p_id;
 delete from public.homework_schedules where assignment_id=p_id;
 if p_at is not null then insert into public.homework_schedules values(p_id,p_at,auth.uid(),p_revision+1,null); end if;
end $$;
-- The scheduler uses the original publisher's current group and membership rights.
create function homework_private.publish_due() returns void language plpgsql security definer set search_path='' as $$
declare job public.homework_schedules; previous text:=current_setting('request.jwt.claim.sub',true);
begin
 for job in select * from public.homework_schedules where run_at<=now() and failure is null order by run_at limit 100 for update skip locked loop
 begin
 perform set_config('request.jwt.claim.sub',job.publisher::text,true);
 perform public.hw_publish(job.assignment_id,job.revision);
 delete from public.homework_schedules where assignment_id=job.assignment_id;
 exception when others then update public.homework_schedules set failure=sqlerrm where assignment_id=job.assignment_id;
 end;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(previous,''),true);
end $$;
revoke all on function homework_private.publish_due() from public,anon,authenticated;
do $$ begin
 if exists(select from pg_available_extensions where name='pg_cron') then
   create extension if not exists pg_cron;
   perform cron.schedule('microhub-homework-publish','* * * * *','select homework_private.publish_due()');
 end if;
end $$;

create table public.homework_comments(
 id uuid primary key,assignment_id uuid not null references public.assignments on delete cascade,
 author uuid not null references public.profiles,author_name text not null,body text not null check(length(trim(body)) between 1 and 3000),
 created_at timestamptz not null default clock_timestamp()
);
create index homework_discussion_order on public.homework_comments(assignment_id,created_at desc,id);
alter table public.homework_comments enable row level security;
revoke all on public.homework_comments from public,anon,authenticated;
grant select on public.homework_comments to authenticated;
create function public.hw_discussion_access(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.assignments a where a.id=p_id and a.lifecycle<>'draft' and
 (public.hw_staff(p_id) or (public.is_member() and exists(select from public.assignment_recipients r where r.assignment_id=p_id and r.member_id=auth.uid() and not r.detached))))
$$;
create policy discussion_read on public.homework_comments for select to authenticated using(public.hw_discussion_access(assignment_id));
create function public.hw_comments(p_id uuid,p_page integer) returns setof public.homework_comments language sql stable set search_path='' as $$
 select * from public.homework_comments where assignment_id=p_id order by created_at desc,id limit 21 offset (20*greatest(0,p_page)::bigint)
$$;
create function public.hw_comment(p_id uuid,p_request uuid,p_text text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.hw_discussion_access(p_id) or not exists(select from public.assignments where id=p_id and lifecycle in ('published','closed')) then raise exception 'Discussion unavailable'; end if;
 insert into public.homework_comments(id,assignment_id,author,author_name,body) select p_request,p_id,p.id,coalesce(nullif(p.display_name,''),p.student_id),trim(p_text)
 from public.profiles p where p.id=auth.uid() on conflict(id) do nothing;
end $$;
create table public.homework_preferences(
 user_id uuid primary key references public.profiles,due boolean not null default true,feedback boolean not null default true,grading boolean not null default true
);
alter table public.homework_preferences enable row level security;
revoke all on public.homework_preferences from public,anon,authenticated;
grant select on public.homework_preferences to authenticated;
create policy own_preferences on public.homework_preferences for select to authenticated using(public.is_member() and user_id=auth.uid());
create function public.hw_preferences(p_due boolean,p_feedback boolean,p_grading boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_member() then raise exception 'Active membership required'; end if;
 insert into public.homework_preferences values(auth.uid(),p_due,p_feedback,p_grading)
 on conflict(user_id) do update set due=excluded.due,feedback=excluded.feedback,grading=excluded.grading;
end $$;
create function public.hw_inbox(p_page integer) returns jsonb language sql stable set search_path='' as $$
 with prefs as (select coalesce((select due from public.homework_preferences),true) due,
 coalesce((select feedback from public.homework_preferences),true) feedback,coalesce((select grading from public.homework_preferences),true) grading),
 items as (
 select a.id,a.title,case when s.effective_due_at<now() then 'Overdue' else 'Due soon' end kind,s.effective_due_at at_time,'mine' as mode
 from public.hw_recipient_status s join public.assignments a on a.id=s.assignment_id,prefs
 where prefs.due and s.member_id=auth.uid() and not s.detached and not s.excused and (s.latest=0 or s.revision_for is not null)
 and a.lifecycle in ('published','closed') and s.effective_due_at<=now()+interval '1 day' and (a.lifecycle='published' or s.blocked is null)
 union all select a.id,a.title,case when e.kind='release' then 'Feedback returned' else 'Revision requested' end,e.created_at,'mine'
 from public.assignment_review_events e join public.submission_versions v on v.id=e.version_id join public.assignments a on a.id=v.assignment_id,prefs
 where prefs.feedback and v.member_id=auth.uid()
 union all select a.id,a.title,'Awaiting review',max(v.submitted_at),'manage'
 from public.hw_recipient_status s join public.assignments a on a.id=s.assignment_id join public.submission_versions v on v.id=s.version_id,prefs
 where prefs.grading and public.hw_grade(a.id,s.member_id) and s.grading<>'Returned' and not s.excused and s.revision_for is null group by a.id,a.title
 ) select jsonb_build_object('preferences',(select to_jsonb(prefs) from prefs),'items',(select coalesce(jsonb_agg(to_jsonb(page)),'[]') from
 (select * from items order by at_time desc,id,kind limit 21 offset (20*greatest(0,p_page)::bigint)) page))
$$;
create table public.homework_grading_tools(id uuid primary key,owner_id uuid not null references public.profiles,kind text not null check(kind in ('rubric','comment')),
 title text not null check(length(trim(title)) between 1 and 100),content text not null check(length(trim(content)) between 1 and 3000));
alter table public.homework_grading_tools enable row level security;
revoke all on public.homework_grading_tools from public,anon,authenticated;
grant select,insert,delete on public.homework_grading_tools to authenticated;
create policy grader_tools on public.homework_grading_tools to authenticated using (owner_id=auth.uid() and (public.is_admin() or exists(select from public.hw_scopes())))
 with check(owner_id=auth.uid() and (public.is_admin() or exists(select from public.hw_scopes())));
create function public.hw_tools() returns setof public.homework_grading_tools language sql stable set search_path='' as $$
select * from public.homework_grading_tools order by title,id
$$;
create function public.hw_report(p_id uuid,p_page integer) returns table(member_id uuid,student_id text,member_name text,submission text,grading text,late boolean,
 version_id uuid,version integer,review_revision integer,released_score numeric,effective_due_at timestamptz,submitted_at timestamptz)
 language sql stable set search_path='' as $$
 select s.member_id,s.student_id,s.member_name,s.submission,s.grading,s.late,s.version_id,s.latest,g.revision,e.score,s.effective_due_at,v.submitted_at from public.hw_recipient_status s
 left join public.submission_versions v on v.id=s.version_id left join public.assignment_reviews g on g.version_id=v.id
 left join lateral (select x.score from public.assignment_review_events x where x.version_id=s.version_id and x.includes_grade order by x.created_at desc,x.id desc limit 1)e on true
 where public.hw_staff(p_id) and s.assignment_id=p_id order by s.student_id,s.member_id limit 101 offset 100*greatest(p_page,0)::bigint
$$;
create function public.hw_release_saved(p_id uuid,p_version uuid,p_revision integer,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare g public.assignment_reviews;
begin
 if not exists(select from public.submission_versions v where v.id=p_version and v.assignment_id=p_id and public.hw_grade(v.assignment_id,v.member_id)) then raise exception 'Administrator required'; end if;
 select * into strict g from public.assignment_reviews where version_id=p_version;
 perform public.hw_review(p_version,p_revision,'release',g.score,g.feedback,true,null,p_request);
end $$;
do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in
 ('hw_schedule','hw_discussion_access','hw_comments','hw_comment','hw_preferences','hw_inbox','hw_tools','hw_report','hw_release_saved') loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to authenticated',f);
 end loop;
end $$;
create function public.hw_schedule_info(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select to_jsonb(s) from public.homework_schedules s where assignment_id=p_id
$$;
revoke all on function public.hw_schedule_info(uuid) from public,anon,authenticated;
grant execute on function public.hw_schedule_info(uuid) to authenticated;
