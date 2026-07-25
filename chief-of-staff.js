import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const sb=createClient("https://hnvvvdibncwlplweeuod.supabase.co","sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const cap=s=>s?String(s).trim().replace(/^\w/,c=>c.toUpperCase()):null;
let preview=null,workspaces=[];

function areaOf(text){
  if(/dom\s*con|dominion conservation/i.test(text))return"dom_con";
  if(/eli\s*global/i.test(text))return"eli_global";
  if(/code\s*3|travis|ashley|whiteboard|installer|submittal|customer|job\s*site/i.test(text))return"dom_con";
  return"personal";
}
function priorityOf(text){
  if(/\bp1\b|urgent|critical|asap/i.test(text))return"p1";
  if(/\bp2\b|high priority|important|blocking/i.test(text))return"p2";
  if(/\bp4\b|low priority|someday/i.test(text))return"p4";
  return"p3";
}
function dateBase(text){
  const d=new Date();
  if(/\btomorrow\b/i.test(text))d.setDate(d.getDate()+1);
  else{
    const names=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    const i=names.findIndex(x=>new RegExp(`\\b(next\\s+)?${x}\\b`,'i').test(text));
    if(i>=0){let add=(i-d.getDay()+7)%7;if(add===0||new RegExp(`next\\s+${names[i]}`,'i').test(text))add+=7;d.setDate(d.getDate()+add)}
  }
  return d;
}
function clock(text,base){
  const m=text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if(!m)return null;
  let h=+m[1],min=+(m[2]||0);
  if(m[3].toLowerCase()==="pm"&&h<12)h+=12;
  if(m[3].toLowerCase()==="am"&&h===12)h=0;
  const d=new Date(base);d.setHours(h,min,0,0);return d;
}
function timing(text){
  const base=dateBase(text);let start=null,due=null,reminder=null,offset=null;
  const startMatch=text.match(/(?:start|schedule|begin).*?(?:at|on)\s+([^,.]+)/i);
  const dueMatch=text.match(/(?:due|finish|complete|done).*?(?:by|at)\s+([^,.]+)/i)||text.match(/\bby\s+([^,.]+)/i);
  const remindMatch=text.match(/remind me.*?(?:at|on)\s+([^,.]+)/i);
  if(startMatch)start=clock(startMatch[1],base);
  if(dueMatch)due=clock(dueMatch[1],base);
  if(remindMatch)reminder=clock(remindMatch[1],base);
  const before=text.match(/remind me\s+(\d+)\s*(minute|minutes|hour|hours)\s+before/i);
  if(before){offset=+before[1]*(before[2].startsWith("hour")?60:1);const anchor=start||due;if(anchor)reminder=new Date(anchor-offset*60000)}
  const any=clock(text,base);
  if(!start&&!due&&!reminder&&any){if(/remind me/i.test(text))reminder=any;else if(/\bby\b|due|finish|complete/i.test(text))due=any;else start=any}
  return{start,due,reminder,offset,needsQuestion:Boolean(before&&!start&&!due)};
}
function reasonOf(text){return text.match(/\b(?:because|so that|in order to)\s+(.+?)(?:[.;]|$)/i)?.[1]?.trim()||null}
function stripReason(text){return text.split(/\b(?:because|so that|in order to)\b/i)[0].trim()}
function stripTiming(text){return text
  .replace(/^\s*(?:today|tomorrow|next\s+\w+)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?[,:]?\s*/i,"")
  .replace(/^\s*at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)[,:]?\s*/i,"")
  .replace(/\b(?:today|tomorrow|next\s+\w+)\b(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?/ig,"")
  .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/ig,"")
  .replace(/\s+/g," ").trim();}
function commandCore(raw){return stripTiming(stripReason(raw)).replace(/^please\s+/i,"").replace(/^remind me to\s+/i,"").trim()}

