import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

const sb=createClient(
  "https://hnvvvdibncwlplweeuod.supabase.co",
  "sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1",
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}}
);

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const areaLabels={dom_con:"Dom Con",eli_global:"ELI Global",personal:"Personal"};
const typeLabels={task:"Task",waiting:"Follow-up",person:"Person",project:"Project",decision:"Decision",event:"Event",note:"Note"};
let session=null,workspaces=[],workspaceId=null,preview=null,inbox=[];

const ws=area=>workspaces.find(w=>w.area===area)?.id||null;
const titleCase=s=>String(s||"").replace(/\b\w/g,c=>c.toUpperCase());

function inferArea(text){
  const t=text.toLowerCase();
  if(/\b(dom con|dominion conservation|lighting|rebate|energy project)\b/.test(t))return"dom_con";
  if(/\b(eli|eli global|government contract|holding company)\b/.test(t))return"eli_global";
  return"personal";
}

function inferDate(text){
  const now=new Date(),t=text.toLowerCase();let d=null;
  if(/\btoday\b/.test(t))d=new Date(now);
  if(/\btomorrow\b/.test(t)){d=new Date(now);d.setDate(d.getDate()+1)}
  const weekday={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
  for(const [name,day] of Object.entries(weekday))if(new RegExp(`\\b${name}\\b`).test(t)){d=new Date(now);let add=(day-d.getDay()+7)%7;if(add===0)add=7;d.setDate(d.getDate()+add)}
  const md=t.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);if(md){const year=md[3]?(+md[3]<100?2000+(+md[3]):+md[3]):now.getFullYear();d=new Date(year,+md[1]-1,+md[2])}
  if(!d)return null;
  const tm=t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);if(tm){let h=+tm[1]%12;if(tm[3]==="pm")h+=12;d.setHours(h,+(tm[2]||0),0,0)}else d.setHours(9,0,0,0);
  return d.toISOString();
}

function inferPerson(text){
  const patterns=[/\b(?:call|email|text|meet with|follow up with|waiting on|ask|contact)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,/\bfrom\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/];
  for(const p of patterns){const m=text.match(p);if(m)return m[1]}
  return"";
}

function cleanTitle(text){return text.replace(/\b(today|tomorrow|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|at \d{1,2}(?::\d{2})?\s*(?:am|pm))\b/gi,"").replace(/\s+/g," ").trim().replace(/[.!]+$/,"")}

