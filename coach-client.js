(()=>{
  const THREAD_KEY="coffeeRunCoachThreadId";
  const FUNCTION_URL="https://hnvvvdibncwlplweeuod.supabase.co/functions/v1/coach-proxy-dev";
  const PUBLISHABLE_KEY="sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1";

  function createThreadId(){
    if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
    return `thread-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function getThreadId(){
    let threadId=localStorage.getItem(THREAD_KEY);
    if(!threadId){
      threadId=createThreadId();
      localStorage.setItem(THREAD_KEY,threadId);
    }
    return threadId;
  }

  function receiveReply(data){
    if(!data||typeof data!=="object")return{status:"failed",reply:"The Coach returned an invalid response."};
    if(data.thread_id)localStorage.setItem(THREAD_KEY,String(data.thread_id));
    return data;
  }

  function handleStatus(data){
    const allowed=new Set(["received","processing","needs_clarification","awaiting_approval","completed","failed"]);
    const status=allowed.has(data?.status)?data.status:"failed";
    return{...data,status,requires_approval:Boolean(data?.requires_approval||status==="awaiting_approval")};
  }

  function handleErrors(error){
    if(error instanceof Error)return error;
    const message=error?.message||error?.context?.message||"Coffee Run could not reach the Coach.";
    return new Error(String(message));
  }

  async function invoke(payload,options={}){

    const client=options.client||window.coffeeRunSupabase;
    if(!client?.auth?.getSession)throw new Error("Coffee Run is not connected to Supabase.");

    const{data:sessionData,error:sessionError}=await client.auth.getSession();
    if(sessionError)throw sessionError;
    const accessToken=sessionData?.session?.access_token;
    if(!accessToken)throw new Error("Your Coffee Run session expired. Sign out and back in.");

    const threadId=String(options.threadId||getThreadId());
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),45000);

    try{
      const response=await fetch(FUNCTION_URL,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "apikey":PUBLISHABLE_KEY,
          "Authorization":`Bearer ${accessToken}`
        },
        body:JSON.stringify({...payload,thread_id:threadId}),
        signal:controller.signal
      });

      const raw=await response.text();
      let data={};
      try{data=JSON.parse(raw)}catch{throw new Error("The Coach returned an invalid response.")}

      if(!response.ok){
        throw new Error(data?.error||data?.message||`Coach request failed with status ${response.status}.`);
      }

      return data.approvals ? data : handleStatus(receiveReply(data));
    }catch(error){
      if(error?.name==="AbortError")throw new Error("The Coach request timed out after 45 seconds.");
      throw handleErrors(error);
    }finally{
      clearTimeout(timeout);
    }
  }

  async function sendMessage(message,options={}){
    const text=String(message??'').trim();
    if(!text)throw new Error('Enter a message first.');
    return invoke({operation:'message',message:text},options);
  }
  const decide=(approval,decision,options={})=>invoke({operation:'decision',action_id:approval.id,proposal_hash:approval.proposal_hash,decision},options);
  const listApprovals=(options={})=>invoke({operation:'list_approvals'},options);
  const diagnostic=(outcome,options={})=>invoke({operation:'diagnostic',outcome},options);
  window.CoffeeRunCoach={sendMessage,decide,listApprovals,diagnostic,receiveReply,handleStatus,handleErrors,getThreadId};
})();