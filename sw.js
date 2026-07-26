self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let payload={title:'Coffee Run',body:'You have a new update.',data:{}};
  try{payload={...payload,...event.data.json()};}catch{}
  event.waitUntil(self.registration.showNotification(payload.title||'Coffee Run',{
    body:payload.body||'',
    tag:payload.tag||'coffee-run',
    data:payload.data||{},
    vibrate:[200,100,200],
    renotify:true
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){if('focus'in client)return client.focus();}
    if(clients.openWindow)return clients.openWindow('/?from=push');
  })());
});