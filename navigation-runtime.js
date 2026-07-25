(()=>{
  const activate=(tab)=>{
    if(!tab)return;
    document.querySelectorAll('.section').forEach(section=>section.classList.toggle('active',section.id===tab));
    document.querySelectorAll('[data-tab],[data-simple-tab]').forEach(button=>{
      const target=button.dataset.simpleTab||button.dataset.tab;
      button.classList.toggle('active',target===tab);
    });
    window.scrollTo({top:0,behavior:'smooth'});
  };
  const openAI=()=>document.getElementById('aiPanel')?.classList.remove('hidden');
  document.addEventListener('click',event=>{
    const ai=event.target.closest('[data-ai-open],.ai-nav,#aiFab');
    if(ai){event.preventDefault();openAI();return;}
    const nav=event.target.closest('[data-simple-tab],[data-tab]');
    if(!nav)return;
    const tab=nav.dataset.simpleTab||nav.dataset.tab;
    if(!document.getElementById(tab))return;
    event.preventDefault();activate(tab);
  },true);
  window.ExecutiveOSNavigation={activate,openAI};
  const ensureVisible=()=>{
    const app=document.getElementById('appView');
    if(app&&!app.classList.contains('hidden')){
      const active=document.querySelector('.section.active');
      if(!active)activate('home');
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureVisible);
  else ensureVisible();
  setInterval(ensureVisible,2000);
})();