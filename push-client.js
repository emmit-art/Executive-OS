(()=>{
const SUPABASE_URL='https://hnvvvdibncwlplweeuod.supabase.co';
const SUPABASE_KEY='sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1';
const VAPID_PUBLIC_KEY='BPwe9bisGhBNUHQAZk_b5XJZbjE2lW4Fo17P7s2zYUtMuZroxxCuAuwy3mLmrpyyvUc-4M_oCuQeT5SzkjboxWU';
const $=id=>document.getElementById(id);
const client=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});
const setStatus=(text,error=false)=>{for(const id of ['pushStatus','menuPushStatus']){const el=$(id);if(el){el.textContent=text;el.style.color=error?'#c83f55':''}}};
const urlBase64ToUint8Array=value=>{const padding='='.repeat((4-value.length%4)%4);const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));};
async function session(){const{data,error}=await client.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Sign in first.');return data.session;}
async function enablePush(){
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw new Error('Push notifications are not supported on this device.');
 setStatus('Requesting notification permission…');
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw new Error('Notifications were not allowed. Enable them in iPhone Settings > Notifications > Coffee Run.');
 const authSession=await session();
 const registration=await navigator.serviceWorker.register('/sw.js?v=5.3.0',{scope:'/'});
 await navigator.serviceWorker.ready;
 let existing=await registration.pushManager.getSubscription();
 const storedKey=localStorage.getItem('coffeeRunVapidKey');
 if(existing&&storedKey!==VAPID_PUBLIC_KEY){await existing.unsubscribe();existing=null;}
 const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
 const json=subscription.toJSON();
 const{error}=await client.from('push_subscriptions').upsert({owner_id:authSession.user.id,endpoint:subscription.endpoint,p256dh:json.keys?.p256dh,auth:json.keys?.auth,user_agent:navigator.userAgent,enabled:true,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
 if(error)throw error;
 localStorage.setItem('coffeeRunVapidKey',VAPID_PUBLIC_KEY);
 setStatus('Push notifications are enabled.');
 return true;
}
function parseTime(text){
 const now=new Date();const lower=text.toLowerCase();let match;
 if((match=lower.match(/in\s+(\d+)\s*(minute|minutes|min|hour|hours|hr|hrs)/))){const amount=Number(match[1]);const ms=match[2].startsWith('h')?amount*3600000:amount*60000;return new Date(now.getTime()+ms);}
 let base=new Date(now);
 if(/tomorrow/.test(lower))base.setDate(base.getDate()+1);
 if((match=lower.match(/(?:at|for)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/))){let hour=Number(match[1]);const minute=Number(match[2]||0);const meridian=(match[3]||'').replace(/\./g,'');if(meridian==='pm'&&hour<12)hour+=12;if(meridian==='am'&&hour===12)hour=0;base.setHours(hour,minute,0,0);if(!/tomorrow/.test(lower)&&base<=now)base.setDate(base.getDate()+1);return base;}
 if(/tonight/.test(lower)){base.setHours(21,0,0,0);if(base<=now)base.setDate(base.getDate()+1);return base;}
 if(/tomorrow/.test(lower)){base.setHours(9,0,0,0);return base;}
 return null;
}
function reminderBody(text){return text.replace(/^(coffee run|hey coffee run)[,\s]*/i,'').replace(/^(set|create|send)\s+(me\s+)?(a\s+)?(reminder|notification|update)\s*/i,'').replace(/^(remind|notify)\s+me\s*/i,'').replace(/\b(in\s+\d+\s*(minutes?|mins?|hours?|hrs?)|tomorrow|tonight|at\s+\d{1,2}(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)?)\b/ig,'').replace(/\s+/g,' ').trim().replace(/^to\s+/i,'')||'Coffee Run reminder';}
async function scheduleNotification(text){
 const scheduled=parseTime(text);if(!scheduled)throw new Error('I could not find a reminder time. Try “in 10 minutes” or “at 9 PM.”');
 const authSession=await session();
 const body=reminderBody(text);
 const{error}=await client.from('notification_queue').insert({owner_id:authSession.user.id,title:'Coffee Run',body,scheduled_for:scheduled.toISOString(),status:'pending',data:{source:'coffee_run_ai'}});
 if(error)throw error;
 return{body,scheduled};
}
async function organizeCommand(text){
 const lower=text.toLowerCase();
 if(/\b(remind|reminder|notify|notification|send me an update|send an update)\b/.test(lower))return{type:'notification',...(await scheduleNotification(text))};
 return null;
}
async function interceptSave(event){
 const button=event.target.closest?.('#aiSubmit');if(!button)return;
 const input=$('aiInput');const text=input?.value.trim();if(!text)return;
 event.preventDefault();event.stopImmediatePropagation();
 const result=$('aiResult');button.disabled=true;button.textContent='Organizing…';if(result){result.textContent='Understanding your command…';result.style.color='';}
 try{
  const organized=await organizeCommand(text);
  if(!organized){button.disabled=false;button.textContent='Save & Organize';button.click();return;}
  try{await enablePush();}catch(pushError){if(result){result.textContent=`Reminder scheduled, but push is not enabled: ${pushError.message}`;result.style.color='#c83f55';}input.value='';return;}
  input.value='';const when=organized.scheduled.toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'});if(result)result.textContent=`Scheduled “${organized.body}” for ${when}. You will receive a push notification.`;
  if('speechSynthesis'in window)speechSynthesis.speak(new SpeechSynthesisUtterance(`Scheduled for ${when}.`));
 }catch(error){if(result){result.textContent=error.message||'Could not schedule that notification.';result.style.color='#c83f55';}}
 finally{button.disabled=false;button.textContent='Save & Organize';}
}
async function refreshStatus(){
 if(!('Notification'in window)){setStatus('Push is unavailable on this device.',true);return;}
 if(Notification.permission!=='granted'){setStatus('Push notifications are not enabled.');return;}
 try{const reg=await navigator.serviceWorker.register('/sw.js?v=5.3.0',{scope:'/'});const sub=await reg.pushManager.getSubscription();setStatus(sub?'Push notifications are enabled.':'Tap to finish enabling push.');}catch{setStatus('Tap to enable push notifications.');}
}
document.addEventListener('DOMContentLoaded',()=>{
 navigator.serviceWorker?.register('/sw.js?v=5.3.0',{scope:'/'}).catch(console.warn);
 $('enablePush')?.addEventListener('click',()=>enablePush().catch(e=>setStatus(e.message,true)));
 $('menuEnablePush')?.addEventListener('click',()=>enablePush().catch(e=>setStatus(e.message,true)));
 refreshStatus();
});
document.addEventListener('click',interceptSave,true);
window.CoffeeRunPush={enablePush,scheduleNotification};
})();