/* MADIC — Contrats administration : navigation et bilinguisme autonomes. */
(() => {
  'use strict';
  const translations = {
    fr: {header:'Administration des contrats',overview:'Vue d’ensemble',workspace:'Espace professionnel',navigation:'NAVIGATION',secure:'Espace sécurisé MADIC',title:'Contrats des cabinets CRIC',description:"La gestion des contrats de consultation est réservée au cabinet CRIC autorisé. Aucun contrat client n'est chargé depuis l'administration centrale.",access:'Accès professionnel CRIC',clients:'Clients',files:'Dossiers',documents:'Documents',deadlines:'Échéances',billing:'Facturation',finances:'Finances',cabinet:'Cabinet CRIC',langLabel:'Langue du portail'},
    en: {header:'Contracts administration',overview:'Overview',workspace:'Professional workspace',navigation:'NAVIGATION',secure:'Secure MADIC workspace',title:'RCIC firms’ contracts',description:'Management of consultation agreements is reserved for the authorized RCIC firm. No client agreements are loaded from central administration.',access:'RCIC professional access',clients:'Clients',files:'Files',documents:'Documents',deadlines:'Deadlines',billing:'Billing',finances:'Finances',cabinet:'RCIC firm',langLabel:'Portal language'}
  };
  const storageKey = 'madic-language';
  function setLanguage(language) {
    const lang = language === 'en' ? 'en' : 'fr';
    const dict = translations[lang];
    document.documentElement.lang = lang === 'fr' ? 'fr-CA' : 'en-CA';
    document.title = lang === 'fr' ? 'Contrats | MADIC' : 'Contracts | MADIC';
    document.querySelectorAll('[data-i18n]').forEach(el => { const key=el.dataset.i18n; if (dict[key]) el.textContent=dict[key]; });
    document.querySelectorAll('[data-i18n-nav]').forEach(el => {
      const key=el.dataset.i18nNav;
      if (!dict[key]) return;
      const text=Array.from(el.childNodes).find(node=>node.nodeType===Node.TEXT_NODE);
      if (text) text.textContent=' '+dict[key]; else el.append(document.createTextNode(' '+dict[key]));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el=>{const value=dict[el.dataset.i18nAria];if(value)el.setAttribute('aria-label',value);});
    document.querySelectorAll('.madic-lang-controls button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lang===lang)));
    try { localStorage.setItem(storageKey,lang); } catch (_) {}
  }
  function init() {
    const current=(location.pathname.split('/').pop()||'').toLowerCase();
    document.querySelectorAll('.madic-unified-sidebar nav a').forEach(a=>{if(a.getAttribute('href')?.toLowerCase()===current)a.setAttribute('aria-current','page');});
    document.querySelectorAll('.madic-lang-controls button').forEach(button=>button.addEventListener('click',()=>setLanguage(button.dataset.lang)));
    let preferred='fr';try {preferred=localStorage.getItem(storageKey)||'fr';}catch(_){}
    setLanguage(preferred);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
