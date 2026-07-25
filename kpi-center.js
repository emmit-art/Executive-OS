import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

const sb=createClient(
  "https://hnvvvdibncwlplweeuod.supabase.co",
  "sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1",
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}}
);

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const allowedAreas=new Set(["dom_con","eli_global","personal"]);
const areaLabel=a=>({dom_con:"Dom Con",eli_global:"ELI Global",personal:"Personal"}[a]||a);
const fmtDate=d=>new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(new Date(d));

let session=null,metrics=[],snapshots=[],workspaceId=null,editingId=null;

const decodeMetric=n=>{try{return{id:n.id,title:n.title,...JSON.parse(n.body||"{}"),created_at:n.created_at,updated_at:n.updated_at}}catch{return null}};
const decodeSnapshot=n=>{try{return{id:n.id,metric_id:n.title,...JSON.parse(n.body||"{}"),created_at:n.created_at}}catch{return null}};
const encodeMetric=m=>JSON.stringify({area:m.area,unit:m.unit,current:Number(m.current)||0,target:Number(m.target)||0,direction:m.direction||"higher",period:m.period||"monthly",notes:m.notes||""});
const encodeSnapshot=s=>JSON.stringify({value:Number(s.value)||0,area:s.area,unit:s.unit||"",recorded_at:s.recorded_at||new Date().toISOString()});

function historyFor(metric){
  const rows=snapshots.filter(s=>s.metric_id===metric.id).sort((a,b)=>new Date(a.recorded_at||a.created_at)-new Date(b.recorded_at||b.created_at));
  if(!rows.length||Number(rows.at(-1)?.value)!==Number(metric.current)) rows.push({metric_id:metric.id,value:Number(metric.current)||0,recorded_at:metric.updated_at||metric.created_at});
  return rows;
}

function status(metric){
  if(!metric.target)return"Tracking";
  const good=metric.direction==="lower"?metric.current<=metric.target:metric.current>=metric.target;
  return good?"On target":"Needs attention";
}

function progress(metric){
  if(!metric.target)return 0;
  const p=metric.direction==="lower"?(metric.target/Math.max(metric.current,.0001))*100:(metric.current/metric.target)*100;
  return Math.max(0,Math.min(100,Math.round(p)));
}

function trend(metric){
  const h=historyFor(metric);
  if(h.length<2)return{delta:0,pct:0,direction:"flat",label:"No trend yet"};
  const previous=Number(h.at(-2).value)||0,current=Number(h.at(-1).value)||0,delta=current-previous;
  const pct=previous===0?0:(delta/Math.abs(previous))*100;
  const direction=delta>0?"up":delta<0?"down":"flat";
  return{delta,pct,direction,label:`${Math.abs(pct).toFixed(1)}% ${direction==="up"?"up":direction==="down"?"down":"unchanged"} from last update`};
}

function forecast(metric){
  const h=historyFor(metric);
  if(h.length<2)return null;
  const recent=h.slice(-6),first=Number(recent[0].value)||0,last=Number(recent.at(-1).value)||0;
  const avgChange=(last-first)/Math.max(1,recent.length-1);
  const projected=last+avgChange;
  const willHit=metric.target?(metric.direction==="lower"?projected<=metric.target:projected>=metric.target):null;
  return{projected,willHit,avgChange};
}

function insight(metric){
  const t=trend(metric),f=forecast(metric),better=metric.direction==="lower"?t.delta<0:t.delta>0;
  if(historyFor(metric).length<2)return"Add another update to begin trend analysis and forecasting.";
  if(status(metric)==="On target"&&better)return`${metric.title} is on target and continuing to improve.`;
  if(status(metric)==="On target")return`${metric.title} remains on target, but the latest movement should be watched.`;
  if(f?.willHit)return`${metric.title} is below target now, but the current pace projects it to recover next period.`;
  if(better)return`${metric.title} is improving, but it has not reached target yet.`;
  return`${metric.title} is moving away from target and needs attention.`;
}

