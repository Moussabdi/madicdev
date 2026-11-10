/* MADIC dashboard.html : redirection historique vers l'espace client CRIC.
   Conserve la query string et le fragment de l'URL d'origine. */
(() => {
  'use strict';
  const target = 'dashboard-client-cric.html' + window.location.search + window.location.hash;
  window.location.replace(target);
})();
