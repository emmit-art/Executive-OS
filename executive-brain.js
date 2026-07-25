import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

const sb=createClient(
  "https://hnvvvdibncwlplweeuod.supabase.co",
  "sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1",
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}}
);

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const areaLabels={dom_con:"Dom Con",eli_global:"ELI Global",personal:"Personal",second_brain:"Second Brain"};
let session=null,rows=[],lastQuestion="";

function decodeNote(n){
  if(["executive_entity","kpi_metric"].includes(n.note_type)){
    try{return{...n,parsed:JSON.parse(n.body||"{}")}}catch{return{...n,parsed:{}}}
  }
  return n;
}

function install(){
  if(document.getElementById("brain"))return;
  const main=document.querySelector("main");if(!main)return;
  const section=document.createElement("section");section.id="brain";section.className="section";
  section.innerHTML=`
    <div class="page-title"><div class="eyebrow">Executive Brain · Grounded Intelligence</div><h2>Ask your operating system</h2><p class="task-meta">Search across tasks, people, projects, decisions, events, follow-ups, notes, calendar items, and KPIs.</p></div>
    <div class="brain-layout">
      <div class="card brain-ask">
        <textarea id="brainQuestion" class="field" rows="4" placeholder="Examples: What needs my attention? What do I know about Mike? What is at risk in Dom Con? What should I do next?"></textarea>
        <div class="brain-prompts"><button class="btn secondary compact" data-brain-prompt="What needs my attention today?">Attention</button><button class="btn secondary compact" data-brain-prompt="What is at risk in Dom Con?">Dom Con risks</button><button class="btn secondary compact" data-brain-prompt="What should I work on next?">Next move</button><button class="btn secondary compact" data-brain-prompt="What am I waiting on?">Waiting on</button></div>
        <button id="askBrain" class="btn full">Ask Executive Brain</button>
      </div>
      <div id="brainAnswer" class="card brain-answer"><div class="empty">Ask a question to generate a grounded executive answer.</div></div>
    </div>
    <div class="card brain-memory"><div class="section-head"><div><div class="eyebrow">Memory Index</div><h3>What the Brain can currently see</h3></div><button id="refreshBrain" class="btn secondary compact">Refresh</button></div><div id="brainIndex" class="brain-index"></div></div>`;
  main.appendChild(section);
  document.querySelectorAll(".desktop-nav").forEach(nav=>{const b=document.createElement("button");b.dataset.tab="brain";b.textContent="Brain";nav.appendChild(b)});
  const more=document.querySelector(".more-grid");if(more){const b=document.createElement("button");b.className="more-link";b.dataset.tab="brain";b.innerHTML="<span>✦</span><div><strong>Executive Brain</strong><small>Ask across everything</small></div>";more.prepend(b)}
  const style=document.createElement("style");style.textContent=`
    .brain-layout{display:grid;grid-template-columns:minmax(300px,.8fr) minmax(0,1.4fr);gap:16px;margin-bottom:16px}.brain-ask textarea{min-height:125px}.brain-prompts{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.brain-answer{min-height:290px}.brain-answer h3{margin:0 0 10px}.brain-answer ul{padding-left:20px}.brain-answer li{margin:8px 0}.brain-source{border-top:1px solid rgba(125,170,230,.12);padding:10px 0}.brain-source:first-child{border-top:0}.brain-source small{display:block;color:var(--muted,#9eb1cc);margin-top:4px}.brain-index{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.brain-index div{padding:13px;border:1px solid rgba(125,170,230,.16);border-radius:15px;background:rgba(8,25,50,.35)}.brain-index strong,.brain-index small{display:block}@media(max-width:760px){.brain-layout{grid-template-columns:1fr}.brain-index{grid-template-columns:repeat(2,1fr)}}`;
  document.head.appendChild(style);
  document.getElementById("askBrain").onclick=answer;
  document.getElementById("refreshBrain").onclick=load;
  document.querySelectorAll("[data-brain-prompt]").forEach(b=>b.onclick=()=>{document.getElementById("brainQuestion").value=b.dataset.brainPrompt;answer()});
  document.addEventListener("click",e=>{const tab=e.target.closest("[data-tab]");if(tab?.dataset.tab==="brain")setTimeout(showBrain,0)});
}

function showBrain(){document.querySelectorAll(".section").forEach(x=>x.classList.remove("active"));document.getElementById("brain")?.classList.add("active");document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x.dataset.tab==="brain"));window.scrollTo({top:0,behavior:"smooth"})}

function searchable(r){return [r.kind,r.title,r.body,r.area,r.status,r.person,r.item,r.location,r.parsed?.type,r.parsed?.area,r.parsed?.summary,r.parsed?.next_action,r.parsed?.notes].filter(Boolean).join(" ").toLowerCase()}
function score(r,tokens){const text=searchable(r);let s=0;tokens.forEach(t=>{if(text.includes(t))s+=text.startsWith(t)?4:2});if(r.status==="overdue"||r.status==="at_risk")s+=3;return s}