function sparkline(metric){
  const values=historyFor(metric).slice(-10).map(x=>Number(x.value)||0);
  if(values.length<2)return'<div class="kpi-spark-empty">Trend begins after the next update</div>';
  const min=Math.min(...values),max=Math.max(...values),range=max-min||1;
  const points=values.map((v,i)=>`${(i/(values.length-1))*100},${34-((v-min)/range)*28}`).join(" ");
  return`<svg class="kpi-spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-label="Recent KPI trend"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>`;
}

function install(){
  const section=document.getElementById("analytics");
  if(!section||section.dataset.kpiCenter)return;
  section.dataset.kpiCenter="true";
  section.innerHTML=`<div class="page-title"><div class="eyebrow">Performance Intelligence · Phase 5.2</div><h2>KPI Trends & Forecasting</h2><p class="task-meta">Historical performance, direction, forecasts, and executive insights for Dom Con, ELI Global, and your personal priorities.</p></div><div id="kpiSummary" class="kpi-summary"></div><div id="kpiInsights" class="card kpi-insights"></div><div class="kpi-layout"><div id="kpiList"></div><div class="card kpi-form"><div class="eyebrow" id="kpiFormLabel">Add KPI</div><h3 id="kpiFormHeading">Define the metric</h3><input id="kpiTitle" class="field" placeholder="Metric name"><select id="kpiArea" class="field"><option value="dom_con">Dom Con</option><option value="eli_global">ELI Global</option><option value="personal">Personal</option></select><div class="kpi-two"><input id="kpiCurrent" class="field" type="number" step="any" placeholder="Current"><input id="kpiTarget" class="field" type="number" step="any" placeholder="Target"></div><input id="kpiUnit" class="field" placeholder="Unit: %, $, hours, jobs"><select id="kpiDirection" class="field"><option value="higher">Higher is better</option><option value="lower">Lower is better</option></select><select id="kpiPeriod" class="field"><option value="weekly">Weekly</option><option value="monthly" selected>Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select><textarea id="kpiNotes" class="field" rows="3" placeholder="Definition or calculation notes"></textarea><div class="kpi-actions"><button id="saveKpi" class="btn full">Save KPI</button><button id="cancelKpiEdit" class="btn secondary hidden">Cancel</button></div></div></div>`;
  const style=document.createElement("style");
  style.textContent=`.kpi-layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(280px,.8fr);gap:16px}.kpi-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.kpi-stat,.kpi-card{border:1px solid rgba(125,170,230,.16);background:rgba(8,25,50,.35);border-radius:17px}.kpi-stat{padding:13px}.kpi-stat strong,.kpi-stat small{display:block}.kpi-insights{margin-bottom:16px}.kpi-insights h3{margin-top:4px}.kpi-insight-row{padding:10px 0;border-top:1px solid rgba(125,170,230,.12)}.kpi-insight-row:first-of-type{border-top:0}.kpi-card{padding:16px;margin-bottom:12px}.kpi-head{display:flex;gap:12px;align-items:flex-start}.kpi-head>div{flex:1}.kpi-badge{font-size:.72rem;padding:5px 8px;border-radius:999px;background:rgba(87,139,225,.16)}.kpi-value{font-size:1.8rem;font-weight:700;margin:12px 0 3px}.kpi-meta{font-size:.78rem;color:var(--muted,#9eb1cc)}.kpi-trend{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:8px}.kpi-trend.up{color:#63d6b4}.kpi-trend.down{color:#ff8b8b}.kpi-trend.flat{color:var(--muted,#9eb1cc)}.kpi-bar{height:9px;border-radius:99px;background:rgba(125,170,230,.12);overflow:hidden;margin:12px 0}.kpi-bar span{display:block;height:100%;background:linear-gradient(90deg,#4d8df7,#63d6b4)}.kpi-spark{width:100%;height:52px;margin:8px 0;color:#68a2ff}.kpi-spark-empty{height:52px;display:flex;align-items:center;font-size:.78rem;color:var(--muted,#9eb1cc)}.kpi-forecast{padding:10px 12px;border-radius:12px;background:rgba(87,139,225,.09);margin:10px 0}.kpi-history{font-size:.72rem;color:var(--muted,#9eb1cc);margin-bottom:10px}.kpi-card-actions,.kpi-actions,.kpi-two{display:flex;gap:8px}.kpi-two>*{flex:1}@media(max-width:760px){.kpi-layout{grid-template-columns:1fr}.kpi-summary{grid-template-columns:repeat(2,1fr)}}`;
  document.head.appendChild(style);
  document.getElementById("saveKpi").onclick=save;
  document.getElementById("cancelKpiEdit").onclick=reset;
}

