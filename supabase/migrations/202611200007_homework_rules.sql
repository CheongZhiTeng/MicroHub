alter table public.assignments drop constraint assignments_check,add check(allow_text or allow_link or file_limit>0);
create function public.hw_media_only(p_id uuid,p_revision integer,p_only boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.hw_staff(p_id) then raise exception 'Administrator required'; end if;
 update public.assignments set allow_text=not p_only,allow_link=not p_only,revision=revision+1
 where id=p_id and lifecycle='draft' and revision=p_revision and (not p_only or file_limit>0);
 if not found then raise exception 'Enable files first and refresh the draft.'; end if;
end $$;
create function public.hw_copy_assignment(p_source uuid,p_id uuid,p_group uuid,p_title text,p_instructions text,
 p_due timestamptz,p_points numeric,p_text boolean,p_link boolean,p_late boolean,p_audience text,p_targets uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare a public.assignments;
begin
 if not public.hw_staff(p_source) then raise exception 'Administrator required'; end if;
 select * into strict a from public.assignments where id=p_source;
 perform public.hw_save_scoped(p_id,0,p_title,p_instructions,p_due,p_points,true,p_link,p_late,p_audience,p_targets,p_group);
 update public.assignments set file_limit=a.file_limit,file_bytes=a.file_bytes,file_mode=a.file_mode,
 joint=a.joint and p_group is not null,allow_text=p_text,allow_link=p_link where id=p_id;
 return 1;
end $$;
revoke all on function public.hw_media_only(uuid,integer,boolean),public.hw_copy_assignment(uuid,uuid,uuid,text,text,timestamptz,numeric,boolean,boolean,boolean,text,uuid[]) from public,anon,authenticated;
grant execute on function public.hw_media_only(uuid,integer,boolean),public.hw_copy_assignment(uuid,uuid,uuid,text,text,timestamptz,numeric,boolean,boolean,boolean,text,uuid[]) to authenticated;