function synthesize(question,matches){
  const q=question.toLowerCase(),now=new Date();
  const overdue=rows.filter(r=>r.kind==="Task"&&r.due_at&&new Date(r.due_at)<now&&!['completed','cancelled'].includes(r.status));
  const waiting=rows.filter(r=>r.kind==="Follow-up");
  const risks=rows.filter(r=>r.status==="at_risk"||r.status==="Needs attention"||r.status==="overdue");
  if(q.includes("what should i")||q.includes("next")){
    const tasks=rows.filter(r=>r.kind==="Task"&&!['completed','cancelled'].includes(r.status)).sort((a,b)=>((b.priority==="p1")-(a.priority==="p1"))||new Date(a.due_at||"2999")-new Date(b.due_at||"2999"));
    if(!tasks.length)return{headline:"No urgent task is currently recorded",summary:"Your active task list is clear. Use the open capacity for strategic work or capture the next important outcome.",items:[]};
    return{headline:`Start with ${tasks[0].title}`,summary:"This is the strongest recorded combination of priority and urgency.",items:tasks.slice(0,5)};
  }
  if(q.includes("attention")||q.includes("risk")){
    const items=[...overdue,...risks.filter(x=>!overdue.some(o=>o.id===x.id)),...waiting.filter(x=>x.follow_up_at&&new Date(x.follow_up_at)<now)].slice(0,8);
    return{headline:items.length?`${items.length} items deserve attention`:"Nothing critical is currently flagged",summary:`${overdue.length} overdue task${overdue.length===1?"":"s"}, ${waiting.length} open follow-up${waiting.length===1?"":"s"}, and ${risks.length} explicitly flagged risk${risks.length===1?"":"s"}.`,items};
  }
  if(q.includes("waiting"))return{headline:`You are waiting on ${waiting.length} item${waiting.length===1?"":"s"}`,summary:"These are the unresolved follow-ups currently stored in Executive OS.",items:waiting.slice(0,10)};
  return{headline:matches.length?`I found ${matches.length} relevant record${matches.length===1?"":"s"}`:"I could not find a grounded match",summary:matches.length?"These are the most relevant records currently stored in Executive OS.":"Try using a person, project, company, task, decision, KPI, or date that already exists in the system.",items:matches.slice(0,10)};
}

function answer(){
  const question=document.getElementById("brainQuestion").value.trim();if(!question)return;lastQuestion=question;
  const tokens=question.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(x=>x.length>2&&!['what','when','where','which','about','should','could','would','have','with','from','that','this'].includes(x));
  const matches=rows.map(r=>({r,s:score(r,tokens)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.r);
  const result=synthesize(question,matches);
  document.getElementById("brainAnswer").innerHTML=`<div class="eyebrow">Grounded answer</div><h3>${esc(result.headline)}</h3><p class="task-meta">${esc(result.summary)}</p>${result.items.length?result.items.map(r=>`<div class="brain-source"><strong>${esc(r.title||r.item||r.person||"Untitled")}</strong><small>${esc(r.kind)}${r.area?` · ${esc(areaLabels[r.area]||r.area)}`:""}${r.status?` · ${esc(String(r.status).replaceAll("_"," "))}`:""}${r.due_at?` · ${new Date(r.due_at).toLocaleString()}`:""}</small>${r.body?`<small>${esc(String(r.body).slice(0,220))}</small>`:""}</div>`).join(""):""}<p class="task-meta">Answer based only on records currently stored in Executive OS.</p>`;
}

async function load(){
  if(!session?.user)return;
  const [workspaces,tasks,waiting,notes,calendar]=await Promise.all([
    sb.from("workspaces").select("id,area"),
    sb.from("tasks").select("*").eq("owner_id",session.user.id),
    sb.from("waiting_on").select("*").eq("owner_id",session.user.id).is("resolved_at",null),
    sb.from("notes").select("*").eq("owner_id",session.user.id),
    sb.from("calendar_events_cache").select("*").eq("owner_id",session.user.id).order("starts_at")
  ]);
  const failed=[workspaces,tasks,waiting,notes,calendar].find(x=>x.error);if(failed){console.error(failed.error);return}
  const areaByWorkspace=Object.fromEntries((workspaces.data||[]).map(w=>[w.id,w.area]));
  rows=[
    ...(tasks.data||[]).map(t=>({...t,kind:"Task",area:areaByWorkspace[t.workspace_id],body:t.project_name||""})),
    ...(waiting.data||[]).map(w=>({...w,kind:"Follow-up",title:w.item,body:w.person_or_company,person:w.person_or_company,area:areaByWorkspace[w.workspace_id]})),
    ...(notes.data||[]).map(decodeNote).map(n=>({...n,kind:n.note_type==="executive_entity"?(n.parsed?.type||"Entity"):n.note_type==="kpi_metric"?"KPI":"Note",area:n.parsed?.area||areaByWorkspace[n.workspace_id],status:n.parsed?.status,body:n.parsed?.summary||n.body})),
    ...(calendar.data||[]).map(e=>({...e,kind:"Calendar",title:e.title,body:e.location||"",due_at:e.starts_at,area:"personal"}))
  ];
  const counts={Task:rows.filter(r=>r.kind==="Task").length,"Graph objects":rows.filter(r=>["person","project","decision","event"].includes(r.kind)).length,Notes:rows.filter(r=>r.kind==="Note").length,"Calendar & follow-ups":rows.filter(r=>["Calendar","Follow-up"].includes(r.kind)).length};
  document.getElementById("brainIndex").innerHTML=Object.entries(counts).map(([k,v])=>`<div><strong>${v}</strong><small>${esc(k)}</small></div>`).join("");
  if(lastQuestion)answer();
}

async function start(){const{data:{session:s}}=await sb.auth.getSession();session=s;if(!session?.user)return;install();await load()}
sb.auth.onAuthStateChange((_e,s)=>{session=s;if(s?.user)setTimeout(start,250)});
window.addEventListener("executive-os:sync",load);
window.addEventListener("executive-os:data-changed",load);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
