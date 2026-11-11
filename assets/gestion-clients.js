/* MADIC : navigation CRIC uniforme. Icones Heroicons identiques au tableau de bord. */
(() => {
  "use strict";
  const init = () => {
    const sidebar = document.querySelector(".madic-unified-sidebar");
    if (!sidebar || !sidebar.querySelector(".madic-unified-brand small")?.textContent.includes("Espace professionnel")) return;
    const nav = sidebar.querySelector("nav");
    if (!nav) return;
    const iconBase = "https://raw.githubusercontent.com/tailwindlabs/heroicons/v2.2.0/optimized/24/outline/";
    const items = [
      ["cric-dashboard.html", "Vue d’ensemble", "squares-2x2", ""],
      ["gestion-clients-cric.html", "Clients", "users", "madic-v2-group-start"],
      ["gestion-dossiers-cric.html", "Outils CRIC", "folder-open", ""],
      ["messagerie-cric.html", "Messagerie", "chat-bubble-left-right", "madic-v2-group-start"],
      ["rendez-vous-cric.html", "Rendez-vous", "calendar-days", ""],
      ["demandes-documents-cric.html", "Documents", "document-text", ""],
      ["echeances-cric.html", "Échéances", "calendar-days", ""],
      ["facturation-cric.html", "Facturation", "receipt-percent", "madic-v2-group-start"],
      ["finances-cric.html", "Finances", "banknotes", ""],
      ["profil-professionnel-cric.html", "Mon profil professionnel", "identification", ""]
    ];
    const current = (location.pathname.split("/").pop() || "cric-dashboard").replace(/\.html$/, "") + ".html";
    const fragment = document.createDocumentFragment();
    for (const [href, label, iconName, group] of items) {
      const link = document.createElement("a");
      link.href = href;
      link.dataset.madicPage = href;
      if (group) link.className = group;
      if (current === href) link.setAttribute("aria-current", "page");
      const holder = document.createElement("span");
      holder.setAttribute("aria-hidden", "true");
      const img = document.createElement("img");
      img.className = "madic-heroicon";
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.loading = "eager";
      img.decoding = "async";
      img.src = iconBase + iconName + ".svg";
      holder.appendChild(img);
      link.append(holder, document.createTextNode(label));
      fragment.appendChild(link);
    }
    nav.replaceChildren(fragment);
    const brand = sidebar.querySelector(".madic-unified-monogram");
    if (brand) {
      const logo = document.createElement("img");
      logo.src = "img/logo-madic.svg";
      logo.alt = "Logo MADIC";
      brand.replaceChildren(logo);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();

/* Interactions autonomes de la page d'orientation gestion-clients. */
(()=>{'use strict';
 const dictionary={'Vue d’ensemble':'Overview','Clients':'Clients','Outils CRIC':'RCIC tools','Messagerie':'Messaging','Rendez-vous':'Appointments','Documents':'Documents','Échéances':'Deadlines','Facturation':'Billing','Finances':'Finances','Mon profil professionnel':'My professional profile','Espace professionnel':'Professional workspace','Espace sécurisé MADIC':'Secure MADIC workspace','NAVIGATION':'NAVIGATION'};
 function setLanguage(lang){lang=lang==='en'?'en':'fr';document.documentElement.lang=lang==='en'?'en-CA':'fr-CA';document.querySelectorAll('[data-fr][data-en]').forEach(e=>{e.textContent=e.getAttribute('data-'+lang)});document.querySelectorAll('.madic-unified-sidebar nav a').forEach(a=>{let node=[...a.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(!node)return;const fr=a.dataset.originalFr||(a.dataset.originalFr=node.textContent.trim());node.textContent=lang==='en'?(dictionary[fr]||fr):fr;});document.querySelectorAll('.madic-lang-controls button[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));try{localStorage.setItem('madic-lang',lang)}catch(e){}}
 function init(){let lang='fr';try{lang=new URLSearchParams(location.search).get('lang')||localStorage.getItem('madic-lang')||'fr'}catch(e){}setLanguage(lang);document.querySelectorAll('.madic-lang-controls button[data-lang]').forEach(b=>b.addEventListener('click',()=>setLanguage(b.dataset.lang)));
 const logout=document.getElementById('cricLogout');if(logout)logout.addEventListener('click',async()=>{logout.disabled=true;try{if(typeof window.getMadicSupabase==='function'){await window.getMadicSupabase().auth.signOut()}else if(window.supabaseClient?.auth){await window.supabaseClient.auth.signOut()}else{logout.disabled=false;alert(lang==='en'?'Sign-out service unavailable.':'Service de déconnexion indisponible.');return;}location.href='connexion.html'}catch(e){logout.disabled=false;alert(e?.message||String(e))}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
