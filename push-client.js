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
 const registration=await navigator.serviceWorker.register('/sw.js?v=5.4.0',{scope:'/'});
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
const SMALL={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60};
function wordNumber(value){
 const cleaned=String(value||'').toLowerCase().replace(/-/g,' ').trim();
 if(/^\d+$/.test(cleaned))return Number(cleaned);
 let total=0,found=false;
 for(const word of cleaned.split(/\s+/)){if(word==='and')continue;if(SMALL[word]!=null){total+=SMALL[word];found=true;}else if(word==='a'||word==='an'){total+=1;found=true;}else return null;}
 return found?total:null;
}
const NUMBER_PATTERN='(?:\\d+|(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty)(?:[-\\s](?:one|two|three|four|five|six|seven|eight|nine))?)';
function setTime(base,hour,minute=0,meridian=''){
 let h=Number(hour),m=Number(minute||0),md=String(meridian||'').toLowerCase().replace(/\./g,'');
 if(md==='pm'&&h<12)h+=12;if(md==='am'&&h===12)h=0;base.setHours(h,m,0,0);return base;
}
function nextWeekday(base,target){const day=base.getDay();let delta=(target-day+7)%7;if(delta===0)delta=7;base.setDate(base.getDate()+delta);return base;}
function parseTime(text){
 const now=new Date();const lower=text.toLowerCase().replace(/\s+/g,' ').trim();let match;
 const relative=new RegExp(`(?:in|after)\\s+(${NUMBER_PATTERN})\\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)`,'i');
 if((match=lower.match(relative))){const amount=wordNumber(match[1]);if(amount!=null){const unit=match[2].toLowerCase();const ms=unit.startsWith('hour')||unit.startsWith('hr')?amount*3600000:unit.startsWith('day')?amount*86400000:unit.startsWith('week')?amount*7*86400000:amount*60000;return new Date(now.getTime()+ms);}}
 const fromNow=new RegExp(`(${NUMBER_PATTERN})\\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)\\s+from\\s+now`,'i');
 if((match=lower.match(fromNow))){const amount=wordNumber(match[1]);if(amount!=null){const unit=match[2].toLowerCase();const ms=unit.startsWith('hour')||unit.startsWith('hr')?amount*3600000:unit.startsWith('day')?amount*86400000:unit.startsWith('week')?amount*7*86400000:amount*60000;return new Date(now.getTime()+ms);}}
 let base=new Date(now);
 const weekdays={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
 const dayMatch=lower.match(/\b(?:next\s+|this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
 if(dayMatch)base=nextWeekday(base,weekdays[dayMatch[1]]);
 else if(/\bday after tomorrow\b/.test(lower))base.setDate(base.getDate()+2);
 else if(/\btomorrow\b/.test(lower))base.setDate(base.getDate()+1);
 const clock=lower.match(/(?:at|for|around|by)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/);
 if(clock){setTime(base,clock[1],clock[2],clock[3]);if(!dayMatch&&!/tomorrow|day after tomorrow/.test(lower)&&base<=now)base.setDate(base.getDate()+1);return base;}
 const wordClock=new RegExp(`(?:at|for|around|by)\\s+(${NUMBER_PATTERN})\\s*(a\\.?m\\.?|p\\.?m\\.?)`,'i');
 if((match=lower.match(wordClock))){const hour=wordNumber(match[1]);if(hour!=null){setTime(base,hour,0,match[2]);if(!dayMatch&&!/tomorrow|day after tomorrow/.test(lower)&&base<=now)base.setDate(base.getDate()+1);return base;}}
 if(/\bnoon\b/.test(lower)){base.setHours(12,0,0,0);if(!dayMatch&&!/tomorrow|day after tomorrow/.test(lower)&&base<=now)base.setDate(base.getDate()+1);return base;}
 if(/\bmidnight\b/.test(lower)){base.setHours(0,0,0,0);if(!dayMatch&&!/tomorrow|day after tomorrow/.test(lower)&&base<=now)base.setDate(base.getDate()+1);return base;}
 const daypart=/\bmorning\b/.test(lower)?9:/\bafternoon\b/.test(lower)?15:/\bevening\b/.test(lower)?19:/\btonight\b/.test(lower)?21:null;
 if(daypart!=null){base.setHours(daypart,0,0,0);if(!dayMatch&&!/tomorrow|day after tomorrow/.test(lower)&&base<=now)base.setDate(base.getDate()+1);return base;}
 if(dayMatch){base.setHours(9,0,0,0);return base;}
 if(/\btomorrow\b/.test(lower)){base.setHours(9,0,0,0);return base;}
 return null;
}
function reminderBody(text){
 let body=text.replace(/^\s*(hey\s+)?coffee\s+run[,:]?\s*/i,'').replace(/^(set|create|send)\s+(me\s+)?(a\s+)?(reminder|notification|update)\s*/i,'').replace(/^(remind|notify)\s+me\s*/i,'');
 const timePatterns=[new RegExp(`\\b(?:in|after)\\s+${NUMBER_PATTERN}\\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?)\\b`,'ig'),new RegExp(`\\b${NUMBER_PATTERN}\\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?)\\s+from\\s+now\\b`,'ig'),/\b(?:day after tomorrow|tomorrow|tonight|this morning|this afternoon|this evening|next\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|this\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/ig,/(?:at|for|around|by)\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?/ig,/\b(?:at|for|around|by)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:a\.?m\.?|p\.?m\.?)\b/ig,/\b(?:noon|midnight|morning|afternoon|evening)\b/ig];
 for(const p of timePatterns)body=body.replace(p,' ');
 return body.replace(/\s+/g,' ').trim().replace(/^to\s+/i,'')||'Coffee Run reminder';
}
async function scheduleNotification(text){
 const scheduled=parseTime(text);if(!scheduled)throw new Error('I could not confidently determine the reminder time. Try “in five minutes,” “tomorrow morning,” or “next Tuesday at 3 PM.”');
 const authSession=await session();
 const body=reminderBody(text);
 const{error}=await client.from('notification_queue').insert({owner_id:authSession.user.id,title:'Coffee Run',body,scheduled_for:scheduled.toISOString(),status:'pending',data:{source:'coffee_run_ai',original_text:text}});
 if(error)throw error;
 return{body,scheduled};
}
async function organizeCommand(text){const lower=text.toLowerCase();if(/\b(remind|reminder|notify|notification|send me an update|send an update)\b/.test(lower))return{type:'notification',...(await scheduleNotification(text))};return null;}
async function interceptSave(event){
 const button=event.target.closest?.('#aiSubmit');if(!button)return;
 const input=$('aiInput');const text=input?.value.trim();if(!text)return;
 event.preventDefault();event.stopImmediatePropagation();
 const result=$('aiResult');button.disabled=true;button.textContent='Organizing…';if(result){result.textContent='Understanding your command…';result.style.color='';}
 try{
  const organized=await organizeCommand(text);
  if(!organized){button.disabled=false;button.textContent='Save & Organize';button.click();return;}
  try{await enablePush();}catch(pushError){if(result){result.textContent=`Reminder scheduled, but push is not enabled: ${pushError.message}`;result.style.color='#c83f55';}input.value='';return;}
  input.value='';const when=organized.scheduled.toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});if(result)result.textContent=`Scheduled “${organized.body}” for ${when}. You will receive a push notification.`;
  if('speechSynthesis'in window)speechSynthesis.speak(new SpeechSynthesisUtterance(`Got it. I will remind you at ${organized.scheduled.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}.`));
 }catch(error){if(result){result.textContent=error.message||'Could not schedule that notification.';result.style.color='#c83f55';}}
 finally{button.disabled=false;button.textContent='Save & Organize';}
}
async function refreshStatus(){
 if(!('Notification'in window)){setStatus('Push is unavailable on this device.',true);return;}
 if(Notification.permission!=='granted'){setStatus('Push notifications are not enabled.');return;}
 try{const reg=await navigator.serviceWorker.register('/sw.js?v=5.4.0',{scope:'/'});const sub=await reg.pushManager.getSubscription();setStatus(sub?'Push notifications are enabled.':'Tap to finish enabling push.');}catch{setStatus('Tap to enable push notifications.');}
}
document.addEventListener('DOMContentLoaded',()=>{
 navigator.serviceWorker?.register('/sw.js?v=5.4.0',{scope:'/'}).catch(console.warn);
 $('enablePush')?.addEventListener('click',()=>enablePush().catch(e=>setStatus(e.message,true)));
 $('menuEnablePush')?.addEventListener('click',()=>enablePush().catch(e=>setStatus(e.message,true)));
 refreshStatus();
});
document.addEventListener('click',interceptSave,true);
window.CoffeeRunPush={enablePush,scheduleNotification,parseTime};
})();