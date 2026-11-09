/* Correctif urgent : aucune observation recursive du DOM des contrats. */
(() => {
  'use strict';
  const buttons = document.querySelectorAll('.madic-contracts-language button[data-lang]');
  const labels = {
    fr: {'Mes contrats':'Mes contrats','Voir le contrat':'Voir le contrat','Consulter / signer':'Consulter / signer','Signer le contrat':'Signer le contrat'},
    en: {'Mes contrats':'My contracts','Voir le contrat':'View contract','Consulter / signer':'Review / sign','Signer le contrat':'Sign contract'}
  };
  let language = 'fr';
  try { language = localStorage.getItem('madic-client-language') === 'en' ? 'en' : 'fr'; } catch (_) {}
  const translate = () => {
    document.documentElement.lang = language === 'en' ? 'en-CA' : 'fr-CA';
    document.querySelectorAll('[data-fr][data-en]').forEach(el => {
      const value = el.getAttribute('data-' + language);
      if (el.textContent !== value) el.textContent = value;
    });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lang === language)));
    const root = document.getElementById('madic-contracts');
    if (!root) return;
    root.querySelectorAll('a.madic-initial-open, td:last-child button.secondary').forEach(el => {
      const current = el.textContent.trim();
      const key = Object.keys(labels.fr).find(k => labels.fr[k] === current || labels.en[k] === current);
      if (key && current !== labels[language][key]) el.textContent = labels[language][key];
    });
  };
  buttons.forEach(button => button.addEventListener('click', () => {
    language = button.dataset.lang === 'en' ? 'en' : 'fr';
    try { localStorage.setItem('madic-client-language', language); } catch (_) {}
    translate();
  }));
  translate();
})();
