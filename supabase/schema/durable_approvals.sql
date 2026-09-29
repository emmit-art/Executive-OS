begin;

alter table public.assistant_requests
  add column if not exists action_type text,
  add column if not exists proposed_changes jsonb,
  add column if not exists record_ids jsonb;

create table public.assistant_actions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.assistant_requests(id),
  owner_id uuid not null references auth.users(id),
  thread_id text not null,
  action_type text not null,
  proposed_changes jsonb not null check (jsonb_typeof(proposed_changes) = 'object'),
  proposal_text text not null,
  proposal_hash text not null,
  status text not null default 'pending' check (status in ('pending','approved','declined','expired')),
  execution_status text not null default 'not_started' check (execution_status in ('not_started','succeeded','failed','blocked')),
  execution_attempts integer not null default 0 check (execution_attempts between 0 and 1),
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  decided_at timestamptz
);
create index assistant_actions_owner_created_idx on public.assistant_actions(owner_id, created_at desc);
create table public.assistant_action_events (
  id bigint generated always as identity primary key,
  action_id uuid not null references public.assistant_actions(id),
  owner_id uuid not null references auth.users(id),
  event_type text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(action_id,event_type)
);
create index assistant_action_events_owner_idx on public.assistant_action_events(owner_id,created_at desc);
alter table public.assistant_actions enable row level security;
alter table public.assistant_action_events enable row level security;
revoke all on public.assistant_actions, public.assistant_action_events from public, anon, authenticated;
grant select on public.assistant_actions, public.assistant_action_events to authenticated;
grant all on public.assistant_actions, public.assistant_action_events to service_role;
grant usage, select on sequence public.assistant_action_events_id_seq to service_role;
create policy assistant_actions_select_own on public.assistant_actions for select to authenticated using ((select auth.uid()) = owner_id);
create policy assistant_action_events_select_own on public.assistant_action_events for select to authenticated using ((select auth.uid()) = owner_id);

