// Complément visuel uniquement : conserve assets/app.js comme source des données Supabase.
(() => {
  if (document.body.dataset.page !== 'admin') return;
  const tbody = document.getElementById('clients');
  const counter = document.getElementById('adminClientCount');
  const search = document.getElementById('adminClientSearch');
  if (!tbody || !counter || !search) return;
  const refresh = () => {
    const rows = Array.from(tbody.querySelectorAll('tr'));
    counter.textContent = String(rows.length);
    const q = search.value.trim().toLocaleLowerCase('fr');
    rows.forEach(row => {
      row.hidden = Boolean(q) && !row.textContent.toLocaleLowerCase('fr').includes(q);
    });
  };
  const observer = new MutationObserver(refresh);
  observer.observe(tbody, {childList:true});
  search.addEventListener('input', refresh);
  refresh();
})();
