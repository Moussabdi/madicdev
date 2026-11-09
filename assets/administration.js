/* Administration MADIC : scripts regroupes sans dependances locales additionnelles. */

/* Accès administrateur pour les pages d'accueil et CRIC. La RLS Supabase reste obligatoire. */
(async () => {
  const msg = document.getElementById("adminHomeMessage");
  const home = document.getElementById("adminHome");
  const conf = window.MADIC_CONFIG;
  if (!conf?.url || !conf?.anonKey || !window.supabase) {
    msg.dataset.fr = "Configuration Supabase indisponible.";
    msg.dataset.en = "Supabase configuration unavailable.";
    msg.textContent = window.madicAdminLanguage ? window.madicAdminLanguage(msg.dataset) : msg.dataset.fr;
    return;
  }
  const db = window.getMadicSupabase();
  try {
    const { data: authData, error: authError } = await db.auth.getUser();
    if (authError || !authData?.user) {
      location.replace("connexion.html");
      return;
    }
    const { data: isSuperAdmin, error: roleError } = await db.rpc("madic_is_super_admin");
    if (roleError || isSuperAdmin !== true) {
      location.replace("cric-dashboard.html");
      return;
    }
    home.hidden = false;
    msg.hidden = true;
    document.getElementById("logout")?.addEventListener("click", async () => {
      await db.auth.signOut();
      location.href = "connexion.html";
    });
  } catch (error) {
    msg.dataset.fr = "Impossible de vérifier votre accès : ";
    msg.dataset.en = "Unable to verify your access: ";
    msg.dataset.errorDetail = error.message || String(error);
    msg.textContent = (window.madicAdminLanguage ? window.madicAdminLanguage(msg.dataset) : msg.dataset.fr) + msg.dataset.errorDetail;
  }
})();


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


/* Administration : gestion FR/EN dans le JavaScript existant, sans nouveau script. */
(() => {
  "use strict";
  const switcher = document.getElementById("madicHeroLanguage");
  if (!switcher) return;
  const buttons = [...switcher.querySelectorAll("button[data-lang]")];
  let language = "fr";
  try { language = new URLSearchParams(location.search).get("lang") || localStorage.getItem("madic-lang") || localStorage.getItem("madic-language") || "fr"; } catch (_) {}
  const normalize = value => value === "en" ? "en" : "fr";
  window.madicAdminLanguage = dataset => dataset[normalize(language)] || dataset.fr || "";
  function apply(next) {
    language = normalize(next);
    document.documentElement.lang = language === "en" ? "en-CA" : "fr-CA";
    document.title = language === "en" ? "Administrator dashboard | MADIC" : "Tableau de bord administrateur | MADIC";
    buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.lang === language)));
    document.querySelectorAll(".madic-unified-brand strong[data-fr][data-en], header .brand small[data-fr][data-en]").forEach(el => { el.textContent = el.dataset[language]; });
    document.querySelectorAll("[data-fr][data-en]").forEach(el => {
      if (el.children.length === 0) el.textContent = el.dataset[language];
      if (el.dataset.errorDetail) el.textContent += el.dataset.errorDetail;
    });
    document.querySelectorAll("[data-aria-label-fr][data-aria-label-en]").forEach(el => el.setAttribute("aria-label", el.getAttribute("data-aria-label-" + language)));
    document.querySelectorAll("[data-title-fr][data-title-en]").forEach(el => el.title = el.getAttribute("data-title-" + language));
    try { localStorage.setItem("madic-lang", language); localStorage.setItem("madic-language", language); } catch (_) {}
  }
  buttons.forEach(button => button.addEventListener("click", () => apply(button.dataset.lang)));
  apply(language);
})();
