import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const sb=createClient("https://hnvvvdibncwlplweeuod.supabase.co","sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const norm=s=>String(s||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const areaName=a=>({dom_con:"Dom Con",eli_global:"ELI Global",personal:"Personal",second_brain:"Second Brain"}[a]||a||"Personal");
const prettyDate=value=>value?new Date(value).toLocaleString([],{month:"short",day:"numeric",year:new Date(value).getFullYear()!==new Date().getFullYear()?"numeric":undefined,hour:"numeric",minute:"2-digit"}):null;
const statusOpen=s=>!["completed","cancelled","resolved","archived"].includes(String(s||"").toLowerCase());
let session=null,entities=[],links=[],objects=[],tasks=[],waiting=[];

async function upsertEntity(owner_id,entity_type,name,extra={}){
  if(!name)return null;
  const payload={owner_id,entity_type,name:String(name).trim(),normalized_name:norm(name),last_interaction_at:new Date().toISOString(),confidence:extra.confidence||0.85,workspace_id:extra.workspace_id||null,role:extra.role||null,relationship:extra.relationship||null,metadata:extra.metadata||{}};
  const{data,error}=await sb.from("memory_entities").upsert(payload,{onConflict:"owner_id,entity_type,normalized_name"}).select("id").single();
  if(error)throw error;return data?.id||null;
}
async function linkEntity(owner_id,source_type,source_id,target_entity_id,relationship_type,confidence=.85,metadata={}){
  if(!source_id||!target_entity_id)return;
  const{error}=await sb.from("memory_links").upsert({owner_id,source_type,source_id,target_entity_id,relationship_type,confidence,metadata},{onConflict:"owner_id,source_type,source_id,target_entity_id,relationship_type"});
  if(error)throw error;
}
async function rememberObject(o){
  const owner_id=o.owner_id,source_id=o.id,workspace_id=o.workspace_id;
  const existing=await sb.from("memory_links").select("id").eq("owner_id",owner_id).eq("source_type","executive_object").eq("source_id",source_id).limit(1);
  if(existing.data?.length)return;
  if(o.related_person){const id=await upsertEntity(owner_id,"person",o.related_person,{workspace_id,relationship:"contact",confidence:.92});await linkEntity(owner_id,"executive_object",source_id,id,"involves_person",.94)}
  if(o.subject){const id=await upsertEntity(owner_id,"topic",o.subject,{workspace_id,confidence:.82});await linkEntity(owner_id,"executive_object",source_id,id,"about_topic",.88)}
  if(workspace_id){const ws=await sb.from("workspaces").select("area").eq("id",workspace_id).maybeSingle();if(ws.data?.area){const id=await upsertEntity(owner_id,"organization",areaName(ws.data.area),{workspace_id,confidence:.98});await linkEntity(owner_id,"executive_object",source_id,id,"belongs_to",.98)}}
  if(o.object_type==="project"){const id=await upsertEntity(owner_id,"project",o.title,{workspace_id,confidence:.95,metadata:{goal:o.desired_outcome||o.summary||null}});await linkEntity(owner_id,"executive_object",source_id,id,"defines_project",.98)}
}
async function syncMemory(){
  if(!session?.user)return;
  const{data,error}=await sb.from("executive_objects").select("*").eq("owner_id",session.user.id).order("created_at",{ascending:false}).limit(200);
  if(error){console.error("Memory sync",error);return}
  for(const o of data||[]){try{await rememberObject(o)}catch(e){console.error("Remember object",e)}}
}
function installUI(){
  if(document.getElementById("memory"))return;
  const desktop=document.querySelector(".desktop-nav");if(desktop){const b=document.createElement("button");b.dataset.tab="memory";b.textContent="Memory";desktop.appendChild(b)}
  const more=document.querySelector("#more .more-grid");if(more){const b=document.createElement("button");b.className="more-link";b.dataset.tab="memory";b.innerHTML="<span>⌁</span><div><strong>Executive Memory</strong><small>People, projects, and history</small></div>";more.prepend(b)}
  const main=document.querySelector("main");const section=document.createElement("section");section.id="memory";section.className="section";section.innerHTML=`<div class="page-title"><div class="eyebrow">Executive Memory</div><h2>Everything connected</h2></div><div class="grid"><div class="card s12"><div class="memory-search-row"><input id="memorySearch" class="field" placeholder="Search a person, company, project, or topic"><button id="memorySearchBtn" class="btn">Search</button></div><div id="memorySummary" class="status">Search your connected memory.</div></div><div class="card s5"><div class="eyebrow">Known entities</div><div id="memoryEntities"></div></div><div class="card s7"><div class="eyebrow">Memory briefing</div><div id="memoryResults"></div></div></div>`;main.appendChild(section);
  document.querySelectorAll('[data-tab="memory"]').forEach(b=>b.addEventListener("click",switchMemory));document.getElementById("memorySearchBtn").onclick=searchMemory;document.getElementById("memorySearch").addEventListener("keydown",e=>{if(e.key==="Enter")searchMemory()});
  const style=document.createElement("style");style.textContent=`.memory-search-row{display:flex;gap:10px}.memory-search-row .field{flex:1}.memory-entity{padding:12px 0;border-bottom:1px solid rgba(130,160,200,.12)}.memory-entity:last-child{border-bottom:0}.memory-entity small{display:block;color:var(--muted,#9eb1cc);margin-top:3px}.memory-result{padding:16px;border:1px solid rgba(125,170,230,.18);border-radius:14px;margin:10px 0}.memory-result h3{margin:0 0 6px}.memory-subtle{color:var(--muted,#9eb1cc)}.memory-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:14px 0}.memory-stat{padding:10px;border-radius:10px;background:rgba(80,130,210,.08)}.memory-stat b{display:block;font-size:1.1rem}.memory-section{margin-top:16px}.memory-section h4{margin:0 0 8px;font-size:.72rem;letter-spacing:.13em;text-transform:uppercase;color:#a9c7f7}.memory-tags{display:flex;gap:6px;flex-wrap:wrap}.memory-tags span{font-size:.72rem;padding:5px 8px;border-radius:999px;background:rgba(80,130,210,.12);color:#b9d4ff}.memory-timeline{display:grid;gap:8px}.memory-event{display:grid;grid-template-columns:86px 1fr;gap:10px;padding:8px 0;border-bottom:1px solid rgba(125,170,230,.1)}.memory-event:last-child{border-bottom:0}.memory-event time{font-size:.72rem;color:var(--muted,#9eb1cc)}.memory-confidence summary{cursor:pointer;color:#b9d4ff}.memory-confidence div{margin-top:8px;padding:10px;border-radius:10px;background:rgba(80,130,210,.08);color:var(--muted,#9eb1cc)}@media(max-width:600px){.memory-search-row{flex-direction:column}.memory-stats{grid-template-columns:1fr 1fr}.memory-event{grid-template-columns:72px 1fr}}`;document.head.appendChild(style);
}
function switchMemory(){document.querySelectorAll(".section").forEach(x=>x.classList.remove("active"));document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x.dataset.tab==="memory"));document.getElementById("memory")?.classList.add("active");window.scrollTo({top:0,behavior:"smooth"});loadMemory()}
async function loadMemory(){
  if(!session?.user)return;
  const results=await Promise.all([sb.from("memory_entities").select("*").eq("owner_id",session.user.id).order("last_interaction_at",{ascending:false}),sb.from("memory_links").select("*").eq("owner_id",session.user.id),sb.from("executive_objects").select("*").eq("owner_id",session.user.id).order("created_at",{ascending:false}),sb.from("tasks").select("*").eq("owner_id",session.user.id).neq("status","cancelled"),sb.from("waiting_on").select("*").eq("owner_id",session.user.id).is("resolved_at",null)]);
  entities=results[0].data||[];links=results[1].data||[];objects=results[2].data||[];tasks=results[3].data||[];waiting=results[4].data||[];
  const box=document.getElementById("memoryEntities");if(box)box.innerHTML=entities.length?entities.slice(0,12).map(e=>`<div class="memory-entity"><strong>${esc(e.name)}</strong><small>${esc(e.entity_type)} · ${Math.round(Number(e.confidence||0)*100)}% confidence</small></div>`).join(""):"<div class='empty'>Memory builds as you use Executive.</div>";
  const summary=document.getElementById("memorySummary");if(summary)summary.textContent=`${entities.length} entities · ${links.length} connections · ${objects.length} executive objects`;
}
function uniqueObjects(list){const seen=new Set();return list.filter(o=>{const key=`${o.object_type}|${norm(o.title)}`;if(seen.has(key))return false;seen.add(key);return true})}
function entityConnections(entity,related){
  const relatedIds=new Set(related.map(o=>o.id));const linkedEntityIds=new Set(links.filter(l=>l.source_type==="executive_object"&&relatedIds.has(l.source_id)&&l.target_entity_id!==entity.id).map(l=>l.target_entity_id));return entities.filter(x=>linkedEntityIds.has(x.id));
}
function confidenceExplanation(entity,related,connected){
  const reasons=[];if(related.length)reasons.push(`Mentioned in ${related.length} connected executive object${related.length===1?"":"s"}.`);if(entity.entity_type==="person")reasons.push("Parsed as a named person in an action.");if(connected.length)reasons.push(`Connected to ${connected.length} other remembered entit${connected.length===1?"y":"ies"}.`);if(Number(entity.confidence)>=.9)reasons.push("No competing match was detected when this memory was created.");return reasons.length?reasons:["This confidence comes from the original language parser and available relationship evidence."];
}
function timelineFor(related,taskMatches,waitMatches){
  const events=[];related.forEach(o=>events.push({at:o.created_at,label:`${o.object_type}: ${o.title}`,detail:o.reason||null}));taskMatches.forEach(t=>{if(t.reminder_at)events.push({at:t.reminder_at,label:`Reminder: ${t.title}`});if(t.due_at)events.push({at:t.due_at,label:`Due: ${t.title}`});if(t.scheduled_start)events.push({at:t.scheduled_start,label:`Start: ${t.title}`})});waitMatches.forEach(w=>events.push({at:w.follow_up_at||w.created_at,label:`Waiting on: ${w.person_or_company||"response"}`,detail:w.item||null}));const seen=new Set();return events.filter(e=>e.at).sort((a,b)=>new Date(b.at)-new Date(a.at)).filter(e=>{const k=`${e.at}|${norm(e.label)}`;if(seen.has(k))return false;seen.add(k);return true}).slice(0,8);
}
async function searchMemory(){
  await loadMemory();const q=norm(document.getElementById("memorySearch")?.value),out=document.getElementById("memoryResults");if(!q){out.innerHTML="<div class='empty'>Enter a name, project, company, or topic.</div>";return}
  const matched=entities.filter(e=>e.normalized_name.includes(q)||q.includes(e.normalized_name));if(!matched.length){out.innerHTML=`<div class="empty">No connected memory found for “${esc(q)}” yet.</div>`;return}
  out.innerHTML=matched.map(e=>{
    const entityLinks=links.filter(l=>l.target_entity_id===e.id),ids=new Set(entityLinks.filter(l=>l.source_type==="executive_object").map(l=>l.source_id));
    const allRelated=objects.filter(o=>ids.has(o.id)),related=uniqueObjects(allRelated),open=related.filter(o=>statusOpen(o.status));
    const taskMatches=tasks.filter(t=>norm(t.related_person)===e.normalized_name||norm(t.title).includes(e.normalized_name));const waitMatches=waiting.filter(w=>norm(w.person_or_company)===e.normalized_name||norm(w.item).includes(e.normalized_name));
    const next=taskMatches.filter(t=>statusOpen(t.status)).sort((a,b)=>(Number(b.ai_priority_score)||0)-(Number(a.ai_priority_score)||0))[0]||open[0];const connected=entityConnections(e,related);const orgs=connected.filter(x=>x.entity_type==="organization"),projects=connected.filter(x=>x.entity_type==="project"),topics=connected.filter(x=>x.entity_type==="topic");const timeline=timelineFor(related,taskMatches,waitMatches);const explanations=confidenceExplanation(e,related,connected);
    return `<div class="memory-result"><h3>${esc(e.name)}</h3><div class="memory-subtle">${esc(e.entity_type)}${e.role?` · ${esc(e.role)}`:""}${e.relationship?` · ${esc(e.relationship)}`:""}</div><div class="memory-stats"><div class="memory-stat"><b>${open.length}</b><span>Open connected</span></div><div class="memory-stat"><b>${waitMatches.length}</b><span>Waiting items</span></div></div>${orgs.length?`<p><b>Organization:</b> ${orgs.map(x=>esc(x.name)).join(", ")}</p>`:""}${projects.length?`<p><b>Active projects:</b> ${projects.map(x=>esc(x.name)).join(", ")}</p>`:""}${next?`<p><b>Recommended next action:</b> ${esc(next.title)}</p>`:""}<div class="memory-section"><h4>Connections</h4><div class="memory-tags">${[...orgs,...projects,...topics].slice(0,8).map(x=>`<span>${esc(x.entity_type)}: ${esc(x.name)}</span>`).join("")||"<span>No additional connections yet</span>"}</div></div><div class="memory-section"><h4>Timeline</h4><div class="memory-timeline">${timeline.map(x=>`<div class="memory-event"><time>${esc(prettyDate(x.at))}</time><div><b>${esc(x.label)}</b>${x.detail?`<div class="memory-subtle">${esc(x.detail)}</div>`:""}</div></div>`).join("")||"<div class='empty'>No dated interactions yet.</div>"}</div></div><div class="memory-section"><details class="memory-confidence"><summary>${Math.round(Number(e.confidence||0)*100)}% confidence — why?</summary><div>${explanations.map(x=>`<p>${esc(x)}</p>`).join("")}</div></details></div></div>`
  }).join("")
}
async function start(){const{data:{session:s}}=await sb.auth.getSession();session=s;if(!session?.user)return;installUI();await syncMemory();await loadMemory();setInterval(syncMemory,45000)}
sb.auth.onAuthStateChange((_e,s)=>{session=s;if(s?.user)setTimeout(start,250)});if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();