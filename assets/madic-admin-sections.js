/* MADIC - sections et tableaux, sans mutation Supabase ni changement des actions existantes. */
(() => {
  "use strict";
  const ids = [
    "consultants-management",
    "cabinet-management",
    "payment-management",
  ];
  const nav = [...document.querySelectorAll(".madic-unified-sidebar nav a")];
  const tabs = [...document.querySelectorAll("[data-admin-section]")];
  const getSection = () =>
    ids.includes(location.hash.slice(1)) ? location.hash.slice(1) : ids[0];
  function activate() {
    const current = getSection();
    for (const id of ids) document.getElementById(id).hidden = id !== current;
    for (const a of [...nav, ...tabs]) {
      const target = a.getAttribute("href")?.split("#")[1];
      if (ids.includes(target) && target === current)
        a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  }
  window.addEventListener("hashchange", () => {
    activate();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  activate();
  const pageSize = 20;
  for (const tools of document.querySelectorAll(".madic-admin-table-tools")) {
    const tbody = document.getElementById(tools.dataset.table);
    if (!tbody) continue;
    const input = tools.querySelector("input");
    const count = tools.querySelector(".madic-admin-table-count");
    const prev = tools.querySelector("[data-prev]");
    const next = tools.querySelector("[data-next]");
    const info = tools.querySelector("[data-page-info]");
    let page = 0;
    function render() {
      const all = [...tbody.rows];
      const query = input.value.trim().toLocaleLowerCase("fr");
      const filtered = all.filter(
        (row) =>
          !query || row.textContent.toLocaleLowerCase("fr").includes(query),
      );
      const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
      page = Math.min(page, pages - 1);
      const visible = new Set(
        filtered.slice(page * pageSize, (page + 1) * pageSize),
      );
      for (const row of all) row.hidden = !visible.has(row);
      count.textContent = `${filtered.length} résultat(s)`;
      info.textContent = `Page ${page + 1} / ${pages}`;
      prev.disabled = page === 0;
      next.disabled = page >= pages - 1;
    }
    input.addEventListener("input", () => {
      page = 0;
      render();
    });
    prev.addEventListener("click", () => {
      page--;
      render();
    });
    next.addEventListener("click", () => {
      page++;
      render();
    });
    const observer = new MutationObserver(() => render());
    observer.observe(tbody, { childList: true });
    render();
  }
})();
