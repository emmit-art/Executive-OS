import {normalizeMakeResponse,validateDecision} from './contract.mjs';
import {buildEmail} from './email.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
export function createHandler({createClient,env,fetchImpl=fetch}) {
  return async req=>{
    if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
    if(req.method!=='POST')return json({error:'Method not allowed'},405);
    const auth=req.headers.get('Authorization');
    if(!auth)return json({error:'Unauthorized'},401);
    const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!anon||!service)return json({error:'Server configuration is incomplete.'},503);
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:authError}=await userClient.auth.getUser();
    if(authError||!user)return json({error:'Unauthorized'},401);
    // Service credentials stay server-side. Every lookup/RPC uses verified user.id.
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    let requestId=null;
    try{
      let body;try{body=await req.json()}catch{return json({error:'Invalid JSON request.'},400)}
      if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Invalid request.'},400);
      const op=body.operation ?? 'message';
      if(op==='prepare_email'){
        let email;
        try{email=buildEmail(body.email,crypto.randomUUID())}catch(e){return json({error:e.message},400)}
        const {data,error}=await admin.rpc('coach_prepare_email',{p_owner:user.id,p_thread:String(body.thread_id??crypto.randomUUID()).slice(0,256),p_payload:email.payload,p_raw:email.raw});
        if(error)return json({error:'Could not save the personal development email proposal.'},error.code==='42501'?403:500);
        return json(data);
      }
      if(op==='decision'){
        try{validateDecision(body)}catch(e){return json({error:e.message},400)}
        const {data,error}=await admin.rpc('coach_decide_action',{p_owner:user.id,p_action:body.action_id,p_hash:body.proposal_hash,p_decision:body.decision});
        if(error)return json({error:error.code==='P0002'?'Approval not found.':error.code==='22023'?'The approval is stale or invalid. Reload it before deciding.':'Could not save the approval decision.'},error.code==='P0002'?404:error.code==='22023'?409:500);
        return json(data);
      }
      if(op==='list_approvals'){
        const {data,error}=await userClient.from('assistant_actions').select('*').order('created_at',{ascending:false}).limit(20);
        if(error)throw new Error('Could not load approvals.');
        return json({approvals:data});
      }
      if(!['message','diagnostic'].includes(op))return json({error:'Unknown operation.'},400);
      const diagnostic=op==='diagnostic';
      if(diagnostic&&!['success','failure'].includes(body.outcome))return json({error:'Unknown diagnostic.'},400);
      const message=diagnostic?`Approval diagnostic: ${body.outcome}. No external side effects.`:String(body.message??'').trim();
      const threadId=String(body.thread_id??'').trim()||crypto.randomUUID();
      if(!message||message.length>20000||threadId.length>256)return json({error:'Enter a message of at most 20,000 characters and a valid thread.'},400);
      if(!diagnostic&&/^\s*(APPROVE|DECLINE)\s+request_id=/i.test(message))return json({error:'Use the saved proposal’s Approve or Decline button. Chat text cannot approve actions.'},400);
      const {data:created,error:insertError}=await admin.from('assistant_requests').insert({owner_id:user.id,thread_id:threadId,message,input_type:'text',source:diagnostic?'coffee_run_diagnostic':'coffee_run',status:'processing'}).select('id').single();
      if(insertError||!created)throw new Error('Could not record the request.');
      requestId=created.id;
      let result;
      if(diagnostic){
        result={status:'awaiting_approval',reply:`Approve this ${body.outcome==='success'?'successful':'controlled failure'} diagnostic? It only tests the approval system; no email, calendar, task, or financial action will occur.`,action_type:`diagnostic_${body.outcome}`,proposed_changes:{summary:`${body.outcome} diagnostic with no external effects`},record_ids:[]};
      }else{
        const webhook=env('MAKE_COACH_WEBHOOK_URL'),key=env('MAKE_COACH_WEBHOOK_KEY');
        if(!webhook||!key)throw new Error('The Coach connection is not configured.');
        let upstream;
        try{upstream=await fetchImpl(webhook,{method:'POST',headers:{'Content-Type':'application/json','x-make-apikey':key},body:JSON.stringify({text:message,thread_id:threadId,user_id:user.id,request_id:requestId,source:'coffee_run',input_type:'text'}),signal:AbortSignal.timeout(35000)})}
        catch{throw new Error('The Coach connection timed out or failed. The outcome may be unknown; check records before retrying.');}
        if(!upstream.ok)throw new Error(`The Coach connection failed (HTTP ${upstream.status}).`);
        result=normalizeMakeResponse(await upstream.text(),requestId,threadId);
      }
      const {data,error}=await admin.rpc('coach_finalize_request',{p_owner:user.id,p_request:requestId,p_status:result.status,p_reply:result.reply,p_action_type:result.action_type,p_changes:result.proposed_changes,p_record_ids:result.record_ids});
      if(error)throw new Error('Could not save the Coach result. Check records before retrying.');
      return json(data);
    }catch(error){
      const message=error instanceof Error?error.message:'The Coach request failed.';
      if(requestId){
        const {error:updateError}=await admin.from('assistant_requests').update({status:'failed',requires_approval:false,error_message:message,reply:message,completed_at:new Date().toISOString()}).eq('id',requestId).eq('owner_id',user.id);
        if(updateError)return json({status:'failed',error:'The request failed and its failure state could not be saved. Check records before retrying.',request_id:requestId},503);
      }
      return json({status:'failed',error:message,reply:message,request_id:requestId},502);
    }
  };
}
