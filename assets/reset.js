window.MADIC_CONFIG = {
  url: "https://ezijsozitnydhjkxzqem.supabase.co",
  anonKey: "sb_publishable_MQjW5_va454CjZ7weau0iQ_AdJ41yvi",
};
window.getMadicSupabase = function () {
  if (!window.madicSupabaseClient) {
    const cfg = window.MADIC_CONFIG;

    window.madicSupabaseClient = window.supabase.createClient(
      cfg.url,
      cfg.anonKey,
    );
  }

  return window.madicSupabaseClient;
};


(()=>{'use strict';
const dictionary={fr:{success:'Mot de passe mis à jour. Vous pouvez vous connecter.',missing:'Configuration Supabase manquante.',error:'Impossible de mettre à jour le mot de passe.'},en:{success:'Password updated. You can now sign in.',missing:'Supabase configuration is missing.',error:'Unable to update the password.'}};
let lang='fr';try{lang=localStorage.getItem('madic-lang')==='en'?'en':'fr'}catch{}
const applyLang=(value)=>{lang=value==='en'?'en':'fr';document.documentElement.lang=lang==='fr'?'fr-CA':'en';document.querySelectorAll('[data-fr][data-en]').forEach(el=>{el.textContent=el.dataset[lang]});document.querySelectorAll('.madic-lang-controls button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));try{localStorage.setItem('madic-lang',lang)}catch{}};
document.querySelectorAll('.madic-lang-controls button').forEach(b=>b.addEventListener('click',()=>applyLang(b.dataset.lang)));applyLang(lang);
const message=document.querySelector('#message');const status=(value,error=false)=>{if(message){message.textContent=value;message.className=error?'notice danger':'notice ok'}};
const cfg=window.MADIC_CONFIG;const valid=!!(cfg&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url)&&typeof cfg.anonKey==='string'&&!cfg.anonKey.includes('YOUR_')&&window.supabase);
if(!valid){status(dictionary[lang].missing,true);return}
const db=window.getMadicSupabase();document.querySelector('#reset')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button');if(button)button.disabled=true;try{const {error}=await db.auth.updateUser({password:form.elements.password.value});status(error?error.message:dictionary[lang].success,!!error)}catch(error){status(error?.message||dictionary[lang].error,true)}finally{if(button)button.disabled=false}});
})();
