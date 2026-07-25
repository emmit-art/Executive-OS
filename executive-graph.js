import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

const sb=createClient(
  "https://hnvvvdibncwlplweeuod.supabase.co",
  "sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1",
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}}
);

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const types={person:"Person",project:"Project",decision:"Decision",event:"Event"};
const areas={dom_con:"Dom Con",eli_global:"ELI Global",personal:"Personal"};
let session=null,workspaceId=null,entities=[],editingId=null;

function decode(row){
  try{return{id:row.id,name:row.title,...JSON.parse(row.body||"{}"),created_at:row.created_at,updated_at:row.updated_at}}
  catch{return null}
}
function encode(entity){
  return JSON.stringify({
    type:entity.type,
    area:entity.area,
    summary:entity.summary||"",
    status:entity.status||"active",
    related_ids:entity.related_ids||[],
    next_action:entity.next_action||"",
    event_at:entity.event_at||null
  });
}
function related(entity){return (entity.related_ids||[]).map(id=>entities.find(x=>x.id===id)).filter(Boolean)}

function install(){
  if(document.getElementById("graph"))return;
  const main=document.querySelector("main");
  if(!main)return;
  const section=document.createElement("section");
  section.id="graph";section.className="section";
  section.innerHTML=`
    <div class="page-title"><div class="eyebrow">Executive Graph · Foundation</div><h2>Connected operating memory</h2><p class="task-meta">Link the people, projects, decisions, and events that shape Dom Con, ELI Global, and your personal life.</p></div>
    <div class="graph-summary" id="graphSummary"></div>
    <div class="graph-layout">
      <div>
        <div class="card graph-filters"><button class="btn secondary compact active" data-graph-filter="all">All</button><button class="btn secondary compact" data-graph-filter="person">People</button><button class="btn secondary compact" data-graph-filter="project">Projects</button><button class="btn secondary compact" data-graph-filter="decision">Decisions</button><button class="btn secondary compact" data-graph-filter="event">Events</button></div>
        <div id="graphList"></div>
      </div>
      <div class="card graph-form">
        <div class="eyebrow" id="graphFormLabel">Add object</div><h3 id="graphFormHeading">Connect something important</h3>
        <input id="graphName" class="field" placeholder="Name or title">
        <select id="graphType" class="field"><option value="person">Person</option><option value="project">Project</option><option value="decision">Decision</option><option value="event">Event</option></select>
        <select id="graphArea" class="field"><option value="dom_con">Dom Con</option><option value="eli_global">ELI Global</option><option value="personal">Personal</option></select>
        <select id="graphStatus" class="field"><option value="active">Active</option><option value="waiting">Waiting</option><option value="at_risk">At risk</option><option value="complete">Complete</option></select>
        <input id="graphEventAt" class="field" type="datetime-local">
        <textarea id="graphSummaryInput" class="field" rows="4" placeholder="Context, history, or why this matters"></textarea>
        <input id="graphNextAction" class="field" placeholder="Recommended next action">
        <label class="task-meta">Connect to existing objects</label><select id="graphRelations" class="field" multiple size="6"></select>
        <div class="row"><button id="saveGraphObject" class="btn">Save</button><button id="cancelGraphEdit" class="btn secondary hidden">Cancel</button></div>
      </div>
    </div>`;
  main.appendChild(section);

  document.querySelectorAll(".desktop-nav").forEach(nav=>{const b=document.createElement("button");b.dataset.tab="graph";b.textContent="Graph";nav.appendChild(b)});
  const more=document.querySelector(".more-grid");if(more){const b=document.createElement("button");b.className="more-link";b.dataset.tab="graph";b.innerHTML="<span>⌘</span><div><strong>Executive Graph</strong><small>People, projects, decisions, events</small></div>";more.prepend(b)}

  const style=document.createElement("style");style.textContent=`
    .graph-layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(290px,.8fr);gap:16px}.graph-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.graph-stat,.graph-card{border:1px solid rgba(125,170,230,.16);background:rgba(8,25,50,.35);border-radius:17px}.graph-stat{padding:13px}.graph-stat strong,.graph-stat small{display:block}.graph-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.graph-card{padding:16px;margin-bottom:12px}.graph-card-head{display:flex;gap:12px;align-items:flex-start}.graph-card-head>div{flex:1}.graph-badge{font-size:.72rem;padding:5px 8px;border-radius:999px;background:rgba(87,139,225,.16)}.graph-links{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.graph-link{font-size:.72rem;padding:5px 8px;border-radius:999px;background:rgba(99,214,180,.12)}.graph-next{margin-top:10px;padding:10px;border-left:3px solid #63d6b4;background:rgba(99,214,180,.06)}.graph-actions{display:flex;gap:8px;margin-top:12px}.graph-form select[multiple]{min-height:130px}@media(max-width:760px){.graph-layout{grid-template-columns:1fr}.graph-summary{grid-template-columns:repeat(2,1fr)}}`;
  document.head.appendChild(style);

  document.getElementById("saveGraphObject").onclick=save;
  document.getElementById("cancelGraphEdit").onclick=reset;
  document.addEventListener("click",e=>{const tab=e.target.closest("[data-tab]");if(tab?.dataset.tab==="graph")setTimeout(()=>showGraph(),0);const filter=e.target.closest("[data-graph-filter]");if(filter){document.querySelectorAll("[data-graph-filter]").forEach(x=>x.classList.remove("active"));filter.classList.add("active");render(filter.dataset.graphFilter)}});
}

function showGraph(){document.querySelectorAll(".section").forEach(x=>x.classList.remove("active"));document.getElementById("graph")?.classList.add("active");document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x.dataset.tab==="graph"));window.scrollTo({top:0,behavior:"smooth"})}

