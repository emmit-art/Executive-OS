(()=>{
  let panel, list, loading=false;
  const inFlight=new Set();
  const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const easternTime=value=>new Date(value).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  function render(a,host,showProposal=false){
    const card=node('section');card.className='coach-approval';card.style.cssText='margin-top:12px;padding:14px;border:1px solid #9bb7e5;border-radius:12px;background:#f5f8ff;color:#1f2a3d;white-space:pre-wrap';
    card.dataset.actionId=a.id;
    card.append(node('strong',`Approval: ${a.status.replaceAll('_',' ')}`));
    if(a.action_type==='send_email_dev'){
      const email=a.proposed_changes||{};
      for(const [label,key] of [['From','from'],['To','to'],['Subject','subject']])card.append(node('p',`${label}: ${email[key]??''}`));
      const body=node('pre',email.body??'');body.style.whiteSpace='pre-wrap';body.style.overflowWrap='anywhere';card.append(body);
      card.append(node('p',`Attachments: ${email.attachments?.length?email.attachments.map(x=>x.filename).join(', '):'None'}`));
    }
    if(a.action_type==='create_calendar_event_dev'){
      const event=a.proposed_changes?.calendar||a.proposed_changes||{};
      for(const [label,key] of [['Calendar','calendar_account'],['Title','title'],['Start','start_at'],['End','end_at'],['Timezone','timezone'],['Location','location']])card.append(node('p',`${label}: ${['start_at','end_at'].includes(key)&&event[key]?easternTime(event[key]):event[key]??''}`));
      card.append(node('p',`All day: ${event.all_day?'Yes':'No'}`));
      if(event.notes)card.append(node('pre',event.notes));
    }
    if(showProposal){card.append(node('p',a.proposal_text));const details=node('details');details.append(node('summary','Exact proposed changes'));details.append(node('pre',JSON.stringify(a.proposed_changes,null,2)));card.append(details);}
    card.append(node('p',`Action: ${a.action_type} · Expires: ${a.action_type==='create_calendar_event_dev'?easternTime(a.expires_at):new Date(a.expires_at).toLocaleString()}`));
    if(a.status!=='pending'){
      card.append(node('p',a.error_message || (a.status==='declined'?'Declined. Nothing was executed.':a.status==='expired'?'Approval expired. Nothing was executed.':a.execution_status==='succeeded'?(a.action_type==='send_email_dev'?`Email sent. Message ID: ${a.result?.message_id}`:a.action_type==='create_calendar_event_dev'?'Calendar event created.':'Diagnostic completed once. No external action was performed.'):a.execution_status==='queued'?(a.action_type==='create_calendar_event_dev'?'Approved and queued. Run the calendar executor, then refresh approvals.':'Approved and queued. Refresh approvals to check delivery.'):`Execution: ${a.execution_status}`)));
    }else if(new Date(a.expires_at)<=new Date()){
      card.append(node('p','This proposal has expired. Ask the Coach for a new proposal.'));
    }else{
      const controls=node('div');controls.style.cssText='display:flex;gap:10px;margin-top:12px';
      for(const decision of ['approve','decline']){
        const b=node('button',decision==='approve'?'Approve':'Decline');b.type='button';b.className=decision==='approve'?'primary-button':'secondary-button';
        b.addEventListener('click',async()=>{
          if(inFlight.has(a.id))return;
          inFlight.add(a.id);controls.querySelectorAll('button').forEach(x=>x.disabled=true);
          const status=node('p','Saving decision…');card.append(status);
          try{
            const data=await window.CoffeeRunCoach.decide(a,decision);
            card.replaceChildren(node('strong',`Approval: ${data.approval.status}`),node('p',data.reply));
            await refresh();
          }catch(e){status.textContent=e.message+' Refresh approvals to check the saved state before retrying.';}
          finally{inFlight.delete(a.id);}
        });controls.append(b);
      }card.append(controls);
    }
    host.append(card);
  }
  async function refresh(){
    if(!list||loading)return;
    const client=window.coffeeRunSupabase;if(!client)return;
    const {data}=await client.auth.getSession();if(!data?.session){list.replaceChildren();return;}
    loading=true;
    try{const result=await window.CoffeeRunCoach.listApprovals();list.replaceChildren();if(!result.approvals.length)list.append(node('p','No approval requests yet.'));for(const a of result.approvals)render(a,list,true);}
    catch(e){list.replaceChildren(node('p',e.message));}finally{loading=false;}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const target=document.getElementById('aiResult');if(!target)return;
    panel=node('details');panel.style.cssText='margin-top:18px;padding:16px;background:rgba(255,255,255,.8);border-radius:16px';
    panel.append(node('summary','Approval history'));
    const refreshButton=node('button','Refresh approvals');refreshButton.type='button';refreshButton.className='secondary-button';refreshButton.addEventListener('click',refresh);panel.append(refreshButton);
    list=node('div');panel.append(list);target.after(panel);panel.addEventListener('toggle',()=>{if(panel.open)refresh()});
    const diagnostics=node('details');diagnostics.style.marginTop='14px';diagnostics.append(node('summary','Development approval tests'));
    diagnostics.append(node('p','These tests only write diagnostic approval records. They never send messages or change tasks, calendars, or money.'));
    for(const outcome of ['success','failure']){const b=node('button',outcome==='success'?'Test approval':'Test failure handling');b.type='button';b.className='secondary-button';b.style.marginRight='8px';b.addEventListener('click',async()=>{b.disabled=true;try{const data=await window.CoffeeRunCoach.diagnostic(outcome);target.replaceChildren(node('p',data.reply));render(data.approval,target,true);await refresh();}catch(e){target.textContent=e.message;}finally{b.disabled=false;}});diagnostics.append(b);}
    panel.after(diagnostics);
    const emailForm=node('details');emailForm.style.marginTop='14px';emailForm.append(node('summary','Personal email development test'));
    emailForm.append(node('p','From and to: emmit.atkins@gmail.com. Creating a proposal does not send it. Review the exact content, then approve or decline.'));
    const subject=node('input');subject.type='text';subject.className='field';subject.placeholder='Email subject';subject.setAttribute('aria-label','Development email subject');subject.maxLength=200;
    const body=node('textarea');body.className='field';body.placeholder='Exact email body';body.setAttribute('aria-label','Development email body');body.maxLength=20000;
    const prepare=node('button','Prepare email proposal');prepare.type='button';prepare.className='secondary-button';
    prepare.addEventListener('click',async()=>{prepare.disabled=true;try{const data=await window.CoffeeRunCoach.prepareEmail({sender_account:'personal_gmail_dev',from:'emmit.atkins@gmail.com',to:'emmit.atkins@gmail.com',subject:subject.value,body:body.value,attachments:[]});target.replaceChildren(node('p',data.reply));render(data.approval,target,true);await refresh();}catch(e){target.textContent=e.message;}finally{prepare.disabled=false;}});
    emailForm.append(subject,body,prepare);diagnostics.after(emailForm);
    const calendarForm=node('details');calendarForm.style.marginTop='14px';calendarForm.append(node('summary','Family calendar development test'));
    calendarForm.append(node('p','Prepare a timed event for your iPhone Family Calendar. All times below are Eastern (America/New_York). This test supports a title, time, and location. Review and approve the proposal before running Make.'));
    const title=node('input');title.type='text';title.className='field';title.placeholder='Event title';title.setAttribute('aria-label','Calendar event title');title.maxLength=300;
    const start=node('input');start.type='datetime-local';start.className='field';start.setAttribute('aria-label','Calendar event start');
    const end=node('input');end.type='datetime-local';end.className='field';end.setAttribute('aria-label','Calendar event end');
    const location=node('input');location.type='text';location.className='field';location.placeholder='Location (optional)';location.maxLength=500;
    const prepareCalendar=node('button','Prepare calendar proposal');prepareCalendar.type='button';prepareCalendar.className='secondary-button';
    prepareCalendar.addEventListener('click',async()=>{prepareCalendar.disabled=true;try{const {newYorkTimeToISO}=await import('./calendar-time.mjs');const data=await window.CoffeeRunCoach.prepareCalendar({calendar_account:'personal_icloud_family',title:title.value,start_at:newYorkTimeToISO(start.value),end_at:newYorkTimeToISO(end.value),timezone:'America/New_York',location:location.value,notes:'',all_day:false});target.replaceChildren(node('p',data.reply));render(data.approval,target,true);await refresh();}catch(e){target.textContent=e.message;}finally{prepareCalendar.disabled=false;}});
    calendarForm.append(title,node('p','Start — Eastern time'),start,node('p','End — Eastern time'),end,location,prepareCalendar);emailForm.after(calendarForm);
  });
  window.CoffeeRunApprovals={render,refresh};
})();
