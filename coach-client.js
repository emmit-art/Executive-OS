(()=>{
  const THREAD_KEY="coffeeRunCoachThreadId";

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
    const status=allowed.has(data?.status)?data.status:"completed";
    return{...data,status,requires_approval:Boolean(data?.requires_approval||status==="awaiting_approval")};
  }

  function handleErrors(error){
    if(error instanceof Error)return error;
    const message=error?.message||error?.context?.message||"Coffee Run could not reach the Coach.";
    return new Error(String(message));
  }

  async function sendMessage(message,options={}){
    const text=String(message??"").trim();
    if(!text)throw new Error("Enter a message first.");
    const client=options.client||window.coffeeRunSupabase;
    if(!client?.functions?.invoke)throw new Error("Coffee Run is not connected to Supabase.");

    const threadId=String(options.threadId||getThreadId());
    const{data,error}=await client.functions.invoke("coach-proxy",{body:{
      message:text,
      thread_id:threadId,
      input_type:options.inputType||"text",
      source:options.source||"coffee_run"
    }});

    if(error)throw handleErrors(error);
    return handleStatus(receiveReply(data));
  }

  window.CoffeeRunCoach={sendMessage,receiveReply,handleStatus,handleErrors,getThreadId};
})();