function render(filter="all"){
  const visible=filter==="all"?entities:entities.filter(x=>x.type===filter);
  document.getElementById("graphSummary").innerHTML=Object.keys(types).map(type=>`<div class="graph-stat"><strong>${entities.filter(x=>x.type===type).length}</strong><small>${esc(types[type])}${type==="person"?"e":""}s</small></div>`).join("");
  document.getElementById("graphRelations").innerHTML=entities.filter(x=>x.id!==editingId).map(x=>`<option value="${x.id}">${esc(x.name)} · ${esc(types[x.type])}</option>`).join("");
  const list=document.getElementById("graphList");
  list.innerHTML=visible.length?visible.map(x=>{
    const links=related(x);
    return `<article class="graph-card"><div class="graph-card-head"><div><div class="eyebrow">${esc(areas[x.area])} · ${esc(types[x.type])}</div><h3>${esc(x.name)}</h3></div><span class="graph-badge">${esc((x.status||"active").replaceAll("_"," "))}</span></div>${x.summary?`<p class="task-meta">${esc(x.summary)}</p>`:""}${x.event_at?`<p class="task-meta">${new Date(x.event_at).toLocaleString()}</p>`:""}${links.length?`<div class="graph-links">${links.map(r=>`<span class="graph-link">${esc(r.name)}</span>`).join("")}</div>`:""}${x.next_action?`<div class="graph-next"><small>Next action</small><strong>${esc(x.next_action)}</strong></div>`:""}<div class="graph-actions"><button class="btn secondary compact" onclick="window.editGraphObject('${x.id}')">Edit</button><button class="danger-link" onclick="window.deleteGraphObject('${x.id}')">Delete</button></div></article>`
  }).join(""):'<div class="card task-meta">No connected objects yet. Add the first person, project, decision, or event.</div>';
}

async function load(){
  if(!session?.user)return;
  const [nr,wr]=await Promise.all([
    sb.from("notes").select("*").eq("owner_id",session.user.id).eq("note_type","executive_entity").order("updated_at",{ascending:false}),
    sb.from("workspaces").select("id,area").eq("area","second_brain").maybeSingle()
  ]);
  if(nr.error||wr.error){console.error(nr.error||wr.error);return}
  entities=(nr.data||[]).map(decode).filter(Boolean);
  workspaceId=wr.data?.id||null;
  render(document.querySelector("[data-graph-filter].active")?.dataset.graphFilter||"all");
}

function reset(){
  editingId=null;
  ["graphName","graphSummaryInput","graphNextAction","graphEventAt"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("graphType").value="person";document.getElementById("graphArea").value="dom_con";document.getElementById("graphStatus").value="active";
  [...document.getElementById("graphRelations").options].forEach(o=>o.selected=false);
  document.getElementById("saveGraphObject").textContent="Save";document.getElementById("cancelGraphEdit").classList.add("hidden");render();
}

async function save(){
  const name=document.getElementById("graphName").value.trim();if(!name)return;
  const entity={type:document.getElementById("graphType").value,area:document.getElementById("graphArea").value,status:document.getElementById("graphStatus").value,summary:document.getElementById("graphSummaryInput").value.trim(),next_action:document.getElementById("graphNextAction").value.trim(),event_at:document.getElementById("graphEventAt").value?new Date(document.getElementById("graphEventAt").value).toISOString():null,related_ids:[...document.getElementById("graphRelations").selectedOptions].map(o=>o.value)};
  const q=editingId?sb.from("notes").update({title:name,body:encode(entity)}).eq("id",editingId):sb.from("notes").insert({owner_id:session.user.id,workspace_id:workspaceId,title:name,body:encode(entity),note_type:"executive_entity"});
  const {error}=await q;if(error){alert(error.message);return}reset();await load();window.dispatchEvent(new CustomEvent("executive-os:data-changed"));
}

window.editGraphObject=id=>{const x=entities.find(e=>e.id===id);if(!x)return;editingId=id;document.getElementById("graphName").value=x.name;document.getElementById("graphType").value=x.type;document.getElementById("graphArea").value=x.area;document.getElementById("graphStatus").value=x.status||"active";document.getElementById("graphSummaryInput").value=x.summary||"";document.getElementById("graphNextAction").value=x.next_action||"";document.getElementById("graphEventAt").value=x.event_at?new Date(new Date(x.event_at).getTime()-new Date(x.event_at).getTimezoneOffset()*60000).toISOString().slice(0,16):"";render();[...document.getElementById("graphRelations").options].forEach(o=>o.selected=(x.related_ids||[]).includes(o.value));document.getElementById("saveGraphObject").textContent="Save Changes";document.getElementById("cancelGraphEdit").classList.remove("hidden");showGraph()};
window.deleteGraphObject=async id=>{if(!confirm("Delete this connected object?"))return;const {error}=await sb.from("notes").delete().eq("id",id);if(error)alert(error.message);else{entities=entities.map(x=>({...x,related_ids:(x.related_ids||[]).filter(r=>r!==id)}));await Promise.all(entities.filter(x=>(x.related_ids||[]).length).map(x=>sb.from("notes").update({body:encode(x)}).eq("id",x.id)));await load();window.dispatchEvent(new CustomEvent("executive-os:data-changed"))}};

async function start(){const {data:{session:s}}=await sb.auth.getSession();session=s;if(!session?.user)return;install();await load()}
sb.auth.onAuthStateChange((_e,s)=>{session=s;if(s?.user)setTimeout(start,250)});
window.addEventListener("executive-os:sync",load);
window.addEventListener("executive-os:data-changed",load);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();