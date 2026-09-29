create or replace function public.coach_confirm_calendar_dev(p_owner uuid,p_action uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.assistant_actions; d public.coach_calendar_dispatch; receipt jsonb;
begin
 select * into a from public.assistant_actions where id=p_action and owner_id=p_owner for update;
 if not found or a.action_type<>'create_calendar_event_dev' then raise exception 'Calendar approval not found' using errcode='P0002';end if;
 select * into d from public.coach_calendar_dispatch where action_id=a.id and owner_id=p_owner for update;
 if not found then raise exception 'Calendar dispatch not found' using errcode='P0002';end if;
 if d.state='created' then return jsonb_build_object('status','completed','reply','Calendar event already confirmed.','idempotent_replay',true);end if;
 if a.status<>'approved' or d.state<>'outcome_unknown' or d.attempts<>1 or d.provider_result->>'outcome' is distinct from 'submitted_to_device' then raise exception 'Only a submitted calendar event can be confirmed' using errcode='22023';end if;
 receipt=jsonb_build_object('outcome','confirmed_by_user','confirmation_source','user','confirmed_at',now());
 update public.coach_calendar_dispatch set state='created',provider_result=provider_result||receipt where action_id=a.id;
 update public.assistant_actions set execution_status='succeeded',error_message=null,result=coalesce(result,'{}'::jsonb)||receipt where id=a.id;
 update public.assistant_requests set status='completed',reply='You confirmed the event appeared in Family Calendar.',error_message=null,completed_at=now() where id=a.request_id;
 insert into public.assistant_action_events(action_id,owner_id,event_type,details) values(a.id,p_owner,'calendar_confirmed_by_user',receipt);
 return jsonb_build_object('status','completed','reply','Confirmed in Family Calendar. No new event was sent.','idempotent_replay',false);
end $$;
revoke all on function public.coach_confirm_calendar_dev(uuid,uuid) from public,anon,authenticated;
grant execute on function public.coach_confirm_calendar_dev(uuid,uuid) to service_role;
