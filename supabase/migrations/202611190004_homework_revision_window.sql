-- Validate the proposed personal window in the same transaction as the
-- feedback event, using the same clock and policy as a student's submission.
create function homework_private.check_revision_window() returns trigger
language plpgsql set search_path='' as $$
declare blocked text;
begin
  select homework_private.submission_block(a.lifecycle,r.excused,v.version,v.version,
    new.revision_due_at,coalesce(r.extension_at,a.due_at),a.allow_late,clock_timestamp())
    into strict blocked from public.submission_versions v
    join public.assignment_recipients r using (assignment_id,member_id)
    join public.assignments a on a.id=v.assignment_id where v.id=new.version_id;
  if blocked is not null then
    if blocked in ('This assignment is closed.','The deadline has passed and late submissions are closed.') then
      raise exception 'Choose a future personal deadline to reopen submissions for this member.';
    end if;
    raise exception '%',blocked;
  end if;
  return new;
end $$;
revoke all on function homework_private.check_revision_window() from public,anon,authenticated;
create trigger validate_revision_window before insert on public.assignment_review_events
for each row when (new.kind='revision') execute function homework_private.check_revision_window();

