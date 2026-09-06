(()=>{
const U='https://hnvvvdibncwlplweeuod.supabase.co',K='sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1';
const C=window.supabase?.createClient(U,K,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:localStorage}});
const iso=d=>{d=new Date(d);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const add=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return iso(d)};
const fmt=s=>new Date(s+'T12:00:00').toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'});
let working=false,painting=false;
async function state(){
 const {data:{session}}=await C.auth.getSession(); if(!session)return null;
 const {data:p}=await C.from('programs').select('*').eq('owner_id',session.user.id).eq('slug','hamstring-return-flag-football-2026').maybeSingle(); if(!p)return null;
 const {data:days}=await C.from('program_days').select('*').eq('program_id',p.id).order('day_index');
 const today=iso(new Date());
 const {data:logs}=await C.from('program_logs').select('*').eq('program_id',p.id).eq('log_type','manual_recovery').order('created_at',{ascending:false}).limit(20);
 return{session,p,days:days||[],today,logs:(logs||[]).filter(x=>x.value?.date===today)};
}
async function paint(){
 if(painting)return; painting=true;
 try{
  const s=await state(); if(!s||!s.logs.length)return;
  const next=s.days.find(d=>d.status==='scheduled'&&d.scheduled_date>s.today); if(!next)return;
  const active=document.querySelector('.program-days button.active'); if(active&&Number(active.dataset.pday)!==next.day_index)return;
  const root=document.getElementById('programRoot'); if(!root)return;
  const plan=[...root.querySelectorAll('.program-card')].find(x=>x.querySelector('.section-label')?.textContent.trim()==="TODAY'S PLAN");
  if(plan){const h=plan.querySelector('h3'),p=plan.querySelector('p');if(h)h.textContent='Recovery Day — Soreness Still Present';if(p)p.textContent=`Today · Next workout moved to ${fmt(next.scheduled_date)}`;}
  if(!document.getElementById('recoveryInserted')){
   const note=document.createElement('div');note.id='recoveryInserted';note.className='program-note';note.innerHTML=`<strong>✓ Recovery day added</strong><p>Your planned workout was moved to <b>${fmt(next.scheduled_date)}</b>, and every remaining day shifted with it. Today: no loaded hamstring work. Easy walking only if comfortable; avoid sprinting, jumping, deep stretching, Nordics, sliders, or RDLs while it is still sore.</p>`;
   plan?.insertAdjacentElement('afterend',note);
  }
  root.querySelectorAll('.program-session').forEach(x=>{if(!x.closest('#recoveryInserted'))x.style.display='none'});
  const actions=[...root.querySelectorAll('.program-actions')].find(x=>x.querySelector('#pcomplete')||x.querySelector('#precovery')); if(actions)actions.style.display='none';
  const home=document.getElementById('programHome'); if(home){const strong=home.querySelector('strong'),p=home.querySelector('p');if(strong)strong.textContent='Recovery Day — Hamstring still sore';if(p)p.textContent=`Next workout: ${fmt(next.scheduled_date)}`;}
 }catch(e){console.error('Recovery UI fix',e)}finally{painting=false}
}
async function handleRecovery(e){
 const b=e.target.closest?.('#precovery'); if(!b||working)return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation(); working=true;b.disabled=true;
 try{
  const s=await state(); if(!s)throw new Error('Could not load your program.');
  const active=document.querySelector('.program-days button.active'); const i=active?Number(active.dataset.pday):s.days.find(d=>d.status==='scheduled'&&d.scheduled_date>=s.today)?.day_index;
  const d=s.days.find(x=>x.day_index===i); if(!d)throw new Error('Could not identify today’s program day.');
  if(s.logs.length){const next=s.days.find(x=>x.status==='scheduled'&&x.scheduled_date>s.today);alert(`Recovery day is already added for today. Your next workout is ${next?fmt(next.scheduled_date):'on the next scheduled day'}.`);await paint();return;}
  if(!confirm('Add a recovery day today and move this workout plus the rest of the plan forward one day?'))return;
  await C.from('program_logs').insert({program_id:s.p.id,program_day_id:d.id,owner_id:s.session.user.id,log_type:'manual_recovery',value:{date:s.today}});
  for(const x of s.days.filter(x=>x.day_index>=d.day_index&&x.status==='scheduled')){const {error}=await C.from('program_days').update({scheduled_date:add(x.scheduled_date,1),updated_at:new Date().toISOString()}).eq('id',x.id);if(error)throw error;}
  await C.from('program_logs').insert({program_id:s.p.id,program_day_id:d.id,owner_id:s.session.user.id,log_type:'schedule_shift',value:{date:s.today,days:1,reason:'manual_recovery'}});
  const {data:q}=await C.from('notification_queue').select('id,data,status').eq('owner_id',s.session.user.id).limit(500);
  for(const x of(q||[]).filter(x=>x.status==='pending'&&x.data?.source==='program'&&x.data?.program_id===s.p.id))await C.from('notification_queue').delete().eq('id',x.id);
  alert('Recovery day added. Today is now a recovery day and the remaining plan has shifted forward one day.');
  location.reload();
 }catch(err){alert(err.message||'Could not move the workout. Please try again.');console.error(err)}finally{working=false;b.disabled=false}
}
window.addEventListener('click',handleRecovery,true);
const obs=new MutationObserver(()=>{if(document.getElementById('programRoot'))setTimeout(paint,20)});obs.observe(document.documentElement,{subtree:true,childList:true});
document.addEventListener('DOMContentLoaded',()=>setTimeout(paint,250));setTimeout(paint,800);
})();