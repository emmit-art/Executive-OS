-- No Apple/Make calls. All synthetic approval records roll back.
begin;
lock table public.coach_calendar_dispatch in share row exclusive mode;
do $$
declare
 o uuid := '2192567a-41fd-435e-ad66-75bdc5101f28';
 q uuid; a uuid; h text; r jsonb; c jsonb;
 p jsonb := '{"calendar_account":"personal_icloud_family","title":"SQL-only calendar guard test","start_at":"2026-09-29T12:00:00-04:00","end_at":"2026-09-29T12:15:00-04:00","timezone":"America/New_York","location":"","notes":"","all_day":false}';
begin
 if exists(select 1 from public.coach_calendar_dispatch where state='queued') then raise exception 'Run only when the calendar queue is empty'; end if;
 insert into public.assistant_requests(owner_id,thread_id,message,source,status) values(o,'sql-calendar-test','Rollback-only test; no provider call','calendar_guard_test','processing') returning id into q;
 begin perform public.coach_prepare_request_calendar_dev(o,q,p||'{"all_day":true}'); raise exception 'Unsupported all-day event accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.coach_prepare_request_calendar_dev(o,q,p||'{"notes":"Unsupported notes"}'); raise exception 'Unsupported notes accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.coach_prepare_request_calendar_dev(o,q,p||'{"start_at":"2026-09-29T12:00:00"}'); raise exception 'Offset-free date accepted'; exception when invalid_parameter_value then null; end;
 r=public.coach_prepare_request_calendar_dev(o,q,p); a=(r->'approval'->>'id')::uuid; h=r->'approval'->>'proposal_hash';
 if public.coach_claim_calendar_dev()->>'claimed'<>'false' then raise exception 'Unapproved event claimed'; end if;
 begin perform public.coach_decide_calendar_action_dev(gen_random_uuid(),a,h,'approve'); raise exception 'Wrong owner accepted'; exception when no_data_found then null; end;
 begin perform public.coach_decide_calendar_action_dev(o,a,repeat('0',64),'approve'); raise exception 'Wrong hash accepted'; exception when invalid_parameter_value then null; end;
 r=public.coach_decide_calendar_action_dev(o,a,h,'approve');
 if r->'approval'->>'execution_status'<>'queued' then raise exception 'Approval did not queue'; end if;
 if public.coach_decide_calendar_action_dev(o,a,h,'approve')->>'idempotent_replay'<>'true' then raise exception 'Approval replay failed'; end if;
 c=public.coach_claim_calendar_dev();
 if c->>'action_id'<>a::text or c->'payload' is distinct from p then raise exception 'Claim snapshot mismatch'; end if;
 if public.coach_claim_calendar_dev()->>'claimed'<>'false' then raise exception 'Duplicate claim'; end if;
 begin perform public.coach_finish_calendar_dev(a,null,'','{"outcome":"submitted_to_device"}'); raise exception 'Null claim accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.coach_finish_calendar_dev(a,gen_random_uuid(),'','{"outcome":"submitted_to_device"}'); raise exception 'Wrong claim accepted'; exception when invalid_parameter_value then null; end;
 r=public.coach_finish_calendar_dev(a,(c->>'claim_id')::uuid,'','{"outcome":"submitted_to_device","test":true}');
 if r->>'outcome'<>'submitted_to_device' then raise exception 'Submission receipt missing'; end if;
 if not exists(select 1 from public.assistant_actions where id=a and execution_status='outcome_unknown' and result->>'outcome'='submitted_to_device') then raise exception 'Submission falsely confirmed'; end if;
 if public.coach_finish_calendar_dev(a,(c->>'claim_id')::uuid,'','{"outcome":"submitted_to_device"}')->>'idempotent_replay'<>'true' then raise exception 'Duplicate receipt not idempotent'; end if;
 if public.coach_claim_calendar_dev()->>'claimed'<>'false' then raise exception 'Submitted event retried'; end if;
 begin perform public.coach_finish_calendar_dev(a,(c->>'claim_id')::uuid,'','{}'); raise exception 'Empty confirmed event ID accepted'; exception when invalid_parameter_value then null; end;
 perform public.coach_finish_calendar_dev(a,(c->>'claim_id')::uuid,'synthetic-sql-test-id','{"test":true}');
 if public.coach_finish_calendar_dev(a,(c->>'claim_id')::uuid,'synthetic-sql-test-id','{}')->>'idempotent_replay'<>'true' then raise exception 'Confirmed receipt replay failed'; end if;

 insert into public.assistant_requests(owner_id,thread_id,message,source,status) values(o,'sql-calendar-test','Decline test','calendar_guard_test','processing') returning id into q;
 r=public.coach_prepare_request_calendar_dev(o,q,p); a=(r->'approval'->>'id')::uuid; h=r->'approval'->>'proposal_hash';
 perform public.coach_decide_calendar_action_dev(o,a,h,'decline'); perform public.coach_decide_calendar_action_dev(o,a,h,'approve');
 if public.coach_claim_calendar_dev()->>'claimed'<>'false' then raise exception 'Declined event claimed'; end if;

 insert into public.assistant_requests(owner_id,thread_id,message,source,status) values(o,'sql-calendar-test','Expiry test','calendar_guard_test','processing') returning id into q;
 r=public.coach_prepare_request_calendar_dev(o,q,p); a=(r->'approval'->>'id')::uuid; h=r->'approval'->>'proposal_hash';
 update public.assistant_actions set expires_at=now()-interval '1 minute' where id=a;
 if public.coach_decide_calendar_action_dev(o,a,h,'approve')->'approval'->>'status'<>'expired' then raise exception 'Expiry ignored'; end if;
 if public.coach_claim_calendar_dev()->>'claimed'<>'false' then raise exception 'Expired event claimed'; end if;

 insert into public.assistant_requests(owner_id,thread_id,message,source,status) values(o,'sql-calendar-test','Error test','calendar_guard_test','processing') returning id into q;
 r=public.coach_prepare_request_calendar_dev(o,q,p); a=(r->'approval'->>'id')::uuid; h=r->'approval'->>'proposal_hash';
 perform public.coach_decide_calendar_action_dev(o,a,h,'approve'); c=public.coach_claim_calendar_dev();
 perform public.coach_calendar_error_dev(a,(c->>'claim_id')::uuid,'Controlled SQL-only error');
 if public.coach_claim_calendar_dev()->>'claimed'<>'false' then raise exception 'Failed event retried'; end if;
 if not exists(select 1 from public.assistant_action_events where action_id=a and event_type='calendar_provider_error') then raise exception 'Error audit missing'; end if;
 if has_function_privilege('authenticated','public.coach_claim_calendar_dev()','EXECUTE') or has_table_privilege('authenticated','public.coach_calendar_dispatch','INSERT') then raise exception 'Unsafe grants'; end if;
end $$;
rollback;
select 'calendar guards passed; synthetic records rolled back' as result;
