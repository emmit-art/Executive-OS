// Fail-safe visual, authentication, and navigation bootstrap.
(() => {
  const themeId='glass-steel-direct';
  if(!document.getElementById(themeId)){
    const link=document.createElement('link');
    link.id=themeId;link.rel='stylesheet';link.href='/glass-steel.css?v=20260725-3';document.head.appendChild(link);
  }

  import('/auth-rescue.js?v=20260725-1').catch(error=>{
    console.error('Authentication recovery failed',error);
    const message=document.getElementById('authMsg');
    if(message)message.textContent='Executive OS could not start authentication. Refresh once and try again.';
  });

  const activate=tab=>{
    if(!tab||!document.getElementById(tab))return;
    document.querySelectorAll('.section').forEach(section=>section.classList.toggle('active',section.id===tab));
    document.querySelectorAll('[data-tab],[data-simple-tab]').forEach(button=>{
      const target=button.dataset.simpleTab||button.dataset.tab;
      button.classList.toggle('active',target===tab);
    });
    window.scrollTo({top:0,behavior:'smooth'});
  };

  document.addEventListener('click',event=>{
    if(document.body.classList.contains('auth-required'))return;
    const ai=event.target.closest('[data-ai-open],.ai-nav,#aiFab');
    if(ai){event.preventDefault();document.getElementById('aiPanel')?.classList.remove('hidden');return;}
    const nav=event.target.closest('[data-simple-tab],[data-tab]');
    if(!nav)return;
    const tab=nav.dataset.simpleTab||nav.dataset.tab;
    if(!document.getElementById(tab))return;
    event.preventDefault();activate(tab);
  },true);

  window.ExecutiveOSNavigation={activate};
})();

for(const modulePath of ['/notifications.js','/structured-display.js','/executive-memory.js','/executive-radar.js']){
  import(modulePath).catch(error=>console.warn(`Optional module failed: ${modulePath}`,error));
}

(()=>{
  const button=document.getElementById('voiceInput');
  const input=document.getElementById('aiInput');
  const status=document.getElementById('voiceStatus');
  if(!button||!input||!status)return;
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){button.disabled=true;button.textContent='🎙 Voice unavailable';status.textContent='Voice transcription is not supported in this browser. You can still use the iPhone keyboard microphone.';return;}
  const recognition=new SpeechRecognition();recognition.lang='en-US';recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=1;
  let listening=false,startingText='',finalTranscript='';
  const setListening=active=>{listening=active;button.textContent=active?'■ Stop listening':'🎙 Speak';button.setAttribute('aria-pressed',String(active));};
  button.addEventListener('click',()=>{if(listening){recognition.stop();return;}startingText=input.value.trim();finalTranscript='';status.textContent='Listening… speak naturally.';try{recognition.start();}catch{status.textContent='The microphone is already starting. Try again in a moment.';}});
  recognition.onstart=()=>setListening(true);
  recognition.onresult=event=>{let interimTranscript='';for(let i=event.resultIndex;i<event.results.length;i+=1){const transcript=event.results[i][0].transcript;if(event.results[i].isFinal)finalTranscript+=transcript;else interimTranscript+=transcript;}const spoken=`${finalTranscript}${interimTranscript}`.trim();input.value=[startingText,spoken].filter(Boolean).join(startingText&&spoken?' ':'');input.dispatchEvent(new Event('input',{bubbles:true}));status.textContent=interimTranscript?'Listening…':'Transcription ready.';};
  recognition.onerror=event=>{const messages={'not-allowed':'Microphone access was denied. Allow microphone access in Safari settings and try again.','service-not-allowed':'Speech recognition is blocked on this device or browser.','no-speech':'I did not hear anything. Tap Speak and try again.','audio-capture':'No microphone was available.',network:'Voice transcription could not reach the recognition service. Check your connection.'};status.textContent=messages[event.error]||`Voice transcription stopped: ${event.error}.`;};
  recognition.onend=()=>{setListening(false);if(!status.textContent||status.textContent==='Listening…')status.textContent=input.value.trim()?'Transcription ready. Review it, then tap Review & File.':'Tap Speak to try again.';};
})();