function render(){
  const on=metrics.filter(m=>status(m)==="On target").length;
  const attention=metrics.filter(m=>status(m)==="Needs attention").length;
  const improving=metrics.filter(m=>{const t=trend(m);return m.direction==="lower"?t.delta<0:t.delta>0}).length;
  document.getElementById("kpiSummary").innerHTML=[[metrics.length,"Tracked KPIs"],[on,"On target"],[attention,"Need attention"],[improving,"Improving"]].map(([v,l])=>`<div class="kpi-stat"><strong>${v}</strong><small>${l}</small></div>`).join("");

  const priority=[...metrics].sort((a,b)=>(status(a)==="Needs attention"?-1:1)-(status(b)==="Needs attention"?-1:1)).slice(0,3);
  document.getElementById("kpiInsights").innerHTML=`<div class="eyebrow">Executive Intelligence</div><h3>What the numbers are saying</h3>${priority.length?priority.map(m=>`<div class="kpi-insight-row"><strong>${esc(areaLabel(m.area))} · ${esc(m.title)}</strong><div class="kpi-meta">${esc(insight(m))}</div></div>`).join(""):'<p class="kpi-meta">Add your first KPI to begin executive analysis.</p>'}`;

  const list=document.getElementById("kpiList");
  list.innerHTML=metrics.length?metrics.map(m=>{
    const t=trend(m),f=forecast(m),h=historyFor(m);
    const arrow=t.direction==="up"?"▲":t.direction==="down"?"▼":"•";
    return`<article class="kpi-card"><div class="kpi-head"><div><div class="eyebrow">${esc(areaLabel(m.area))} · ${esc(m.period)}</div><h3>${esc(m.title)}</h3></div><span class="kpi-badge">${esc(status(m))}</span></div><div class="kpi-value">${esc(m.current)}${m.unit?` ${esc(m.unit)}`:""}</div><div class="kpi-meta">Target: ${esc(m.target)}${m.unit?` ${esc(m.unit)}`:""} · ${m.direction==="lower"?"Lower is better":"Higher is better"}</div><div class="kpi-trend ${t.direction}"><strong>${arrow} ${esc(t.label)}</strong><span>${h.length} update${h.length===1?"":"s"}</span></div>${sparkline(m)}<div class="kpi-bar"><span style="width:${progress(m)}%"></span></div>${f?`<div class="kpi-forecast"><strong>Next-period forecast: ${esc(f.projected.toFixed(1))}${m.unit?` ${esc(m.unit)}`:""}</strong><div class="kpi-meta">${f.willHit===null?"Forecast based on recent updates.":f.willHit?"Current pace is projected to meet the target.":"Current pace is projected to miss the target."}</div></div>`:""}<div class="kpi-history">Latest recorded ${esc(fmtDate(h.at(-1).recorded_at||h.at(-1).created_at))}</div>${m.notes?`<div class="kpi-meta">${esc(m.notes)}</div>`:""}<div class="kpi-card-actions"><button class="btn secondary compact" onclick="window.editKpi('${m.id}')">Update</button><button class="danger-link" onclick="window.deleteKpi('${m.id}')">Delete</button></div></article>`;
  }).join(""):'<div class="card kpi-meta">No KPIs yet. Add the first number you review every week.</div>';
}