const ACTIONS=[
  {type:"call",re:/\b(call|phone|ring)\b/i},
  {type:"meeting",re:/\b(meet with|schedule (?:a )?meeting|set up (?:a )?meeting|book (?:a )?meeting|appointment)\b/i},
  {type:"waiting",re:/\b(waiting on|waiting for|follow up with|check back with)\b/i},
  {type:"decision",re:/\b(decide|decision|choose between|weigh options)\b/i},
  {type:"purchase",re:/\b(buy|purchase|order|pick up|get from the store)\b/i},
  {type:"idea",re:/\b(save this idea|idea|brainstorm)\b/i},
  {type:"project",re:/\b(create|start|plan|build|launch)\b/i}
];
function primaryAction(core){
  const hits=ACTIONS.map(a=>{const m=core.match(a.re);return m?{...a,index:m.index,match:m[0]}:null}).filter(Boolean).sort((a,b)=>a.index-b.index);
  if(!hits.length)return{type:"task",match:null,index:-1};
  // A literal action verb wins over contextual nouns later in the sentence.
  return hits[0];
}
function cleanFragment(s){return s?.replace(/^[\s,:-]+|[\s,.;:-]+$/g,"").replace(/\s+/g," ").trim()||null}
function parseCall(core){
  const m=core.match(/\b(?:call|phone|ring)\s+(.+?)(?=\s+about\s+|\s+regarding\s+|\s+for\s+|$)/i);
  const person=cleanFragment(m?.[1]);
  const subject=cleanFragment(core.match(/\b(?:about|regarding)\s+(.+)$/i)?.[1]);
  return{person,subject,title:`Call ${person||"contact"}${subject?` about ${subject}`:""}`};
}
function parseMeeting(core){
  const m=core.match(/\b(?:meet with|schedule (?:a )?meeting with|set up (?:a )?meeting with|book (?:a )?meeting with)\s+(.+?)(?=\s+about\s+|\s+regarding\s+|$)/i);
  const person=cleanFragment(m?.[1]);
  const subject=cleanFragment(core.match(/\b(?:about|regarding)\s+(.+)$/i)?.[1]);
  return{person,subject,title:person?`Meet with ${person}${subject?` about ${subject}`:""}`:cap(subject||"Meeting")};
}
function parseWaiting(core){
  const m=core.match(/\b(?:waiting on|waiting for|follow up with|check back with)\s+(.+?)(?=\s+(?:for|about|to)\s+|$)/i);
  const person=cleanFragment(m?.[1]);
  const subject=cleanFragment(core.match(/\b(?:for|about|to)\s+(.+)$/i)?.[1]);
  return{person,subject,title:`Waiting on ${person||"response"}${subject?` — ${subject}`:""}`};
}
function parsePurchase(core){
  const subject=cleanFragment(core.replace(/^.*?\b(?:buy|purchase|order|pick up|get from the store)\b\s*/i,""));
  return{person:null,subject,title:`Buy ${subject||"item"}`};
}
function parseDecision(core){
  const subject=cleanFragment(core.replace(/^.*?\b(?:decide|decision about|choose between|weigh options)\b\s*/i,""));
  return{person:null,subject,title:`Decide: ${subject||"open decision"}`};
}
function parseIdea(core){
  const subject=cleanFragment(core.replace(/^.*?\b(?:save this idea|idea|brainstorm)\b:?\s*/i,""));
  return{person:null,subject,title:cap(subject||"New idea")};
}
function parseProject(core){
  const subject=cleanFragment(core.replace(/^.*?\b(?:create|start|plan|build|launch)\b\s*/i,""));
  return{person:null,subject,title:cap(subject||"New project")};
}
function parseTask(core){
  const subject=cleanFragment(core.replace(/^(?:add|create|make|need to|i need to)\s+/i,""));
  return{person:null,subject,title:cap(subject||core)};
}
function parseByType(type,core){
  if(type==="call")return parseCall(core);
  if(type==="meeting")return parseMeeting(core);
  if(type==="waiting")return parseWaiting(core);
  if(type==="purchase")return parsePurchase(core);
  if(type==="decision")return parseDecision(core);
  if(type==="idea")return parseIdea(core);
  if(type==="project")return parseProject(core);
  return parseTask(core);
}
function buildObject(raw){
  const core=commandCore(raw),action=primaryAction(core),parsed=parseByType(action.type,core),times=timing(raw),reason=reasonOf(raw);
  const object_type=action.type,area=areaOf(raw),priority=priorityOf(raw);
  const title=cleanFragment(parsed.title)?.slice(0,120)||"New item";
  const summary=reason||parsed.subject||title;
  let confidence=70;if(action.match)confidence+=10;if(parsed.person)confidence+=7;if(parsed.subject)confidence+=5;if(reason)confidence+=4;if(times.start||times.due||times.reminder)confidence+=4;
  return{raw_input:raw,object_type,title,summary,area,priority,related_person:parsed.person,subject:parsed.subject,reason,desired_outcome:reason,times,object_data:{primary_action:action.match,reminder_offset_minutes:times.offset,confidence:Math.min(98,confidence)}};
}
const labelType=t=>({call:"Call",meeting:"Meeting",waiting:"Waiting On",decision:"Decision",purchase:"Purchase",idea:"Idea",project:"Project",task:"Task"}[t]||t);
const labelArea=a=>({dom_con:"Dom Con",eli_global:"ELI Global",personal:"Personal"}[a]||a);
const fmt=d=>d?new Date(d).toLocaleString([],{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"Not set";
function detail(label,value){return value?`<div class="routing-item"><small>${esc(label)}</small><b>${esc(value)}</b></div>`:""}
function renderPreview(){
  const box=$("routingPreview"),raw=$("aiInput").value.trim();
  if(!raw){preview=null;box.classList.add("hidden");return}
  preview=buildObject(raw);const o=preview;
  box.innerHTML=`<div class="routing-preview-head"><strong>Did I understand you correctly?</strong><span class="routing-confidence">${o.object_data.confidence}% confidence</span></div><p class="routing-summary"><strong>${esc(o.title)}</strong></p><div class="routing-grid">${detail("Primary action",labelType(o.object_type))}${detail("Person",o.related_person)}${detail("Topic",o.subject)}${detail("Reason",o.reason)}${detail("Reminder",o.times.reminder?fmt(o.times.reminder):null)}${detail("Start",o.times.start?fmt(o.times.start):null)}${detail("Due",o.times.due?fmt(o.times.due):null)}${detail("Area",labelArea(o.area))}</div>`;
  box.classList.remove("hidden");
}
async function context(){
  const{data:{session}}=await sb.auth.getSession();if(!session?.user)throw new Error("Please sign in again.");
  if(!workspaces.length){const{data,error}=await sb.from("workspaces").select("id,area");if(error)throw error;workspaces=data||[]}
  return session.user;
}
const ws=area=>workspaces.find(w=>w.area===area)?.id||null;
async function mirrorObject(o,owner_id,workspace_id){
  if(o.object_type==="idea"){
    const{error}=await sb.from("notes").insert({owner_id,workspace_id:ws("second_brain"),title:o.title,body:o.summary||o.raw_input,note_type:"idea"});if(error)throw error;return null;
  }
  if(o.object_type==="waiting"){
    const{error}=await sb.from("waiting_on").insert({owner_id,workspace_id,person_or_company:o.related_person||"Follow-up",item:o.subject||o.summary||o.title,follow_up_at:o.times.reminder?.toISOString()||o.times.due?.toISOString()||null});if(error)throw error;return null;
  }
  const payload={owner_id,workspace_id,title:o.title,description:o.summary,status:"planned",priority:o.priority,scheduled_start:o.times.start?.toISOString()||null,scheduled_end:o.times.due?.toISOString()||null,due_at:o.times.due?.toISOString()||null,reminder_at:o.times.reminder?.toISOString()||null,reminder_offset_minutes:o.times.offset,reason:o.reason,desired_outcome:o.desired_outcome,related_person:o.related_person,context_type:o.object_type,estimated_minutes:o.object_type==="call"?5:o.object_type==="purchase"?20:null,energy_required:/call|purchase/.test(o.object_type)?"low":"medium",source:"executive_object_engine",executive_context:{object_type:o.object_type,subject:o.subject,raw_capture:o.raw_input,primary_action:o.object_data.primary_action}};
  const{data,error}=await sb.from("tasks").insert(payload).select("id").single();if(error)throw error;return data?.id||null;
}
async function fileObject(event){
  event?.preventDefault();event?.stopImmediatePropagation();
  const raw=$("aiInput").value.trim();if(!raw)return;
  const o=buildObject(raw),result=$("aiResult"),button=$("aiSubmit");result.classList.remove("hidden");
  if(o.times.needsQuestion){result.textContent="Should that reminder be before the start time or before the due time?";return}
  button.disabled=true;result.textContent="Saving what I understood…";
  try{
    const user=await context(),workspace_id=ws(o.area),taskId=await mirrorObject(o,user.id,workspace_id);
    const{error}=await sb.from("executive_objects").insert({owner_id:user.id,workspace_id,object_type:o.object_type,title:o.title,summary:o.summary,status:o.object_type==="waiting"?"waiting":"open",priority:o.priority,scheduled_start:o.times.start?.toISOString()||null,scheduled_end:o.times.due?.toISOString()||null,due_at:o.times.due?.toISOString()||null,reminder_at:o.times.reminder?.toISOString()||null,related_person:o.related_person,subject:o.subject,reason:o.reason,desired_outcome:o.desired_outcome,raw_input:o.raw_input,object_data:o.object_data,linked_task_id:taskId});
    if(error)throw error;
    await sb.from("assistant_captures").insert({owner_id:user.id,raw_text:raw,status:"inbox",source:"executive_language_engine"});
    result.innerHTML=`✓ Saved <strong>${esc(o.title)}</strong>`;$("aiInput").value="";$("routingPreview").classList.add("hidden");setTimeout(()=>location.reload(),700);
  }catch(e){result.textContent=e?.message||"I could not save that."}finally{button.disabled=false}
}
function editUnderstanding(event){event?.preventDefault();event?.stopImmediatePropagation();$("aiInput")?.focus();$("aiInput")?.select();}
function attach(){
  const input=$("aiInput"),submit=$("aiSubmit"),edit=$("aiInboxOnly");if(!input||!submit)return;
  submit.textContent="Looks right";
  if(edit){edit.textContent="Edit";edit.addEventListener("click",editUnderstanding,true)}
  input.addEventListener("input",renderPreview);submit.addEventListener("click",fileObject,true);
  document.querySelectorAll(".ai-chip").forEach(c=>c.addEventListener("click",()=>setTimeout(renderPreview,0)));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",attach);else attach();