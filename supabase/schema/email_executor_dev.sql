begin;
alter table public.assistant_actions drop constraint assistant_actions_execution_status_check;
alter table public.assistant_actions add constraint assistant_actions_execution_status_check check(execution_status in ('not_started','succeeded','failed','blocked','queued','outcome_unknown'));
create table public.coach_email_dispatch (
 action_id uuid primary key references public.assistant_actions(id),
 owner_id uuid not null references auth.users(id),
 payload jsonb not null,
 mime_raw text not null,
 state text not null default 'awaiting_approval' check(state in ('awaiting_approval','queued','outcome_unknown','sent','failed','declined','expired')),
 claim_id uuid,
 attempts int not null default 0 check(attempts between 0 and 1),
 provider_message_id text,
 provider_result jsonb,
 claimed_at timestamptz,
 sent_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.coach_email_dispatch enable row level security;
revoke all on public.coach_email_dispatch from public,anon,authenticated;
grant select(action_id,owner_id,payload,state,attempts,provider_message_id,provider_result,claimed_at,sent_at,created_at) on public.coach_email_dispatch to authenticated;
grant all on public.coach_email_dispatch to service_role;
create policy coach_email_read_own on public.coach_email_dispatch for select to authenticated using((select auth.uid())=owner_id);
create index coach_email_dispatch_queue on public.coach_email_dispatch(created_at) where state='queued';

create function public.coach_prepare_email(p_owner uuid,p_thread text,p_payload jsonb,p_raw text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r uuid; result jsonb; a uuid;
begin
 if p_owner is distinct from '2192567a-41fd-435e-ad66-75bdc5101f28'::uuid then raise exception 'Development sender is not configured for this user' using errcode='42501';end if;
 if p_payload->>'from' is distinct from 'emmit.atkins@gmail.com' or p_payload->>'to' is distinct from 'emmit.atkins@gmail.com' or p_payload->>'sender_account' is distinct from 'personal_gmail_dev' or jsonb_typeof(p_payload->'attachments') is distinct from 'array' or p_raw is null or length(p_raw)>2000000 then raise exception 'Invalid development email payload' using errcode='22023';end if;
 insert into public.assistant_requests(owner_id,thread_id,message,status,source) values(p_owner,p_thread,'Personal development email proposal','processing','coffee_run_email_dev') returning id into r;
 result=public.coach_finalize_request(p_owner,r,'awaiting_approval','Review the exact email below. It will only be sent after approval.','send_email_dev',p_payload,'[]');
 a=(result->'approval'->>'id')::uuid;
 insert into public.coach_email_dispatch(action_id,owner_id,payload,mime_raw) values(a,p_owner,p_payload,p_raw);
 return result;
end $$;
revoke all on function public.coach_prepare_email(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.coach_prepare_email(uuid,text,jsonb,text) to service_role;

alter function public.coach_decide_action(uuid,uuid,text,text) rename to coach_decide_action_legacy;
create function public.coach_decide_action(p_owner uuid,p_action uuid,p_hash text,p_decision text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.assistant_actions; d public.coach_email_dispatch; v_reply text; result jsonb; replay boolean;
begin
 select * into a from public.assistant_actions where id=p_action and owner_id=p_owner for update;
 if not found then raise exception 'Approval not found' using errcode='P0002';end if;
 if a.action_type<>'send_email_dev' then return public.coach_decide_action_legacy(p_owner,p_action,p_hash,p_decision);end if;
 if p_hash is distinct from a.proposal_hash or p_decision is null or p_decision not in ('approve','decline') then raise exception 'Invalid decision or snapshot' using errcode='22023';end if;
 select * into d from public.coach_email_dispatch where action_id=a.id and owner_id=p_owner for update;
 if not found then raise exception 'Email dispatch missing';end if;
 replay=a.status<>'pending';
 if not replay and (a.expires_at<=now() or p_decision='decline') then
  result=public.coach_decide_action_legacy(p_owner,p_action,p_hash,p_decision);
  update public.coach_email_dispatch set state=case when a.expires_at<=now() then 'expired' else 'declined' end where action_id=a.id;
  return result;
 end if;
 if not replay then
  if a.proposed_changes is distinct from d.payload or a.proposal_hash is distinct from encode(sha256(convert_to(jsonb_build_object('action_type',a.action_type,'proposed_changes',a.proposed_changes,'proposal_text',a.proposal_text)::text,'UTF8')),'hex') then raise exception 'Snapshot mismatch';end if;
  update public.assistant_actions set status='approved',execution_status='queued',decided_at=now() where id=a.id returning * into a;
  update public.coach_email_dispatch set state='queued' where action_id=a.id;
  insert into public.assistant_action_events(action_id,owner_id,event_type) values(a.id,p_owner,'approved'),(a.id,p_owner,'email_queued');
 end if;
 v_reply=case a.execution_status when 'queued' then 'Approved and queued for the personal development sender. Refresh approvals to check delivery.' when 'succeeded' then 'Email sent. Provider message ID: '||coalesce(a.result->>'message_id','') when 'outcome_unknown' then 'Send attempt started; delivery is not confirmed. Do not retry until the sent mailbox is checked.' else coalesce(a.error_message,'Declined. Nothing was sent.') end;
 update public.assistant_requests set status=case when a.execution_status='queued' then 'processing' when a.execution_status='succeeded' or a.status='declined' then 'completed' else 'failed' end,reply=v_reply,requires_approval=false where id=a.request_id;
 return jsonb_build_object('status',case when a.execution_status='queued' then 'processing' when a.execution_status='succeeded' or a.status='declined' then 'completed' else 'failed' end,'reply',v_reply,'approval',to_jsonb(a),'requires_approval',false,'request_id',a.request_id,'thread_id',a.thread_id,'idempotent_replay',replay);
end $$;
revoke all on function public.coach_decide_action(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.coach_decide_action(uuid,uuid,text,text) to service_role;

-- Claim ONE approved message. Never returns a previously claimed MIME payload.
-- Mark ambiguity before crossing the provider boundary: a crash cannot make it retryable.
create function public.coach_claim_email_dev() returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.assistant_actions; d public.coach_email_dispatch; c uuid;
begin
 select aa.* into a from public.assistant_actions aa join public.coach_email_dispatch dd on dd.action_id=aa.id where dd.state='queued' and dd.owner_id='2192567a-41fd-435e-ad66-75bdc5101f28'::uuid order by dd.created_at for update of aa skip locked limit 1;
 if not found then return jsonb_build_object('claimed',false);end if;
 select * into d from public.coach_email_dispatch where action_id=a.id for update;
 if a.status<>'approved' or a.execution_status<>'queued' or d.attempts<>0 or a.expires_at<=now() or d.payload is distinct from a.proposed_changes then
  update public.coach_email_dispatch set state='expired' where action_id=a.id;
  update public.assistant_actions set execution_status='failed',error_message='Queued email expired or failed validation; no send attempted.' where id=a.id;
  update public.assistant_requests set status='failed',reply='Queued email expired or failed validation; no send attempted.',error_message='Email not sent.',completed_at=now() where id=a.request_id;
  insert into public.assistant_action_events(action_id,owner_id,event_type) values(a.id,a.owner_id,'email_rejected_before_send');
  return jsonb_build_object('claimed',false);
 end if;
 c=gen_random_uuid();
 update public.coach_email_dispatch set state='outcome_unknown',claim_id=c,attempts=1,claimed_at=now() where action_id=a.id;
 update public.assistant_actions set execution_status='outcome_unknown',execution_attempts=1,error_message='Send attempt started; delivery is not confirmed. Do not retry until the sent mailbox is checked.' where id=a.id;
 update public.assistant_requests set status='processing',reply='Send attempt started; delivery is not confirmed.',error_message='Awaiting provider result.' where id=a.request_id;
 insert into public.assistant_action_events(action_id,owner_id,event_type) values(a.id,a.owner_id,'email_send_claimed');
 return jsonb_build_object('claimed',true,'action_id',a.id,'claim_id',c,'raw',d.mime_raw,'idempotency_key',a.id);
end $$;
revoke all on function public.coach_claim_email_dev() from public,anon,authenticated;
grant execute on function public.coach_claim_email_dev() to service_role;

create function public.coach_finish_email_dev(p_action uuid,p_claim uuid,p_message_id text,p_result jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.assistant_actions; d public.coach_email_dispatch;
begin
 select * into a from public.assistant_actions where id=p_action for update;
 select * into d from public.coach_email_dispatch where action_id=p_action for update;
 if not found or p_claim is distinct from d.claim_id then raise exception 'Invalid claim' using errcode='22023';end if;
 if d.state='sent' then return jsonb_build_object('saved',true,'idempotent_replay',true);end if;
 if d.state<>'outcome_unknown' or p_message_id is null or p_message_id!~'^[A-Za-z0-9_-]{4,200}$' then raise exception 'Invalid provider result';end if;
 update public.coach_email_dispatch set state='sent',provider_message_id=p_message_id,provider_result=p_result,sent_at=now() where action_id=a.id;
 update public.assistant_actions set execution_status='succeeded',error_message=null,result=jsonb_build_object('provider','gmail','message_id',p_message_id,'sent_at',now(),'provider_result',p_result) where id=a.id;
 update public.assistant_requests set status='completed',reply='Email sent. Provider message ID: '||p_message_id,error_message=null,completed_at=now() where id=a.request_id;
 insert into public.assistant_action_events(action_id,owner_id,event_type,details) values(a.id,a.owner_id,'email_sent',jsonb_build_object('message_id',p_message_id,'sent_at',now()));
 return jsonb_build_object('saved',true,'idempotent_replay',false);
end $$;
revoke all on function public.coach_finish_email_dev(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.coach_finish_email_dev(uuid,uuid,text,jsonb) to service_role;
commit;
