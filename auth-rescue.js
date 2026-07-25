import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

const sb=createClient(
  "https://hnvvvdibncwlplweeuod.supabase.co",
  "sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1",
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}}
);

const $=id=>document.getElementById(id);
let redirecting=false;

function showSession(session){
  const signedIn=!!session?.user;
  document.body.classList.toggle("auth-required",!signedIn);
  $("authView")?.classList.toggle("hidden",signedIn);
  $("appView")?.classList.toggle("hidden",!signedIn);
  if(signedIn){
    const email=$("userEmail");
    if(email)email.textContent=session.user.email||"";
    if(!redirecting){
      redirecting=true;
      setTimeout(()=>window.dispatchEvent(new CustomEvent("executive-os-session-ready",{detail:{session}})),0);
    }
  }
}

async function signIn(){
  const button=$("signIn"),message=$("authMsg");
  const email=$("email")?.value.trim(),password=$("password")?.value||"";
  if(!email||!password){if(message)message.textContent="Enter your email and password.";return;}
  if(button)button.disabled=true;
  if(message)message.textContent="Signing in…";
  try{
    const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error)throw error;
    showSession(data.session);
    if(message)message.textContent="Signed in. Loading your dashboard…";
    setTimeout(()=>location.reload(),250);
  }catch(error){
    if(message)message.textContent=error?.message||"Sign in failed. Please try again.";
  }finally{if(button)button.disabled=false;}
}

async function signUp(){
  const message=$("authMsg"),email=$("email")?.value.trim(),password=$("password")?.value||"";
  if(!email||password.length<6){if(message)message.textContent="Enter an email and a password of at least 6 characters.";return;}
  const {error}=await sb.auth.signUp({email,password,options:{data:{display_name:"Emmit"}}});
  if(message)message.textContent=error?.message||"Account created. Check your email if confirmation is required.";
}

function bind(){
  $("signIn")?.addEventListener("click",event=>{event.preventDefault();event.stopImmediatePropagation();signIn();},true);
  $("signUp")?.addEventListener("click",event=>{event.preventDefault();event.stopImmediatePropagation();signUp();},true);
  $("password")?.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();signIn();}});
}

bind();
const {data:{session}}=await sb.auth.getSession();
showSession(session);
sb.auth.onAuthStateChange((_event,nextSession)=>showSession(nextSession));