function classify(raw){
  const t=raw.toLowerCase(),area=inferArea(raw),at=inferDate(raw),person=inferPerson(raw);let type="note",priority="p3",status="active";
  if(/\b(p1|urgent|asap|immediately|critical)\b/.test(t))priority="p1";else if(/\b(p2|important|high priority)\b/.test(t))priority="p2";
  if(/\b(waiting on|waiting for|follow up|follow-up|hasn't sent|has not sent)\b/.test(t))type="waiting";
  else if(/\b(decided|decision|we will|chose|approved|declined|not moving forward)\b/.test(t))type="decision";
  else if(/\b(meeting|appointment|event|lunch with|call with)\b/.test(t)&&at)type="event";
  else if(/\b(project|launch|initiative|contract)\b/.test(t)&&/\b(start|create|new|track|manage)\b/.test(t))type="project";
  else if(/\b(add|remind|need to|must|call|email|send|complete|finish|schedule|prepare|review|pay|buy)\b/.test(t))type="task";
  if(type==="waiting")status="waiting";
  const title=cleanTitle(raw);
  const items=[{type,area,title:title||"Untitled capture",at,person,priority,status,summary:raw}];
  if(person&&!["person"].includes(type))items.push({type:"person",area,title:person,status:"active",summary:`Mentioned in capture: ${raw}`,at:null,person:"",priority:"p3"});
  return{raw,items};
}

function install(){
  if(document.getElementById("inbox"))return;
  const main=document.querySelector("main");if(!main)return;
  const section=document.createElement("section");section.id="inbox";section.className="section";
  section.innerHTML=`<div class="page-title"><div class="eyebrow">Executive Inbox · One thought, many actions</div><h2>Capture once</h2><p class="task-meta">Type naturally. Executive OS will interpret the thought, show its plan, and file the approved objects.</p></div><div class="inbox-layout"><div><div class="card inbox-capture"><textarea id="executiveInboxInput" class="field inbox-input" rows="5" placeholder="Example: Call Mike Tuesday at 9 AM about the Dom Con proposal. Make it urgent."></textarea><div class="inbox-examples"><button class="ai-chip" data-inbox-example="Follow up with Sarah Friday about the ELI government contract.">Follow-up</button><button class="ai-chip" data-inbox-example="We decided to delay the new company launch until October.">Decision</button><button class="ai-chip" data-inbox-example="Meeting with John tomorrow at 2 PM about the Dom Con lighting project.">Meeting</button></div><button id="reviewInboxCapture" class="btn full">Review plan</button></div><div id="inboxPreview" class="card inbox-preview hidden"></div></div><div class="card"><div class="section-head"><div><div class="eyebrow">Recent captures</div><h3>Inbox history</h3></div></div><div id="inboxHistory"></div></div></div>`;
  main.appendChild(section);
  document.querySelectorAll(".desktop-nav").forEach(nav=>{const b=document.createElement("button");b.dataset.tab="inbox";b.textContent="Inbox";nav.insertBefore(b,nav.querySelector('[data-tab="tasks"]'))});
  const more=document.querySelector(".more-grid");if(more){const b=document.createElement("button");b.className="more-link";b.dataset.tab="inbox";b.innerHTML="<span>✦</span><div><strong>Executive Inbox</strong><small>Capture and organize anything</small></div>";more.prepend(b)}
  const style=document.createElement("style");style.textContent=`.inbox-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,.7fr);gap:16px}.inbox-input{min-height:140px;font-size:1.02rem}.inbox-examples{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}.inbox-preview{margin-top:14px}.inbox-plan-item{display:grid;grid-template-columns:auto 1fr;gap:12px;padding:13px 0;border-bottom:1px solid rgba(125,170,230,.12)}.inbox-plan-item:last-child{border-bottom:0}.inbox-type{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:rgba(87,139,225,.16);font-weight:700}.inbox-plan-meta{font-size:.78rem;color:var(--muted,#9eb1cc);margin-top:4px}.inbox-review-actions{display:flex;gap:8px;margin-top:14px}.inbox-history-item{padding:12px 0;border-bottom:1px solid rgba(125,170,230,.12)}.inbox-history-item:last-child{border-bottom:0}.inbox-history-item small{display:block;color:var(--muted,#9eb1cc);margin-top:4px}@media(max-width:760px){.inbox-layout{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
  document.getElementById("reviewInboxCapture").onclick=review;
  document.addEventListener("click",e=>{const ex=e.target.closest("[data-inbox-example]");if(ex)document.getElementById("executiveInboxInput").value=ex.dataset.inboxExample;const tab=e.target.closest("[data-tab]");if(tab?.dataset.tab==="inbox")setTimeout(showInbox,0)});
}

function showInbox(){document.querySelectorAll(".section").forEach(x=>x.classList.remove("active"));document.getElementById("inbox")?.classList.add("active");document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x.dataset.tab==="inbox"));window.scrollTo({top:0,behavior:"smooth"})}

function review(){const raw=document.getElementById("executiveInboxInput").value.trim();if(!raw)return;preview=classify(raw);renderPreview()}

function renderPreview(){const box=document.getElementById("inboxPreview");box.classList.remove("hidden");box.innerHTML=`<div class="eyebrow">Proposed filing plan</div><h3>Review before saving</h3>${preview.items.map((x,i)=>`<div class="inbox-plan-item"><div class="inbox-type">${esc(typeLabels[x.type].slice(0,1))}</div><div><strong>${esc(typeLabels[x.type])}: ${esc(x.title)}</strong><div class="inbox-plan-meta">${esc(areaLabels[x.area])}${x.at?` · ${new Date(x.at).toLocaleString()}`:""}${x.priority&&x.type==="task"?` · ${x.priority.toUpperCase()}`:""}</div><label class="task-meta"><input type="checkbox" data-inbox-item="${i}" checked> Create this item</label></div></div>`).join("")}<div class="inbox-review-actions"><button id="fileInboxCapture" class="btn">Approve & file</button><button id="cancelInboxCapture" class="btn secondary">Cancel</button></div>`;document.getElementById("fileInboxCapture").onclick=fileCapture;document.getElementById("cancelInboxCapture").onclick=()=>{preview=null;box.classList.add("hidden")}}

async function createEntity(item,relatedIds=[]){return sb.from("notes").insert({owner_id:session.user.id,workspace_id:workspaceId,title:item.title,body:JSON.stringify({type:item.type,area:item.area,summary:item.summary,status:item.status||"active",related_ids:relatedIds,next_action:item.type==="person"?"Review relationship and set next follow-up":"",event_at:item.at||null}),note_type:"executive_entity"}).select("id").single()}

async function fileCapture(){
  const selected=preview.items.filter((_,i)=>document.querySelector(`[data-inbox-item="${i}"]`)?.checked);if(!selected.length)return;
  const button=document.getElementById("fileInboxCapture");button.disabled=true;button.textContent="Filing…";
  let personId=null;const person=selected.find(x=>x.type==="person");if(person){const r=await createEntity(person);if(r.error){alert(r.error.message);button.disabled=false;return}personId=r.data?.id}
  for(const item of selected.filter(x=>x!==person)){
    let result;
    if(item.type==="task")result=await sb.from("tasks").insert({owner_id:session.user.id,workspace_id:ws(item.area),title:item.title,status:"planned",priority:item.priority||"p3",due_at:item.at,source:"executive_inbox",project_name:null});
    else if(item.type==="waiting")result=await sb.from("waiting_on").insert({owner_id:session.user.id,workspace_id:ws(item.area),person_or_company:item.person||"Unassigned",item:item.title,follow_up_at:item.at});
    else if(["project","decision","event","person"].includes(item.type))result=await createEntity(item,personId?[personId]:[]);
    else result=await sb.from("notes").insert({owner_id:session.user.id,workspace_id:workspaceId,title:item.title,body:item.summary,note_type:"general"});
    if(result.error){alert(result.error.message);button.disabled=false;button.textContent="Approve & file";return}
  }
  await sb.from("notes").insert({owner_id:session.user.id,workspace_id:workspaceId,title:preview.raw.slice(0,80),body:JSON.stringify({raw:preview.raw,created:selected.map(x=>({type:x.type,title:x.title,area:x.area})),filed_at:new Date().toISOString()}),note_type:"executive_inbox_capture"});
  document.getElementById("executiveInboxInput").value="";document.getElementById("inboxPreview").classList.add("hidden");preview=null;await loadHistory();window.dispatchEvent(new CustomEvent("executive-os:data-changed"));window.dispatchEvent(new CustomEvent("executive-os:sync"));
}

async function loadHistory(){if(!session?.user)return;const {data,error}=await sb.from("notes").select("*").eq("owner_id",session.user.id).eq("note_type","executive_inbox_capture").order("created_at",{ascending:false}).limit(12);if(error){console.error(error);return}inbox=(data||[]).map(row=>{try{return{id:row.id,title:row.title,...JSON.parse(row.body||"{}"),created_at:row.created_at}}catch{return null}}).filter(Boolean);document.getElementById("inboxHistory").innerHTML=inbox.length?inbox.map(x=>`<div class="inbox-history-item"><strong>${esc(x.raw)}</strong><small>${new Date(x.created_at).toLocaleString()} · ${(x.created||[]).map(i=>typeLabels[i.type]).join(", ")}</small></div>`).join(""):'<div class="empty">Your approved captures will appear here.</div>'}

async function start(){const {data:{session:s}}=await sb.auth.getSession();session=s;if(!session?.user)return;const {data,error}=await sb.from("workspaces").select("id,area");if(error){console.error(error);return}workspaces=data||[];workspaceId=ws("second_brain");install();await loadHistory()}
sb.auth.onAuthStateChange((_e,s)=>{session=s;if(s?.user)setTimeout(start,250)});
window.addEventListener("executive-os:sync",loadHistory);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
