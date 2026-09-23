-- Atomically attach the validated email to the original authenticated chat request.
create function public.coach_prepare_request_email_dev(p_owner uuid,p_request uuid,p_payload jsonb,p_raw text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; a uuid;
begin
 if p_owner is distinct from '2192567a-41fd-435e-ad66-75bdc5101f28'::uuid then raise exception 'Development sender is not configured for this user' using errcode='42501';end if;
 if p_payload->>'from' is distinct from 'emmit.atkins@gmail.com' or p_payload->>'to' is distinct from 'emmit.atkins@gmail.com' or p_payload->>'sender_account' is distinct from 'personal_gmail_dev' or jsonb_typeof(p_payload->'attachments') is distinct from 'array' or p_raw is null or length(p_raw)=0 or length(p_raw)>2000000 then raise exception 'Invalid development email payload' using errcode='22023';end if;
 result=public.coach_finalize_request(p_owner,p_request,'awaiting_approval','Review the exact email below. It will only be sent after approval.','send_email_dev',p_payload,'[]');
 a=(result->'approval'->>'id')::uuid;
 insert into public.coach_email_dispatch(action_id,owner_id,payload,mime_raw) values(a,p_owner,p_payload,p_raw);
 return result;
end $$;
revoke all on function public.coach_prepare_request_email_dev(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.coach_prepare_request_email_dev(uuid,uuid,jsonb,text) to service_role;
