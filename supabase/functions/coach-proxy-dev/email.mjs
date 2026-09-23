export const TEST_MAILBOX='emmit.atkins@gmail.com';
export function validateEmail(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Email details are required.');
 const allowed=['from','to','subject','body','attachments','sender_account'];
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw new Error('Unexpected email fields.');
 if(input.from!==TEST_MAILBOX||input.to!==TEST_MAILBOX||input.sender_account!=='personal_gmail_dev')throw new Error('Development email is limited to the approved personal sender and recipient.');
 if(typeof input.subject!=='string'||!input.subject.trim()||input.subject.length>200||/[\r\n\0]/.test(input.subject))throw new Error('Enter a subject without line breaks (200 characters maximum).');
 if(typeof input.body!=='string'||!input.body.trim()||input.body.length>20000||input.body.includes('\0'))throw new Error('Enter an email body (20,000 characters maximum).');
 if(!Array.isArray(input.attachments)||input.attachments.length>3)throw new Error('At most three attachments are supported.');
 let size=0;
 const attachments=input.attachments.map(a=>{
  if(!a||typeof a!=='object'||Object.keys(a).some(k=>!['filename','content_type','base64'].includes(k)))throw new Error('Invalid attachment.');
  if(typeof a.filename!=='string'||!/^[a-zA-Z0-9_. -]{1,100}$/.test(a.filename)||typeof a.content_type!=='string'||!/^[-a-zA-Z0-9.+]+\/[-a-zA-Z0-9.+]+$/.test(a.content_type)||typeof a.base64!=='string'||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.base64))throw new Error('Invalid attachment filename, type, or content.');
  size+=a.base64.length;if(size>1400000)throw new Error('Attachments exceed the development size limit.');
  return {filename:a.filename,content_type:a.content_type,base64:a.base64};
 });
 return {sender_account:input.sender_account,from:input.from,to:input.to,subject:input.subject,body:input.body,attachments};
}
const b64=s=>btoa(Array.from(new TextEncoder().encode(s),b=>String.fromCharCode(b)).join(''));
const wrap=s=>s.match(/.{1,76}/g)?.join('\r\n')||'';
export function buildEmail(payload,correlationId){
 const p=validateEmail(payload),boundary='coffee_'+correlationId.replaceAll('-','');
 const headers=[`From: ${p.from}`,`To: ${p.to}`,`Subject: =?UTF-8?B?${b64(p.subject)}?=`,`Message-ID: <coffee-${correlationId}@gmail.com>`,'MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${boundary}"`];
 const parts=[`--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(b64(p.body))}`];
 for(const a of p.attachments)parts.push(`--${boundary}\r\nContent-Type: ${a.content_type}\r\nContent-Disposition: attachment; filename="${a.filename}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(a.base64)}`);
 return {payload:p,raw:b64(headers.join('\r\n')+'\r\n\r\n'+parts.join('\r\n')+`\r\n--${boundary}--\r\n`).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')};
}
