import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

const sb=createClient("https://hnvvvdibncwlplweeuod.supabase.co","sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const areaName=a=>({dom_con:"Dom Con",eli_global:"ELI Global",personal:"Personal"}[a]||a);
let session=null,workspaces=[],tasks=[],waiting=[],notes=[],events=[];
const areaFor=t=>workspaces.find(w=>w.id===t.workspace_id)?.area||"personal";

function daypart(){const h=new Date().getHours();return h<12?"Morning":h<17?"Midday":"Evening"}
function scoreTask(t){let s={p1:100,p2:70,p3:40,p4:20}[t.priority]||40;if(t.due_at){const d=(new Date(t.due_at)-new Date())/86400000;if(d<0)s+=60;else if(d<1)s+=35;else if(d<3)s+=15}return s}
function health(area){const open=tasks.filter(t=>areaFor(t)===area&&!['completed','cancelled'].includes(t.status));const overdue=open.filter(t=>t.due_at&&new Date(t.due_at)<new Date());const riskNotes=notes.filter(n=>n.note_type==='executive_entity').map(n=>{try{return{...JSON.parse(n.body||'{}'),title:n.title}}catch{return null}}).filter(x=>x&&x.area===area&&x.status==='at_risk');let score=100-overdue.length*15-riskNotes.length*12-Math.max(0,open.length-8)*2;score=Math.max(0,Math.min(100,score));return{score,open,overdue,riskNotes,label:score>=85?'Healthy':score>=65?'Watch':'At risk'}}
function buildBrief(){
  const now=new Date(),part=daypart(),open=tasks.filter(t=>!['completed','cancelled'].includes(t.status)),ranked=[...open].sort((a,b)=>scoreTask(b)-scoreTask(a));
  const overdue=open.filter(t=>t.due_at&&new Date(t.due_at)<now),dueToday=open.filter(t=>t.due_at&&new Date(t.due_at).toDateString()===now.toDateString());
  const waitingLate=waiting.filter(w=>w.follow_up_at&&new Date(w.follow_up_at)<now);
  const upcoming=events.filter(e=>new Date(e.starts_at)>now).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
  const dom=health('dom_con'),eli=health('eli_global'),personal=health('personal');
  const headline=part==='Morning'?'Set direction before the day starts':part==='Midday'?'Protect momentum and clear blockers':'Close loops and prepare tomorrow';
  const priorities=ranked.slice(0,3);
  const risks=[];
  if(overdue.length)risks.push(`${overdue.length} overdue task${overdue.length===1?'':'s'}`);
  if(waitingLate.length)risks.push(`${waitingLate.length} late follow-up${waitingLate.length===1?'':'s'}`);
  if(dom.label==='At risk')risks.push('Dom Con needs intervention');
  if(eli.label==='At risk')risks.push('ELI Global needs intervention');
  const opportunities=[];
  if(!overdue.length&&ranked[0])opportunities.push(`Use the clear runway to advance “${ranked[0].title}.”`);
  if(dueToday.length<3&&upcoming.length<3)opportunities.push('There is room for a focused strategic block today.');
  if(waiting.length)opportunities.push(`Resolve or escalate ${waiting.length} open follow-up${waiting.length===1?'':'s'} to reduce drag.`);
  return{part,headline,priorities,risks,opportunities,upcoming:upcoming.slice(0,3),health:[['Dom Con',dom],['ELI Global',eli],['Personal',personal]]};
}
function render(){
  const host=document.getElementById('dynamicExecutiveBrief');if(!host)return;const b=buildBrief();
  host.innerHTML=`<div class="deb-head"><div><div class="eyebrow">${b.part} Executive Brief</div><h2>${esc(b.headline)}</h2></div><button class="btn secondary compact" id="refreshDynamicBrief">Refresh</button></div>
  <div class="deb-grid">
    <div class="deb-panel"><div class="eyebrow">Top priorities</div>${b.priorities.length?b.priorities.map((x,i)=>`<div class="deb-item"><span>${i+1}</span><div><strong>${esc(x.title)}</strong><small>${esc(areaName(areaFor(x)))} · ${(x.priority||'p3').toUpperCase()}</small></div></div>`).join(''):'<p class="task-meta">No active priorities.</p>'}</div>
    <div class="deb-panel"><div class="eyebrow">Risks</div>${b.risks.length?b.risks.map(x=>`<div class="deb-callout risk">${esc(x)}</div>`).join(''):'<div class="deb-callout good">No urgent risks detected.</div>'}<div class="eyebrow deb-sub">Opportunities</div>${b.opportunities.slice(0,2).map(x=>`<div class="deb-callout">${esc(x)}</div>`).join('')}</div>
    <div class="deb-panel"><div class="eyebrow">Company health</div>${b.health.map(([name,h])=>`<div class="deb-health"><div><strong>${name}</strong><small>${h.open.length} open · ${h.overdue.length} overdue</small></div><span class="${h.label==='Healthy'?'good':h.label==='Watch'?'warn':'risk'}">${h.score}</span></div>`).join('')}</div>
    <div class="deb-panel"><div class="eyebrow">What is ahead</div>${b.upcoming.length?b.upcoming.map(e=>`<div class="deb-event"><strong>${esc(e.title)}</strong><small>${new Date(e.starts_at).toLocaleString()}</small></div>`).join(''):'<p class="task-meta">No upcoming calendar items loaded.</p>'}</div>
  </div>`;
  document.getElementById('refreshDynamicBrief').onclick=load;
}
function install(){
  const briefing=document.querySelector('.command-brief');if(!briefing||document.getElementById('dynamicExecutiveBrief'))return;
  const card=document.createElement('div');card.id='dynamicExecutiveBrief';card.className='card s12 dynamic-executive-brief';briefing.parentElement.insertBefore(card,briefing.nextSibling);
  const style=document.createElement('style');style.textContent=`.dynamic-executive-brief{padding:18px}.deb-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.deb-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px}.deb-panel{border:1px solid rgba(125,170,230,.16);background:rgba(8,25,50,.3);border-radius:16px;padding:14px}.deb-item{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid rgba(125,170,230,.1)}.deb-item>span{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:rgba(87,139,225,.18);font-size:.75rem}.deb-item small,.deb-event small,.deb-health small{display:block;color:var(--muted,#9eb1cc)}.deb-callout{padding:9px 10px;border-radius:10px;background:rgba(87,139,225,.08);margin-top:8px}.deb-callout.risk{background:rgba(240,95,95,.1)}.deb-callout.good{background:rgba(99,214,180,.1)}.deb-sub{margin-top:14px}.deb-health{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(125,170,230,.1)}.deb-health span{font-weight:700}.deb-health span.good{color:#63d6b4}.deb-health span.warn{color:#f6c65b}.deb-health span.risk{color:#ef7676}.deb-event{padding:9px 0;border-bottom:1px solid rgba(125,170,230,.1)}@media(max-width:980px){.deb-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.deb-grid{grid-template-columns:1fr}}`;document.head.appendChild(style);
}
async function load(){if(!session?.user)return;const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+2);const r=await Promise.all([sb.from('workspaces').select('*'),sb.from('tasks').select('*'),sb.from('waiting_on').select('*').is('resolved_at',null),sb.from('notes').select('*'),sb.from('calendar_events_cache').select('*').gte('starts_at',start.toISOString()).lt('starts_at',end.toISOString())]);if(r.some(x=>x.error)){console.error(r.find(x=>x.error)?.error);return}workspaces=r[0].data||[];tasks=r[1].data||[];waiting=r[2].data||[];notes=r[3].data||[];events=r[4].data||[];render()}
async function start(){const{data:{session:s}}=await sb.auth.getSession();session=s;if(!session?.user)return;install();await load()}
sb.auth.onAuthStateChange((_e,s)=>{session=s;if(s?.user)setTimeout(start,250)});window.addEventListener('executive-os:data-changed',load);window.addEventListener('executive-os:sync',load);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();