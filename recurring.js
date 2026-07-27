(()=>{
const SUPABASE_URL='https://hnvvvdibncwlplweeuod.supabase.co';
const SUPABASE_KEY='sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1';
const $=id=>document.getElementById(id);
const client=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});
const state={items:[],selectedDays:new Set([1]),loading:false};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fullDays={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
const msg=(text,error=false)=>{const el=$('automationStatus');if(el){el.textContent=text||'';el.style.color=error?'#c83f55':''}};
async function session(){const{data,error}=await client.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Sign in first.');return data.session;}
function timeParts(text){const lower=text.toLowerCase();let m=lower.match(/(?:at|around)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/);if(m){let h=Number(m[1]),min=Number(m[2]||0),md=(m[3]||'').replace(/\./g,'');if(md==='pm'&&h<12)h+=12;if(md==='am'&&h===12)h=0;return{h,min};}if(/morning/.test(lower))return{h:8,min:0};if(/afternoon/.test(lower))return{h:15,min:0};if(/evening|night/.test(lower))return{h:19,min:0};return null;}
function nextOccurrence(cadence,days,h,min,from=new Date()){
 const d=new Date(from);d.setSeconds(0,0);d.setHours(h,min,0,0);
 const allowed=cadence==='weekdays'?[1,2,3,4,5]:cadence==='weekly'?days:[0,1,2,3,4,5,6];
 if(d<=from)d.setDate(d.getDate()+1);
 while(!allowed.includes(d.getDay()))d.setDate(d.getDate()+1);
 return d;
}
function cleanBody(text){return text.replace(/^\s*(hey\s+)?coffee\s+run[,:]?\s*/i,'').replace(/\b(?:every\s+day|daily|every\s+weekday|weekdays|every\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|each\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/ig,' ').replace(/\b(?:at|around)\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?/ig,' ').replace(/\b(?:morning|afternoon|evening|night)\b/ig,' ').replace(/^(remind|notify)\s+me\s+(to\s+)?/i,'').replace(/^(send\s+me\s+an?\s+update\s+to\s+)?/i,'').replace(/\s+/g,' ').trim().replace(/^to\s+/i,'')||'Coffee Run recurring reminder';}
function parseRecurring(text){
 const lower=text.toLowerCase();if(!/\b(every|daily|weekdays|each)\b/.test(lower))return null;
 let cadence='daily',days=[];
 if(/every\s+weekday|weekdays/.test(lower))cadence='weekdays';
 else{const found=Object.entries(fullDays).filter(([name])=>new RegExp(`\\b(?:every|each)\\s+${name}\\b`).test(lower)).map(([,n])=>n);if(found.length){cadence='weekly';days=found;}}
 const t=timeParts(text);if(!t)throw new Error('What time should this repeat? Try “every weekday at 6 AM.”');
 return{cadence,days,local_time:`${String(t.h).padStart(2,'0')}:${String(t.min).padStart(2,'0')}:00`,next_run_at:nextOccurrence(cadence,days,t.h,t.min).toISOString(),body:cleanBody(text)};
}
async function createAutomation(values){const auth=await session();const row={owner_id:auth.user.id,title:'Coffee Run',body:values.body,cadence:values.cadence,weekdays:values.days||[],local_time:values.local_time,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'America/New_York',next_run_at:values.next_run_at,enabled:true};const{error}=await client.from('recurring_automations').insert(row);if(error)throw error;await load();return row;}
function label(a){if(a.cadence==='daily')return'Every day';if(a.cadence==='weekdays')return'Every weekday';return`Every ${(a.weekdays||[]).map(d=>dayNames[d]).join(', ')}`;}
function render(){const list=$('automationList');if(!list)return;const active=state.items.filter(x=>x.enabled).length;if($('activeAutomationCount'))$('activeAutomationCount').textContent=active;if(!state.items.length){list.innerHTML='<div class="empty-state">No recurring automations yet.</div>';return;}list.innerHTML=state.items.map(a=>`<article class="reminder-item" data-auto-id="${esc(a.id)}"><div class="reminder-main"><div class="reminder-topline"><span class="reminder-badge ${a.enabled?'sent':'cancelled'}">${a.enabled?'ACTIVE':'PAUSED'}</span><time>Next: ${esc(new Date(a.next_run_at).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</time></div><h3>${esc(a.body)}</h3><p class="push-status">${esc(label(a))} at ${esc(String(a.local_time).slice(0,5))}</p></div><div class="reminder-actions"><button data-auto-action="edit">Edit</button><button data-auto-action="skip">Skip next</button><button data-auto-action="toggle">${a.enabled?'Pause':'Resume'}</button><button class="danger-action" data-auto-action="delete">Delete</button></div></article>`).join('');}
async function load(){if(state.loading)return;state.loading=true;try{const auth=await session();const{data,error}=await client.from('recurring_automations').select('*').eq('owner_id',auth.user.id).order('created_at',{ascending:false});if(error)throw error;state.items=data||[];render();}catch(e){msg(e.message||'Could not load recurring automations.',true);}finally{state.loading=false;}}
async function update(id,changes){const{error}=await client.from('recurring_automations').update({...changes,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;await load();}
function selected(){return[...state.selectedDays].sort();}
function syncDayButtons(){document.querySelectorAll('[data-auto-day]').forEach(b=>b.classList.toggle('active',state.selectedDays.has(Number(b.dataset.autoDay))));}
async function addFromForm(){const body=$('automationBody').value.trim(),cadence=$('automationCadence').value,time=$('automationTime').value;if(!body)return msg('Enter what Coffee Run should remind you about.',true);const days=cadence==='weekly'?selected():[];if(cadence==='weekly'&&!days.length)return msg('Choose at least one day.',true);const[h,min]=time.split(':').map(Number);try{await createAutomation({body,cadence,days,local_time:`${time}:00`,next_run_at:nextOccurrence(cadence,days,h,min).toISOString()});$('automationBody').value='';msg('Recurring reminder created.');}catch(e){msg(e.message,true);}}
async function scheduleFromText(text){const parsed=parseRecurring(text);if(!parsed)return null;await createAutomation(parsed);return{type:'recurring',body:parsed.body,scheduled:new Date(parsed.next_run_at),description:parsed.cadence==='daily'?'every day':parsed.cadence==='weekdays'?'every weekday':`every ${parsed.days.map(d=>dayNames[d]).join(', ')}`};}
async function intercept(event){const button=event.target.closest?.('#aiSubmit');if(!button)return;const text=$('aiInput')?.value.trim();if(!text||! /\b(every|daily|weekdays|each)\b/i.test(text))return;event.preventDefault();event.stopImmediatePropagation();button.disabled=true;button.textContent='Creating routine…';const result=$('aiResult');try{const made=await scheduleFromText(text);if(!made)return;$('aiInput').value='';const at=made.scheduled.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});result.textContent=`Created “${made.body}” ${made.description} at ${at}. Push notifications will repeat automatically.`;if(window.CoffeeRunPush?.enablePush)await window.CoffeeRunPush.enablePush();}catch(e){result.textContent=e.message||'Could not create recurring reminder.';result.style.color='#c83f55';}finally{button.disabled=false;button.textContent='Save & Organize';}}
document.addEventListener('DOMContentLoaded',()=>{
 $('automationCadence')?.addEventListener('change',e=>$('automationWeekdays')?.classList.toggle('hidden',e.target.value!=='weekly'));
 $('addAutomation')?.addEventListener('click',addFromForm);
 document.addEventListener('click',async e=>{const day=e.target.closest('[data-auto-day]');if(day){const n=Number(day.dataset.autoDay);state.selectedDays.has(n)?state.selectedDays.delete(n):state.selectedDays.add(n);syncDayButtons();return;}const card=e.target.closest('[data-auto-id]'),action=e.target.closest('[data-auto-action]')?.dataset.autoAction;if(!card||!action)return;const a=state.items.find(x=>x.id===card.dataset.autoId);if(!a)return;try{if(action==='toggle')await update(a.id,{enabled:!a.enabled});if(action==='skip')await update(a.id,{next_run_at:nextOccurrence(a.cadence,a.weekdays||[],...String(a.local_time).slice(0,5).split(':').map(Number),new Date(a.next_run_at)).toISOString()});if(action==='edit'){const body=prompt('Reminder text',a.body);if(body===null)return;const time=prompt('Time (HH:MM)',String(a.local_time).slice(0,5));if(time===null)return;const[h,m]=time.split(':').map(Number);await update(a.id,{body:body.trim()||a.body,local_time:`${time}:00`,next_run_at:nextOccurrence(a.cadence,a.weekdays||[],h,m).toISOString()});}if(action==='delete'&&confirm('Delete this recurring automation?')){const{error}=await client.from('recurring_automations').delete().eq('id',a.id);if(error)throw error;await load();}}catch(err){msg(err.message,true);}});
 syncDayButtons();load();
});
document.addEventListener('click',intercept,true);
window.CoffeeRunRecurring={scheduleFromText,load};
})();