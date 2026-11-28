create table attendance_private.event_sessions (
  event_id uuid primary key references public.class_events(id),
  session_id uuid not null unique references attendance_private.sessions(id)
);
revoke all on attendance_private.event_sessions from public, anon, authenticated;

create function public.attendance_event(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  event public.class_events;
  linked attendance_private.sessions;
  manager boolean;
begin
  select * into event from public.class_events where id = p_event;
  if not found or not attendance_private.in_scope(event.group_id) then
    raise exception 'Event check-in unavailable.';
  end if;
  manager := attendance_private.manages(event.group_id);
  select s.* into linked from attendance_private.event_sessions l
  join attendance_private.sessions s on s.id = l.session_id
  where l.event_id = p_event;

  if linked.id is not null then
    if manager or least(linked.expires, linked.closed) > statement_timestamp()
      or exists (select from attendance_private.records
        where session_id = linked.id and student = auth.uid()) then
      return jsonb_build_object('session_id', linked.id);
    end if;
    return '{}'::jsonb;
  end if;
  if event.cancelled or not manager then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'setup', jsonb_build_object('title', event.title,
      'class_name', (select name from public.club_groups where id = event.group_id),
      'revision', event.revision,
      'students', (select count(*) from homework_private.students(event.group_id)))
  );
end
$$;

create function public.attendance_open_event(p_event uuid, p_id uuid, p_revision integer,
  p_minutes integer, p_expected integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  event public.class_events;
  session_id uuid;
  code text;
begin
  perform pg_advisory_xact_lock_shared(245619, 1);
  select * into event from public.class_events where id = p_event for update;
  if not found or not attendance_private.in_scope(event.group_id)
    or not attendance_private.manages(event.group_id) then
    raise exception 'Event check-in unavailable.';
  end if;
  select l.session_id into session_id from attendance_private.event_sessions l
  where l.event_id = p_event;
  if found then return jsonb_build_object('session_id', session_id); end if;
  if event.cancelled or p_revision is distinct from event.revision then
    raise exception 'Event changed. Refresh and try again.';
  end if;
  code := public.attendance_open(p_id, event.group_id, left(event.title, 120), p_minutes, p_expected);
  if code is null then raise exception 'Session unavailable'; end if;
  insert into attendance_private.event_sessions values (p_event, p_id);
  return jsonb_build_object('session_id', p_id, 'code', code);
end
$$;

revoke all on function public.attendance_event(uuid),
  public.attendance_open_event(uuid, uuid, integer, integer, integer) from public, anon;
grant execute on function public.attendance_event(uuid),
  public.attendance_open_event(uuid, uuid, integer, integer, integer) to authenticated;
