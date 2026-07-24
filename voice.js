import('/notifications.js');
import('/timing-enhancer.js');
(() => {
  const button = document.getElementById("voiceInput");
  const input = document.getElementById("aiInput");
  const status = document.getElementById("voiceStatus");
  if (!button || !input || !status) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {button.disabled=true;button.textContent="🎙 Voice unavailable";status.textContent="Voice transcription is not supported in this browser. You can still use the iPhone keyboard microphone.";return;}
  const recognition=new SpeechRecognition();recognition.lang="en-US";recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=1;
  let listening=false,startingText="",finalTranscript="";
  const setListening=active=>{listening=active;button.textContent=active?"■ Stop listening":"🎙 Speak";button.setAttribute("aria-pressed",String(active));};
  button.addEventListener("click",()=>{if(listening){recognition.stop();return;}startingText=input.value.trim();finalTranscript="";status.textContent="Listening… speak naturally.";try{recognition.start();}catch(error){status.textContent="The microphone is already starting. Try again in a moment.";}});
  recognition.onstart=()=>setListening(true);
  recognition.onresult=event=>{let interimTranscript="";for(let i=event.resultIndex;i<event.results.length;i+=1){const transcript=event.results[i][0].transcript;if(event.results[i].isFinal)finalTranscript+=transcript;else interimTranscript+=transcript;}const spoken=`${finalTranscript}${interimTranscript}`.trim();input.value=[startingText,spoken].filter(Boolean).join(startingText&&spoken?" ":"");input.dispatchEvent(new Event('input',{bubbles:true}));status.textContent=interimTranscript?"Listening…":"Transcription ready.";};
  recognition.onerror=event=>{const messages={"not-allowed":"Microphone access was denied. Allow microphone access in Safari settings and try again.","service-not-allowed":"Speech recognition is blocked on this device or browser.","no-speech":"I did not hear anything. Tap Speak and try again.","audio-capture":"No microphone was available.",network:"Voice transcription could not reach the recognition service. Check your connection."};status.textContent=messages[event.error]||`Voice transcription stopped: ${event.error}.`;};
  recognition.onend=()=>{setListening(false);if(!status.textContent||status.textContent==="Listening…")status.textContent=input.value.trim()?"Transcription ready. Review it, then tap Review & File.":"Tap Speak to try again.";};
})();