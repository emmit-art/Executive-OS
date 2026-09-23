import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMakeResponse,validateDecision} from '../supabase/functions/coach-proxy-dev/contract.mjs';
import {createHandler} from '../supabase/functions/coach-proxy-dev/handler.mjs';
const valid={status:'completed',reply:'"Coffee Run" works ✅\nSecond line',requires_approval:false,action_type:'none',proposed_changes:null,record_ids:[],request_id:'request-1',thread_id:'thread-1'};
const parse=x=>normalizeMakeResponse(JSON.stringify(x),'request-1','thread-1');
test('normalizes null collections without corrupting text or nonempty record arrays',()=>{const r=parse({...valid,record_ids:['record-1']});assert.deepEqual(r.proposed_changes,{});assert.deepEqual(r.record_ids,['record-1']);assert.equal(r.reply,valid.reply)});
for(const [name,value] of Object.entries({invalidStatus:{status:'bogus'},stringBoolean:{requires_approval:'false'},wrongRequest:{request_id:'other'},wrongThread:{thread_id:'other'},arrayProposal:{proposed_changes:[]},badIds:{record_ids:[1]},contradictoryApproval:{requires_approval:true},unapprovedSend:{action_type:'send_email'},unknownExecutor:{action_type:'magic_write'}}))test(`rejects ${name}`,()=>assert.throws(()=>parse({...valid,...value})));
test('rejects malformed JSON instead of marking it completed',()=>assert.throws(()=>normalizeMakeResponse('Accepted','request-1','thread-1')));
test('preserves exact structured approval',()=>{const p={...valid,status:'awaiting_approval',requires_approval:true,action_type:'send_email',proposed_changes:{recipient:'test@example.invalid',subject:'"Quotes"',body:'a\nb'}};assert.deepEqual(parse(p),p)});
test('does not accept a proposal that already wrote records',()=>assert.throws(()=>parse({...valid,status:'awaiting_approval',requires_approval:true,action_type:'send_email',proposed_changes:{summary:'x'},record_ids:['changed']})));
test('validates decision payload',()=>{assert.throws(()=>validateDecision({decision:'approve'}));validateDecision({decision:'approve',action_id:'12345678-1234-1234-1234-123456789abc',proposal_hash:'a'.repeat(64)})});
function setup({authorized=true,fetchImpl,finalizeError=null}={}){
  const updates=[],calls=[];
  const userClient={auth:{getUser:async()=>({data:{user:authorized?{id:'verified-owner'}:null},error:null})}};
  const admin={from:()=>({insert:x=>({select:()=>({single:async()=>{calls.push(x);return{data:{id:'request-1'},error:null}}})}),update:x=>({eq:()=>({eq:async()=>{updates.push(x);return{error:null}}})})}),rpc:async(name,args)=>{calls.push({name,args});return{data:{status:'completed'},error:finalizeError}}};
  const handler=createHandler({createClient:(_u,key)=>key==='anon'?userClient:admin,env:k=>({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'secret',MAKE_COACH_WEBHOOK_URL:'https://make.invalid',MAKE_COACH_WEBHOOK_KEY:'key'}[k]),fetchImpl:fetchImpl??(async()=>new Response(JSON.stringify(valid)))});
  const request=(body,auth=true)=>handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test'}:{})},body:JSON.stringify(body)}));
  return{request,updates,calls};
}
test('requires authentication before creating any request',async()=>{const x=setup();assert.equal((await x.request({message:'hello'},false)).status,401);assert.equal(x.calls.length,0)});
test('rejects invalid user before privileged operations',async()=>{const x=setup({authorized:false});assert.equal((await x.request({message:'hello'})).status,401);assert.equal(x.calls.length,0)});
test('legacy chat approval never reaches Make',async()=>{const x=setup({fetchImpl:()=>{throw Error('must not call')}});assert.equal((await x.request({message:'APPROVE request_id=abc'})).status,400);assert.equal(x.calls.length,0)});
test('Make HTTP failure is persisted as failed',async()=>{const x=setup({fetchImpl:async()=>new Response('secret detail',{status:500})});const r=await x.request({message:'hi',thread_id:'thread-1'});assert.equal(r.status,502);assert.equal(x.updates[0].status,'failed');assert.ok(!JSON.stringify(await r.json()).includes('secret detail'))});
test('invalid JSON is persisted as failed',async()=>{const x=setup({fetchImpl:async()=>new Response('Accepted')});assert.equal((await x.request({message:'hi',thread_id:'thread-1'})).status,502);assert.equal(x.updates[0].status,'failed')});
test('connection failure records unknown outcome without auto retry',async()=>{let attempts=0;const x=setup({fetchImpl:async()=>{attempts++;throw Error('network')}});const r=await x.request({message:'hi',thread_id:'thread-1'});assert.equal(attempts,1);assert.equal(r.status,502);assert.match(x.updates[0].reply,/unknown/)});
test('database finalization failure never claims success',async()=>{const x=setup({finalizeError:{message:'DB error'}});assert.equal((await x.request({message:'hi',thread_id:'thread-1'})).status,502);assert.equal(x.updates[0].status,'failed')});
test('owner comes from verified auth, never caller payload',async()=>{const x=setup();await x.request({message:'hi',thread_id:'thread-1',owner_id:'attacker'});assert.equal(x.calls[0].owner_id,'verified-owner');assert.equal(x.calls[1].args.p_owner,'verified-owner')});
test('diagnostic bypasses Make and binds a server-selected source',async()=>{const x=setup({fetchImpl:()=>{throw Error('must not call')}});const r=await x.request({operation:'diagnostic',outcome:'failure',owner_id:'attacker'});assert.equal(r.status,200);assert.equal(x.calls[0].source,'coffee_run_diagnostic');assert.equal(x.calls[1].args.p_action_type,'diagnostic_failure')});
