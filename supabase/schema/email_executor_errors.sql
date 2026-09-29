begin;
-- A provider error does not by itself prove that no message was sent.
-- Never reopen the dispatch queue automatically.
create function public.coach_email_error_dev(p_action uuid,p_claim uuid,p_error text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.assistant_actions; d public.coach_email_dispatch; msg text;
begin
 select * into a from public.assistant_actions where id=p_action for update;
 select * into d from public.coach_email_dispatch where action_id=p_action for update;
 if not found or p_claim is null or p_claim is distinct from d.claim_id then raise exception 'Invalid claim' using errcode='22023';end if;
 if d.state='sent' then return jsonb_build_object('saved',true,'already_sent',true);end if;
 if d.state<>'outcome_unknown' then raise exception 'Invalid dispatch state';end if;
 msg='Email provider error: '||left(coalesce(nullif(p_error,''),'No result returned'),1000)||'. Delivery is not confirmed. Check Sent mail before considering a new proposal; this attempt will not retry automatically.';
 update public.coach_email_dispatch set provider_result=jsonb_build_object('error',left(p_error,1000),'outcome','unknown') where action_id=a.id;
 update public.assistant_actions set error_message=msg where id=a.id;
 update public.assistant_requests set status='failed',reply=msg,error_message=msg,completed_at=now() where id=a.request_id;
 insert into public.assistant_action_events(action_id,owner_id,event_type,details) values(a.id,a.owner_id,'email_provider_error',jsonb_build_object('error',left(p_error,1000),'outcome','unknown')) on conflict(action_id,event_type) do nothing;
 return jsonb_build_object('saved',true,'outcome','unknown');
end $$;
revoke all on function public.coach_email_error_dev(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.coach_email_error_dev(uuid,uuid,text) to service_role;
commit;
