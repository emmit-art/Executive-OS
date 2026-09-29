begin;

create table public.coach_calendar_dispatch (
 action_id uuid primary key references public.assistant_actions(id),
 owner_id uuid not null references auth.users(id),
 payload jsonb not null,
 state text not null default 'awaiting_approval' check(state in ('awaiting_approval','queued','outcome_unknown','created','failed','declined','expired')),
 claim_id uuid,
 attempts int not null default 0 check(attempts between 0 and 1),
 provider_event_id text,
 provider_result jsonb,
 claimed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.coach_calendar_dispatch enable row level security;
revoke all on public.coach_calendar_dispatch from public,anon,authenticated;
grant select(action_id,owner_id,payload,state,attempts,provider_event_id,provider_result,claimed_at,created_at) on public.coach_calendar_dispatch to authenticated;
grant all on public.coach_calendar_dispatch to service_role;
create policy coach_calendar_read_own on public.coach_calendar_dispatch for select to authenticated using((select auth.uid())=owner_id);
create index coach_calendar_dispatch_queue on public.coach_calendar_dispatch(created_at) where state='queued';

create or replace function public.coach_prepare_request_calendar_dev(p_owner uuid,p_request uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; a uuid;
begin
 if p_owner is distinct from '2192567a-41fd-435e-ad66-75bdc5101f28'::uuid then raise exception 'Development calendar is not configured for this user' using errcode='42501';end if;
 if p_payload->>'calendar_account' is distinct from 'personal_icloud_family' or coalesce(length(trim(p_payload->>'title')),0)=0 or length(p_payload->>'title')>300 or p_payload->>'timezone' is distinct from 'America/New_York' or jsonb_typeof(p_payload->'all_day') is distinct from 'boolean' or p_payload->>'start_at' is null or p_payload->>'end_at' is null then raise exception 'Invalid development calendar payload' using errcode='22023';end if;
 if p_payload->'all_day' is distinct from 'false'::jsonb or coalesce(p_payload->>'notes','')<>'' then raise exception 'Development calendar supports timed events without notes only' using errcode='22023';end if;
 if p_payload->>'start_at' !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$' or p_payload->>'end_at' !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Calendar dates must include timezone offsets' using errcode='22023';end if;
 if (p_payload->>'end_at')::timestamptz <= (p_payload->>'start_at')::timestamptz then raise exception 'Calendar event end must be after start' using errcode='22023';end if;
 result=public.coach_finalize_request(p_owner,p_request,'awaiting_approval','Review the exact calendar event below. It will only be created after approval.','create_calendar_event_dev',jsonb_build_object('calendar',p_payload),'[]');
 a=(result->'approval'->>'id')::uuid;
 insert into public.coach_calendar_dispatch(action_id,owner_id,payload) values(a,p_owner,p_payload);
 return result;
exception when invalid_datetime_format or datetime_field_overflow then raise exception 'Invalid calendar date or time' using errcode='22023';
end $$;
revoke all on function public.coach_prepare_request_calendar_dev(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.coach_prepare_request_calendar_dev(uuid,uuid,jsonb) to service_role;

create function public.coach_decide_calendar_action_dev(p_owner uuid,p_action uuid,p_hash text,p_decision text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.assistant_actions; d public.coach_calendar_dispatch; v_reply text; result jsonb; replay boolean;
begin
 select * into a from public.assistant_actions where id=p_action and owner_id=p_owner for update;
 if not found then raise exception 'Approval not found' using errcode='P0002';end if;
 if p_hash is distinct from a.proposal_hash or p_decision is null or p_decision not in ('approve','decline') then raise exception 'Invalid decision or snapshot' using errcode='22023';end if;
 select * into d from public.coach_calendar_dispatch where action_id=a.id and owner_id=p_owner for update;
 if not found then raise exception 'Calendar dispatch missing';end if;
 replay=a.status<>'pending';
 if not replay and a.expires_at<=now() then
  update public.assistant_actions set status='expired',decided_at=now(),error_message='Approval expired. Request a new proposal.' where id=a.id returning * into a;
  update public.coach_calendar_dispatch set state='expired' where action_id=a.id;
  insert into public.assistant_action_events(action_id,owner_id,event_type) values(a.id,p_owner,'expired');
 elsif not replay and p_decision='decline' then
  update public.assistant_actions set status='declined',decided_at=now() where id=a.id returning * into a;
  update public.coach_calendar_dispatch set state='declined' where action_id=a.id;
  insert into public.assistant_action_events(action_id,owner_id,event_type) values(a.id,p_owner,'declined');
 elsif not replay then
  if a.proposed_changes->'calendar' is distinct from d.payload then raise exception 'Snapshot mismatch';end if;
  update public.assistant_actions set status='approved',execution_status='queued',decided_at=now() where id=a.id returning * into a;
  update public.coach_calendar_dispatch set state='queued' where action_id=a.id;
  insert into public.assistant_action_events(action_id,owner_id,event_type) values(a.id,p_owner,'approved'),(a.id,p_owner,'calendar_queued');
 end if;
 v_reply=case when a.status='expired' then 'Approval expired. Nothing was created. Request a new proposal.' when a.status='declined' then 'Declined. Nothing was created.' when a.execution_status='queued' then 'Approved and queued for the personal Family Calendar. Run the calendar executor once, then refresh approvals.' when a.execution_status='succeeded' then 'Calendar event created.' when a.execution_status='outcome_unknown' then 'Calendar creation was attempted; verify the iPhone calendar before retrying.' else coalesce(a.error_message,'Calendar action is not executable.') end;
 update public.assistant_requests set status=case when a.execution_status='queued' then 'processing' when a.status in ('declined','expired') or a.execution_status='succeeded' then 'completed' else 'failed' end,reply=v_reply,requires_approval=false,error_message=case when a.execution_status in ('queued','succeeded') or a.status in ('declined','expired') then null else v_reply end,completed_at=case when a.execution_status<>'queued' then now() else null end where id=a.request_id;
 return jsonb_build_object('status',case when a.execution_status='queued' then 'processing' when a.status in ('declined','expired') or a.execution_status='succeeded' then 'completed' else 'failed' end,'reply',v_reply,'approval',to_jsonb(a),'requires_approval',false,'request_id',a.request_id,'thread_id',a.thread_id,'idempotent_replay',replay);
end $$;
revoke all on function public.coach_decide_calendar_action_dev(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.coach_decide_calendar_action_dev(uuid,uuid,text,text) to service_role;

create function public.coach_claim_calendar_dev() returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.assistant_actions; d public.coach_calendar_dispatch; c uuid;
begin
 select aa.* into a from public.assistant_actions aa join public.coach_calendar_dispatch dd on dd.action_id=aa.id where dd.state='queued' and dd.owner_id='2192567a-41fd-435e-ad66-75bdc5101f28'::uuid order by dd.created_at for update of aa skip locked limit 1;
 if not found then return jsonb_build_object('claimed',false);end if;
 select * into d from public.coach_calendar_dispatch where action_id=a.id for update;
 if a.status<>'approved' or a.execution_status<>'queued' or d.attempts<>0 or a.expires_at<=now() or d.payload is distinct from a.proposed_changes->'calendar' then
  update public.coach_calendar_dispatch set state='expired' where action_id=a.id;
  update public.assistant_actions set execution_status='failed',error_message='Queued calendar event expired or failed validation; no event created.' where id=a.id;
  update public.assistant_requests set status='failed',reply='Queued calendar event expired or failed validation; no event created.',error_message='Calendar event not created.',completed_at=now() where id=a.request_id;
  insert into public.assistant_action_events(action_id,owner_id,event_type) values(a.id,a.owner_id,'calendar_rejected_before_create');
  return jsonb_build_object('claimed',false);
 end if;
 c=gen_random_uuid();
 update public.coach_calendar_dispatch set state='outcome_unknown',claim_id=c,attempts=1,claimed_at=now() where action_id=a.id;
 update public.assistant_actions set execution_status='outcome_unknown',execution_attempts=1,error_message='Calendar creation attempted; provider result is not confirmed. Verify the iPhone calendar before retrying.' where id=a.id;
 update public.assistant_requests set status='processing',reply='Calendar creation attempted; provider result is not confirmed.',error_message='Awaiting calendar provider result.' where id=a.request_id;
 insert into public.assistant_action_events(action_id,owner_id,event_type) values(a.id,a.owner_id,'calendar_create_claimed');
 return jsonb_build_object('claimed',true,'action_id',a.id,'claim_id',c,'payload',d.payload,'idempotency_key',a.id);
end $$;
revoke all on function public.coach_claim_calendar_dev() from public,anon,authenticated;
grant execute on function public.coach_claim_calendar_dev() to service_role;

create or replace function public.coach_finish_calendar_dev(p_action uuid,p_claim uuid,p_event_id text,p_result jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.assistant_actions; d public.coach_calendar_dispatch;
begin
 select * into a from public.assistant_actions where id=p_action for update;
 select * into d from public.coach_calendar_dispatch where action_id=p_action for update;
 if not found or p_claim is null or p_claim is distinct from d.claim_id then raise exception 'Invalid claim' using errcode='22023';end if;
 if d.state='created' then return jsonb_build_object('saved',true,'idempotent_replay',true);end if;
 if d.state<>'outcome_unknown' then raise exception 'Invalid dispatch state';end if;
 if p_result->>'outcome' = 'submitted_to_device' then
  if d.provider_result->>'outcome' = 'submitted_to_device' then return jsonb_build_object('saved',true,'outcome','submitted_to_device','idempotent_replay',true); end if;
  update public.coach_calendar_dispatch set provider_result=p_result || jsonb_build_object('submitted_at',now()) where action_id=a.id;
  update public.assistant_actions set result=jsonb_build_object('provider','apple_ios','outcome','submitted_to_device','submitted_at',now(),'provider_result',p_result),error_message='Submitted to the iPhone. Calendar creation is not yet confirmed. Sync Make on the phone and check Family Calendar before considering any retry.' where id=a.id;
  update public.assistant_requests set status='processing',reply='Submitted to the iPhone; awaiting confirmation in Family Calendar.',error_message=null where id=a.request_id;
  insert into public.assistant_action_events(action_id,owner_id,event_type,details) values(a.id,a.owner_id,'calendar_submitted_to_device',p_result) on conflict(action_id,event_type) do nothing;
  return jsonb_build_object('saved',true,'outcome','submitted_to_device','idempotent_replay',false);
 end if;
 if coalesce(trim(p_event_id),'')='' then raise exception 'Confirmed event ID is required; use submitted_to_device for an unconfirmed submission' using errcode='22023'; end if;

 update public.coach_calendar_dispatch set state='created',provider_event_id=nullif(p_event_id,''),provider_result=p_result where action_id=a.id;
 update public.assistant_actions set execution_status='succeeded',error_message=null,result=jsonb_build_object('provider','apple_ios','event_id',nullif(p_event_id,''),'created_at',now(),'provider_result',p_result) where id=a.id;
 update public.assistant_requests set status='completed',reply='Calendar event created.',error_message=null,completed_at=now() where id=a.request_id;
 insert into public.assistant_action_events(action_id,owner_id,event_type,details) values(a.id,a.owner_id,'calendar_created',jsonb_build_object('event_id',p_event_id,'created_at',now()));
 return jsonb_build_object('saved',true,'idempotent_replay',false);
end $$;
revoke all on function public.coach_finish_calendar_dev(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.coach_finish_calendar_dev(uuid,uuid,text,jsonb) to service_role;

create function public.coach_calendar_error_dev(p_action uuid,p_claim uuid,p_error text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.assistant_actions; d public.coach_calendar_dispatch; msg text;
begin
 select * into a from public.assistant_actions where id=p_action for update;
 select * into d from public.coach_calendar_dispatch where action_id=p_action for update;
 if not found or p_claim is null or p_claim is distinct from d.claim_id then raise exception 'Invalid claim' using errcode='22023';end if;
 if d.state='created' then return jsonb_build_object('saved',true,'already_created',true);end if;
 if d.state<>'outcome_unknown' then raise exception 'Invalid dispatch state';end if;
 msg='Calendar provider error: '||left(coalesce(nullif(p_error,''),'No result returned'),1000)||'. Creation is not confirmed; verify the iPhone calendar before a deliberate retry.';
 update public.coach_calendar_dispatch set state='failed',provider_result=jsonb_build_object('error',left(coalesce(p_error,''),1000),'outcome','unknown') where action_id=a.id;
 update public.assistant_actions set execution_status='failed',error_message=msg where id=a.id;
 update public.assistant_requests set status='failed',reply=msg,error_message=msg,completed_at=now() where id=a.request_id;
 insert into public.assistant_action_events(action_id,owner_id,event_type,details) values(a.id,a.owner_id,'calendar_provider_error',jsonb_build_object('error',left(coalesce(p_error,''),1000),'outcome','unknown')) on conflict(action_id,event_type) do nothing;
 return jsonb_build_object('saved',true,'outcome','unknown');
end $$;
revoke all on function public.coach_calendar_error_dev(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.coach_calendar_error_dev(uuid,uuid,text) to service_role;
commit;