async function load(){
  if(!session?.user)return;
  const[nr,sr,wr]=await Promise.all([
    sb.from("notes").select("*").eq("owner_id",session.user.id).eq("note_type","kpi_metric").order("created_at",{ascending:false}),
    sb.from("notes").select("*").eq("owner_id",session.user.id).eq("note_type","kpi_snapshot").order("created_at",{ascending:true}),
    sb.from("workspaces").select("id,area").eq("area","second_brain").maybeSingle()
  ]);
  if(nr.error||sr.error||wr.error){console.error(nr.error||sr.error||wr.error);return}
  metrics=(nr.data||[]).map(decodeMetric).filter(m=>m&&allowedAreas.has(m.area));
  snapshots=(sr.data||[]).map(decodeSnapshot).filter(Boolean);
  workspaceId=wr.data?.id||null;
  render();
}

function reset(){
  editingId=null;
  ["kpiTitle","kpiCurrent","kpiTarget","kpiUnit","kpiNotes"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("kpiArea").value="dom_con";
  document.getElementById("kpiDirection").value="higher";
  document.getElementById("kpiPeriod").value="monthly";
  document.getElementById("saveKpi").textContent="Save KPI";
  document.getElementById("cancelKpiEdit").classList.add("hidden");
}

async function createSnapshot(metricId,metric){
  const{error}=await sb.from("notes").insert({owner_id:session.user.id,workspace_id:workspaceId,title:metricId,body:encodeSnapshot({value:metric.current,area:metric.area,unit:metric.unit}),note_type:"kpi_snapshot"});
  if(error)throw error;
}

async function save(){
  const title=document.getElementById("kpiTitle").value.trim();
  if(!title)return;
  const metric={area:document.getElementById("kpiArea").value,current:Number(document.getElementById("kpiCurrent").value)||0,target:Number(document.getElementById("kpiTarget").value)||0,unit:document.getElementById("kpiUnit").value.trim(),direction:document.getElementById("kpiDirection").value,period:document.getElementById("kpiPeriod").value,notes:document.getElementById("kpiNotes").value.trim()};
  if(!allowedAreas.has(metric.area))return;
  try{
    if(editingId){
      const existing=metrics.find(m=>m.id===editingId);
      const{error}=await sb.from("notes").update({title,body:encodeMetric(metric)}).eq("id",editingId);
      if(error)throw error;
      if(!existing||Number(existing.current)!==Number(metric.current))await createSnapshot(editingId,metric);
    }else{
      const{data,error}=await sb.from("notes").insert({owner_id:session.user.id,workspace_id:workspaceId,title,body:encodeMetric(metric),note_type:"kpi_metric"}).select("id").single();
      if(error)throw error;
      await createSnapshot(data.id,metric);
    }
    reset();
    await load();
    window.dispatchEvent(new CustomEvent("executive-os:data-changed"));
  }catch(error){alert(error.message||"Unable to save KPI")}
}

window.editKpi=id=>{
  const m=metrics.find(x=>x.id===id);if(!m)return;
  editingId=id;
  document.getElementById("kpiTitle").value=m.title;
  document.getElementById("kpiArea").value=m.area;
  document.getElementById("kpiCurrent").value=m.current;
  document.getElementById("kpiTarget").value=m.target;
  document.getElementById("kpiUnit").value=m.unit||"";
  document.getElementById("kpiDirection").value=m.direction||"higher";
  document.getElementById("kpiPeriod").value=m.period||"monthly";
  document.getElementById("kpiNotes").value=m.notes||"";
  document.getElementById("saveKpi").textContent="Save Update";
  document.getElementById("cancelKpiEdit").classList.remove("hidden");
};

window.deleteKpi=async id=>{
  if(!confirm("Delete this KPI and its history?"))return;
  const historyIds=snapshots.filter(s=>s.metric_id===id).map(s=>s.id);
  if(historyIds.length)await sb.from("notes").delete().in("id",historyIds);
  const{error}=await sb.from("notes").delete().eq("id",id);
  if(error)alert(error.message);else{await load();window.dispatchEvent(new CustomEvent("executive-os:data-changed"))}
};

async function start(){const{data:{session:s}}=await sb.auth.getSession();session=s;if(!session?.user)return;install();await load()}
sb.auth.onAuthStateChange((_e,s)=>{session=s;if(s?.user)setTimeout(start,250)});
window.addEventListener("executive-os:sync",load);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
