import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

const sb=createClient("https://hnvvvdibncwlplweeuod.supabase.co","sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const prettyTime=value=>value?new Date(value).toLocaleString([],{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):null;
let taskCache=[],busy=false,timer=null;

function subjectOf(task){return task.executive_context?.subject||null}
function typeOf(task){return task.executive_context?.object_type||task.context_type||"task"}
function iconOf(type){return({call:"📞",meeting:"📅",purchase:"🛒",decision:"◆",project:"▦",task:"✓"})[type]||"✓"}
function reasonFor(task){
  const reasons=[];
  if(task.reason)reasons.push(task.reason);
  if(task.blocking)reasons.push(`It is blocking ${task.blocking}.`);
  if(task.reminder_at){const hours=(new Date(task.reminder_at)-new Date())/3600000;if(hours>=0&&hours<=24)reasons.push("The reminder is within the next 24 hours.")}
  if(task.estimated_minutes&&task.estimated_minutes<=15)reasons.push(`It should take about ${task.estimated_minutes} minutes.`);
  if(task.related_person)reasons.push(`${task.related_person} is connected to this commitment.`);
  return [...new Set(reasons)];
}
function detailMarkup(task){
  const items=[];
  const type=typeOf(task),subject=subjectOf(task);
  if(type!=="task")items.push(`<span class="object-badge">${iconOf(type)} ${esc(type.replace(/_/g," "))}</span>`);
  if(task.reminder_at)items.push(`<span><b>Reminder</b>${esc(prettyTime(task.reminder_at))}</span>`);
  if(task.scheduled_start)items.push(`<span><b>Start</b>${esc(prettyTime(task.scheduled_start))}</span>`);
  if(task.due_at)items.push(`<span><b>Due</b>${esc(prettyTime(task.due_at))}</span>`);
  if(task.related_person)items.push(`<span><b>Person</b>${esc(task.related_person)}</span>`);
  if(subject)items.push(`<span><b>Topic</b>${esc(subject)}</span>`);
  if(task.reason)items.push(`<span class="wide"><b>Why</b>${esc(task.reason)}</span>`);
  if(task.estimated_minutes)items.push(`<span><b>Time</b>${esc(task.estimated_minutes)} min</span>`);
  return items.length?`<div class="executive-details">${items.join("")}</div>`:"";
}
async function loadTasks(){
  if(busy)return;busy=true;
  try{
    const{data:{session}}=await sb.auth.getSession();
    if(!session?.user)return;
    const{data,error}=await sb.from("tasks").select("*").neq("status","cancelled").order("created_at",{ascending:false});
    if(error)throw error;taskCache=data||[];
    enhance();
  }catch(error){console.error("Structured display:",error)}finally{busy=false}
}
function matchTask(title){return taskCache.find(t=>String(t.title).trim()===title.trim())}
function enhanceTaskCards(){
  document.querySelectorAll(".task").forEach(card=>{
    const titleEl=card.querySelector(".task-title");if(!titleEl)return;
    const task=matchTask(titleEl.textContent||"");if(!task)return;
    card.querySelector(".executive-details")?.remove();
    const html=detailMarkup(task);if(html)titleEl.closest(".task-main")?.insertAdjacentHTML("beforeend",html);
  });
}
function enhanceBriefing(){
  const briefing=document.getElementById("briefing");if(!briefing)return;
  const recommendation=[...briefing.querySelectorAll("strong")].find(el=>matchTask(el.textContent||""));
  const task=recommendation?matchTask(recommendation.textContent||""):taskCache.filter(t=>!["completed","cancelled"].includes(t.status)).sort((a,b)=>(Number(b.ai_priority_score)||0)-(Number(a.ai_priority_score)||0))[0];
  briefing.querySelector(".executive-why-line")?.remove();
  if(!task)return;
  const reasons=reasonFor(task);if(!reasons.length)return;
  briefing.insertAdjacentHTML("beforeend",`<div class="brief-line executive-why-line"><span class="brief-icon">?</span><span><strong>Why this first:</strong> ${esc(reasons[0])}</span></div>`);
}
function enhanceNextAction(){
  const box=document.getElementById("nextActionContent");if(!box)return;
  const title=box.querySelector("h2")?.textContent||"";const task=matchTask(title);if(!task)return;
  box.querySelector(".executive-next-context")?.remove();
  const reasons=reasonFor(task),subject=subjectOf(task);
  const pieces=[];
  if(subject)pieces.push(`<p><b>Topic:</b> ${esc(subject)}</p>`);
  if(task.related_person)pieces.push(`<p><b>Person:</b> ${esc(task.related_person)}</p>`);
  if(task.reminder_at)pieces.push(`<p><b>Reminder:</b> ${esc(prettyTime(task.reminder_at))}</p>`);
  if(reasons.length)pieces.push(`<p><b>Why this first:</b> ${esc(reasons.join(" "))}</p>`);
  if(pieces.length)box.insertAdjacentHTML("beforeend",`<div class="executive-next-context">${pieces.join("")}</div>`);
}
function enhance(){enhanceTaskCards();enhanceBriefing();enhanceNextAction()}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>{enhance();if(!taskCache.length)loadTasks()},180)}

const style=document.createElement("style");style.textContent=`
.executive-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.executive-details span{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border:1px solid rgba(125,170,230,.18);border-radius:10px;font-size:.78rem;color:var(--muted,#9eb1cc)}.executive-details span b{font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:#a9c7f7}.executive-details .wide,.executive-details .object-badge{grid-column:1/-1}.executive-details .object-badge{display:block;text-transform:capitalize;color:#cfe0ff}.executive-next-context{margin-top:14px;padding:12px 14px;border:1px solid rgba(125,170,230,.18);border-radius:14px}.executive-next-context p{margin:5px 0;color:var(--muted,#9eb1cc)}@media(max-width:500px){.executive-details{grid-template-columns:1fr}.executive-details .wide,.executive-details .object-badge{grid-column:auto}}
`;document.head.appendChild(style);

const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true});
sb.auth.onAuthStateChange((_event,session)=>{if(session?.user)setTimeout(loadTasks,250)});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(loadTasks,400));else setTimeout(loadTasks,400);
