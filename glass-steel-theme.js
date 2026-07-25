function installGlassSteelTheme(){
 if(document.body.dataset.glassSteelTheme)return;
 document.body.dataset.glassSteelTheme="true";
 document.documentElement.style.colorScheme="light";
 const style=document.createElement("style");
 style.id="glassSteelTheme";
 style.textContent=`
 :root{--bg:#e9eef5!important;--panel:rgba(255,255,255,.48)!important;--panel-strong:rgba(255,255,255,.64)!important;--text:#14233c!important;--muted:#66758b!important;--line:rgba(255,255,255,.82)!important;--blue:#1261f4!important;--blue-soft:#dce9ff!important;--shadow:0 14px 34px rgba(49,68,96,.16),inset 0 1px 0 rgba(255,255,255,.9)!important}
 *{box-sizing:border-box}
 html{background:#dfe6ef!important}
 body{color:var(--text)!important;background:radial-gradient(circle at 12% 8%,rgba(255,255,255,.98),transparent 32%),radial-gradient(circle at 88% 22%,rgba(184,204,230,.72),transparent 38%),linear-gradient(145deg,#f5f7fb 0%,#dce4ee 50%,#cbd5e2 100%)!important;background-attachment:fixed!important;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif!important;min-height:100vh}
 body:before{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.42),transparent 28%,rgba(255,255,255,.12) 55%,transparent 80%);mix-blend-mode:screen;z-index:-1}
 .app-shell,.app{background:transparent!important}
 main{max-width:980px!important;margin:0 auto!important;padding-bottom:128px!important}
 .app-header{background:transparent!important;border:0!important;box-shadow:none!important;padding:24px 22px 8px!important;color:var(--text)!important}
 .app-header h1{color:var(--text)!important;font-size:clamp(2rem,7vw,3rem)!important;letter-spacing:-.045em!important}
 .app-header .eyebrow,.eyebrow{color:#52627a!important;letter-spacing:.22em!important;font-weight:800!important}
 .muted,.empty,.status{color:var(--muted)!important}
 .desktop-nav{background:rgba(255,255,255,.38)!important;border:1px solid rgba(255,255,255,.72)!important;box-shadow:var(--shadow)!important;backdrop-filter:blur(24px) saturate(140%)!important;-webkit-backdrop-filter:blur(24px) saturate(140%)!important}
 .desktop-nav button{color:#53637a!important;border-radius:14px!important}
 .desktop-nav button.active{color:#0d57dc!important;background:rgba(255,255,255,.74)!important;box-shadow:0 7px 18px rgba(42,77,128,.14)!important}
 #simpleHome{padding:4px 18px 24px!important}
 .simple-hero{margin:2px 0 22px!important;align-items:center!important}
 .simple-hero .eyebrow{display:none!important}
 .simple-hero h2{color:var(--text)!important;font-size:clamp(2.1rem,8vw,3.5rem)!important;line-height:1.02!important;letter-spacing:-.048em!important;margin:0 0 8px!important;max-width:720px}
 .simple-hero #simpleDate{font-size:1.05rem!important;color:#5e6d83!important}
 .simple-refresh{width:70px!important;height:70px!important;border-radius:22px!important;border:1px solid rgba(255,255,255,.86)!important;background:linear-gradient(145deg,rgba(255,255,255,.72),rgba(229,236,246,.4))!important;color:#145ad8!important;box-shadow:0 12px 26px rgba(49,74,112,.15),inset 0 1px 0 #fff!important;backdrop-filter:blur(20px)!important;font-size:1.65rem!important}
 .chief-brief,.simple-stat,.simple-primary,.simple-panel,.simple-capture button,.connection-row,.restore-panel,.restore-stat,.panel,.card{background:linear-gradient(145deg,rgba(255,255,255,.66),rgba(226,233,243,.38))!important;border:1px solid rgba(255,255,255,.92)!important;color:var(--text)!important;box-shadow:var(--shadow)!important;backdrop-filter:blur(26px) saturate(135%)!important;-webkit-backdrop-filter:blur(26px) saturate(135%)!important;border-radius:22px!important}
 .chief-brief{padding:24px!important;margin-bottom:18px!important}
 .chief-head h3{color:var(--text)!important;font-size:1.28rem!important;letter-spacing:-.02em!important}
 .chief-live{color:#1261f4!important;font-weight:700!important}
 .chief-line{grid-template-columns:34px 1fr 18px!important;align-items:center!important;border-bottom:1px solid rgba(99,118,145,.13)!important;padding:13px 0!important}
 .chief-line:after{content:"›";font-size:1.55rem;color:#6c7a8e}
 .chief-icon{display:grid!important;place-items:center!important;width:29px!important;height:29px!important;border-radius:8px!important;color:#1261f4!important;background:rgba(18,97,244,.08)!important;border:1px solid rgba(18,97,244,.15)!important}
 .chief-line strong,.simple-item strong,.simple-alert b,.restore-task strong{color:var(--text)!important;font-weight:600!important}
 .chief-line small,.simple-item small,.simple-alert small,.restore-task small,.simple-stat small,.restore-stat small,.connection-row small{color:var(--muted)!important}
 .text-action,a{color:#075bea!important;font-weight:700!important}
 .simple-summary{display:none!important}
 .simple-primary{position:relative!important;padding:22px 24px!important;margin-bottom:18px!important;border-radius:21px!important}
 .simple-primary:before{content:"";position:absolute;left:16px;top:16px;width:3px;height:25px;background:#1769ff;border-radius:99px}
 .simple-primary>.eyebrow{padding-left:18px!important}
 .simple-first-title{font-size:1.16rem!important;color:var(--text)!important;margin:15px 0 5px!important;padding-right:72px!important}
 .simple-first-meta{color:#52627a!important;margin-bottom:0!important;padding-right:72px!important}
 .simple-primary .btn{margin-top:14px!important}
 .chief-score-row{position:absolute!important;right:18px!important;top:50%!important;transform:translateY(-8%)!important;display:block!important;margin:0!important}
 .chief-score-chip{display:none!important}
 .chief-score-chip:first-child{display:grid!important;place-items:center!important;width:64px!important;height:64px!important;border-radius:50%!important;background:conic-gradient(#1769ff 0 82%,rgba(125,154,196,.2) 82%)!important;color:#14233c!important;font-weight:800!important;font-size:.76rem!important;border:5px solid rgba(255,255,255,.85)!important;box-shadow:0 7px 18px rgba(30,92,201,.2)!important;text-align:center!important;padding:8px!important}
 .simple-two{grid-template-columns:1fr 1fr!important;gap:14px!important;margin-bottom:18px!important}
 .simple-panel{padding:18px!important}
 .simple-panel-head h3{color:var(--text)!important;font-size:1.04rem!important}
 .simple-item{border-bottom:1px solid rgba(99,118,145,.13)!important;padding:10px 0!important;gap:9px!important}
 .simple-time{color:#263a58!important;min-width:68px!important;font-size:.86rem!important}
 .simple-alert{border-bottom:1px solid rgba(99,118,145,.13)!important;padding:10px 0!important}
 .simple-capture{position:sticky!important;bottom:93px!important;z-index:20!important;margin:18px 0 8px!important}
 .simple-capture button{border-radius:999px!important;padding:15px 17px!important;background:linear-gradient(145deg,rgba(255,255,255,.7),rgba(190,202,220,.52))!important}
 .simple-capture span{display:grid!important;place-items:center!important;width:44px!important;height:44px!important;border-radius:16px!important;background:rgba(255,255,255,.5)!important;color:#28415f!important}
 .simple-capture b{display:grid!important;place-items:center!important;width:48px!important;height:48px!important;border-radius:50%!important;background:linear-gradient(145deg,#5f9bff,#155ff2)!important;color:white!important;box-shadow:0 9px 24px rgba(23,100,242,.35)!important;font-size:0!important}
 .simple-capture b:after{content:"🎙";font-size:1.15rem}
 .bottom-nav{position:fixed!important;left:max(12px,calc(50% - 470px))!important;right:max(12px,calc(50% - 470px))!important;bottom:12px!important;z-index:50!important;padding:9px 8px calc(9px + env(safe-area-inset-bottom))!important;border-radius:25px!important;background:linear-gradient(145deg,rgba(255,255,255,.64),rgba(191,202,219,.55))!important;border:1px solid rgba(255,255,255,.9)!important;box-shadow:0 18px 42px rgba(39,60,91,.23),inset 0 1px 0 rgba(255,255,255,.95)!important;backdrop-filter:blur(30px) saturate(150%)!important;-webkit-backdrop-filter:blur(30px) saturate(150%)!important}
 .bottom-nav button{color:#52627a!important;border-radius:18px!important;min-height:62px!important}
 .bottom-nav button.active{color:#125fed!important;background:rgba(255,255,255,.38)!important}
 .bottom-nav button span{font-size:1.35rem!important}
 .bottom-nav .ai-nav{transform:translateY(-16px)!important;background:radial-gradient(circle at 35% 25%,#fff,rgba(255,255,255,.5) 33%,rgba(183,201,227,.62))!important;border:1px solid rgba(255,255,255,.95)!important;border-radius:50%!important;width:66px!important;height:66px!important;margin:auto!important;box-shadow:0 0 0 5px rgba(255,255,255,.22),0 12px 26px rgba(62,83,118,.22)!important;color:#125fed!important}
 .bottom-nav .ai-nav small{margin-top:12px!important;color:#203451!important}
 .page-title h2{color:var(--text)!important;letter-spacing:-.035em!important}
 .section{color:var(--text)!important}
 .field,input,textarea,select{background:rgba(255,255,255,.55)!important;border:1px solid rgba(255,255,255,.9)!important;color:var(--text)!important;box-shadow:inset 0 1px 0 white!important;border-radius:15px!important}
 .btn{background:linear-gradient(145deg,#327bff,#0757e6)!important;color:white!important;border:0!important;border-radius:14px!important;box-shadow:0 8px 20px rgba(18,97,244,.24)!important}
 .btn.secondary{background:rgba(255,255,255,.55)!important;color:#145ad8!important;border:1px solid rgba(255,255,255,.9)!important}
 .task-score,.chief-score-chip,.connection-state{background:rgba(18,97,244,.09)!important;color:#0d59df!important;border:1px solid rgba(18,97,244,.14)!important}
 .connection-state.connected{color:#087b5d!important;background:rgba(31,181,132,.1)!important}
 .connection-icon{background:rgba(255,255,255,.5)!important;color:#145ad8!important;border:1px solid rgba(255,255,255,.85)!important}
 #aiPanel,.modal,.drawer{background:rgba(232,238,246,.88)!important;color:var(--text)!important;backdrop-filter:blur(30px)!important}
 @media(max-width:700px){
  .app-header{padding:18px 18px 4px!important}.app-header h1{font-size:2rem!important}.app-header p{display:none!important}
  #simpleHome{padding:0 14px 18px!important}.simple-hero{margin-top:6px!important}.simple-hero h2{font-size:2.35rem!important;max-width:275px}.simple-refresh{width:62px!important;height:62px!important;border-radius:20px!important}
  .chief-brief{padding:20px!important}.chief-head h3{font-size:1.08rem!important}.chief-line{font-size:.9rem!important}
  .simple-two{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:10px!important}.simple-panel{padding:14px!important}.simple-panel .eyebrow{font-size:.62rem!important}.simple-panel-head h3{font-size:.92rem!important}.simple-time{min-width:56px!important;font-size:.75rem!important}.simple-item strong{font-size:.78rem!important}.simple-item small{font-size:.7rem!important}
  .simple-alert b{font-size:.78rem!important}.simple-alert small{font-size:.68rem!important}.bottom-nav{left:10px!important;right:10px!important;bottom:8px!important}.bottom-nav button small{font-size:.68rem!important}
  .restore-grid{grid-template-columns:repeat(2,1fr)!important}.restore-two{grid-template-columns:1fr!important}
 }
 @media(max-width:365px){.simple-two{grid-template-columns:1fr!important}.simple-hero h2{font-size:2rem!important}.chief-score-row{position:static!important;transform:none!important;margin-top:12px!important}}
 `;
 document.head.appendChild(style);
 const updateLabels=()=>{
  const header=document.querySelector('.app-header');
  if(header){const p=header.querySelector('p');if(p)p.textContent='Personal Chief of Staff'}
  document.querySelectorAll('.bottom-nav button').forEach(btn=>btn.setAttribute('aria-label',btn.textContent.trim()));
 };
 updateLabels();
 new MutationObserver(updateLabels).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installGlassSteelTheme);else installGlassSteelTheme();