-- Only the authenticated Edge Function's server client may finalize proposals.
-- The UI cannot write or alter an action, its hash, or its decision.
create function public.coach_finalize_request(
  p_owner uuid, p_request uuid, p_status text, p_reply text,
  p_action_type text, p_changes jsonb, p_record_ids jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.assistant_requests; a public.assistant_actions; snapshot jsonb;
begin
  select * into r from public.assistant_requests where id=p_request and owner_id=p_owner for update;
  if not found then raise exception 'Request not found' using errcode='P0002'; end if;
  if r.status not in ('received','processing') then raise exception 'Request already finalized'; end if;
  if p_status not in ('completed','needs_clarification','awaiting_approval','failed') then raise exception 'Invalid response status'; end if;
  if jsonb_typeof(p_changes) <> 'object' or jsonb_typeof(p_record_ids) <> 'array' then raise exception 'Invalid structured fields'; end if;
  if p_status='awaiting_approval' then
    snapshot=jsonb_build_object('action_type',p_action_type,'proposed_changes',p_changes,'proposal_text',p_reply);
    insert into public.assistant_actions(request_id,owner_id,thread_id,action_type,proposed_changes,proposal_text,proposal_hash)
    values(r.id,r.owner_id,r.thread_id,p_action_type,p_changes,p_reply,encode(sha256(convert_to(snapshot::text,'UTF8')),'hex')) returning * into a;
    insert into public.assistant_action_events(action_id,owner_id,event_type) values(a.id,p_owner,'proposed');
  end if;
  update public.assistant_requests set status=p_status,reply=p_reply,requires_approval=(p_status='awaiting_approval'),
    action_type=p_action_type,proposed_changes=p_changes,record_ids=p_record_ids,
    error_message=case when p_status='failed' then p_reply else null end,
    completed_at=case when p_status in ('completed','failed') then now() else null end where id=r.id;
  return jsonb_build_object('status',p_status,'reply',p_reply,'requires_approval',p_status='awaiting_approval',
    'action_type',p_action_type,'proposed_changes',p_changes,'record_ids',p_record_ids,
    'request_id',r.id,'thread_id',r.thread_id,'approval',case when a.id is not null then to_jsonb(a) else null end);
end $$;
revoke all on function public.coach_finalize_request(uuid,uuid,text,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.coach_finalize_request(uuid,uuid,text,text,text,jsonb,jsonb) to service_role;

-- Row locking makes concurrent/repeated decisions exactly-once for these local
-- diagnostic executors. External executors are deliberately not implemented.
create function public.coach_decide_action(p_owner uuid,p_action uuid,p_hash text,p_decision text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.assistant_actions; response_status text; response_reply text; replay boolean:=false; diagnostic boolean;
begin
  if p_decision not in ('approve','decline') then raise exception 'Invalid decision' using errcode='22023'; end if;
  select * into a from public.assistant_actions where id=p_action and owner_id=p_owner for update;
  if not found then raise exception 'Approval not found' using errcode='P0002'; end if;
  if p_hash is distinct from a.proposal_hash then raise exception 'Proposal changed; reload it before deciding' using errcode='22023'; end if;
  if a.status <> 'pending' then
    replay=true;
  elsif a.expires_at <= now() then
    update public.assistant_actions set status='expired',decided_at=now(),error_message='Approval expired. Request a new proposal.' where id=a.id returning * into a;
    insert into public.assistant_action_events(action_id,owner_id,event_type) values(a.id,p_owner,'expired');
  elsif p_decision='decline' then
    update public.assistant_actions set status='declined',decided_at=now() where id=a.id returning * into a;
    insert into public.assistant_action_events(action_id,owner_id,event_type) values(a.id,p_owner,'declined');
  else
    select source='coffee_run_diagnostic' into diagnostic from public.assistant_requests where id=a.request_id;
    update public.assistant_actions set status='approved',decided_at=now() where id=a.id returning * into a;
    insert into public.assistant_action_events(action_id,owner_id,event_type) values(a.id,p_owner,'approved');
    if diagnostic and a.action_type in ('diagnostic_success','diagnostic_failure') then
      update public.assistant_actions set execution_attempts=1,
        execution_status=case when action_type='diagnostic_success' then 'succeeded' else 'failed' end,
        result=jsonb_build_object('diagnostic',true,'external_side_effects',false),
        error_message=case when action_type='diagnostic_failure' then 'Controlled diagnostic failure. No external action was attempted.' else null end
      where id=a.id returning * into a;
    else
      update public.assistant_actions set execution_status='blocked',error_message='Approval recorded, but this action has no connected executor. Nothing was executed. Request a new proposal after an executor is connected.'
      where id=a.id returning * into a;
    end if;
    insert into public.assistant_action_events(action_id,owner_id,event_type,details)
      values(a.id,p_owner,'execution_'||a.execution_status,jsonb_build_object('attempts',a.execution_attempts));
  end if;
  response_status=case when a.status='declined' or a.execution_status='succeeded' then 'completed' else 'failed' end;
  response_reply=case when a.status='declined' then 'Declined. Nothing was executed.'
    when a.execution_status='succeeded' then 'Approval test completed once. No email, calendar, financial, or other external action was performed.'
    else a.error_message end;
  update public.assistant_requests set status=response_status,requires_approval=false,reply=response_reply,
    error_message=case when response_status='failed' then response_reply else null end,completed_at=now() where id=a.request_id and owner_id=p_owner;
  return jsonb_build_object('status',response_status,'reply',response_reply,'requires_approval',false,
    'request_id',a.request_id,'thread_id',a.thread_id,'approval',to_jsonb(a),'idempotent_replay',replay);
end $$;
revoke all on function public.coach_decide_action(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.coach_decide_action(uuid,uuid,text,text) to service_role;
commit;
