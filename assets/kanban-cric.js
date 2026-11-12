/* MADIC Kanban - consolidated from user-supplied current sources */
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

(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    statuses = ["en_attente", "actif", "ferme"],
    labels = { en_attente: "En attente", actif: "Actif", ferme: "Fermé" };
  const notice = (t) => {
    $("kbMessage").textContent = t;
  };
  const cfg = window.MADIC_CONFIG;
  if (
    !cfg?.url ||
    !cfg?.anonKey ||
    !window.supabase ||
    typeof window.getMadicSupabase !== "function"
  )
    return notice("Configuration Supabase manquante.");
  const db = window.getMadicSupabase();
  let space = null,
    records = [],
    saving = false;
  $("kbLogout").addEventListener("click", async () => {
    await db.auth.signOut();
    location.replace("connexion-cric.html");
  });
  function render() {
    const counts = { en_attente: 0, actif: 0, ferme: 0 };
    for (const item of records) if (Object.prototype.hasOwnProperty.call(counts, item.status)) counts[item.status]++;
    for (const [id, value] of [["kbTotal", records.length], ["kbSummaryWaiting", counts.en_attente], ["kbSummaryActive", counts.actif], ["kbSummaryClosed", counts.ferme]]) {
      $(id).textContent = String(value);
    }
    const q = $("kbSearch").value.trim().toLocaleLowerCase("fr");
    for (const s of statuses) {
      const list = $("kbList-" + s);
      list.replaceChildren();
      const matches = records.filter(
        (d) =>
          d.status === s &&
          [d.reference, d.category]
            .join(" ")
            .toLocaleLowerCase("fr")
            .includes(q),
      );
      $("kbCount-" + s).textContent = "(" + matches.length + ")";
      for (const d of matches) {
        const card = document.createElement("article");
        card.className = "kb-card";
        card.draggable = true;
        card.dataset.id = d.id;
        const title = document.createElement("strong");
        title.textContent = d.reference || "Dossier";
        const cat = document.createElement("p");
        cat.textContent = d.category || "Sans catégorie";
        const label = document.createElement("label");
        label.textContent = "Statut";
        const select = document.createElement("select");
        for (const value of statuses) {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = labels[value];
          select.append(opt);
        }
        select.value = d.status;
        select.addEventListener("change", () => changeStatus(d, select.value));
        label.append(select);
        card.append(title, cat, label);
        card.addEventListener("dragstart", (event) => {
          event.dataTransfer.setData("text/plain", d.id);
          event.dataTransfer.effectAllowed = "move";
        });
        list.append(card);
      }
      if (!matches.length) {
        const empty = document.createElement("p");
        empty.className = "kb-empty";
        empty.textContent = "Aucun dossier";
        list.append(empty);
      }
    }
  }
  async function load() {
    const { data, error } = await db
      .from("dossiers")
      .select("id,reference,category,status")
      .eq("space_id", space.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    records = data || [];
    render();
    notice(records.length + " dossier(s) visibles dans votre espace CRIC.");
  }
  async function changeStatus(d, next) {
    if (saving || !statuses.includes(next)) return render();
    if (next === d.status) return;
    saving = true;
    notice("Enregistrement du statut…");
    try {
      const { data, error } = await db
        .from("dossiers")
        .update({ status: next })
        .eq("id", d.id)
        .eq("space_id", space.id)
        .select("id,status");
      if (error) throw error;
      if (!data || data.length !== 1 || data[0].status !== next)
        throw Error(
          "Modification non confirmée. Vérifiez les autorisations RLS.",
        );
      d.status = next;
      render();
      notice(
        "Statut enregistré : " +
          (d.reference || "Dossier") +
          " - " +
          labels[next] +
          ".",
      );
    } catch (e) {
      render();
      notice("Statut non modifié : " + (e.message || String(e)));
    } finally {
      saving = false;
    }
  }
  for (const column of document.querySelectorAll(".kb-column")) {
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      column.classList.add("kb-over");
    });
    column.addEventListener("dragleave", () =>
      column.classList.remove("kb-over"),
    );
    column.addEventListener("drop", async (e) => {
      e.preventDefault();
      column.classList.remove("kb-over");
      const id = e.dataTransfer.getData("text/plain"),
        d = records.find((x) => x.id === id);
      if (d) await changeStatus(d, column.dataset.status);
    });
  }
  $("kbSearch").addEventListener("input", render);
  $("kbRefresh").addEventListener("click", () =>
    load().catch((e) => notice("Actualisation impossible : " + e.message)),
  );
  try {
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      location.replace("connexion-cric.html");
      return;
    }
    const uid = auth.user.id;
    const { data: app, error: appError } = await db
      .from("madic_cric_applications")
      .select("status")
      .eq("user_id", uid)
      .maybeSingle();
    if (appError) throw appError;
    if (app?.status !== "approved") throw Error("Compte CRIC non approuvé.");
    const { data: spaces, error: spaceError } = await db
      .from("madic_cric_spaces")
      .select("id,name,access_status")
      .eq("owner_user_id", uid)
      .limit(1);
    if (spaceError) throw spaceError;
    space = spaces?.[0];
    if (!space || space.access_status !== "active")
      throw Error("Espace CRIC absent ou suspendu.");
    const { data: allowed, error: permissionError } = await db.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: space.id },
    );
    if (permissionError || allowed !== true)
      throw Error("Accès à cet espace refusé.");
    $("kbSpace").textContent = "Cabinet : " + space.name;
    $("kbWorkspace").hidden = false;
    await load();
  } catch (e) {
    notice("Accès impossible : " + (e.message || String(e)));
  }
})();

/* Footer commun MADIC : traduction des libellés sur les pages sans gestionnaire FR/EN. */
(function(){"use strict";function apply(lang){lang=lang==="en"?"en":"fr";document.querySelectorAll(".madic-footer [data-fr][data-en]").forEach(function(el){el.textContent=el.getAttribute("data-"+lang);});}var lang="fr";try{lang=new URLSearchParams(location.search).get("lang")||localStorage.getItem("madic-lang")||"fr";}catch(e){}apply(lang);window.addEventListener("storage",function(e){if(e.key==="madic-lang")apply(e.newValue);});})();


/* Kanban page language control; preserves the existing Kanban workflow. */
(function(){'use strict';
 const key='madic-lang';let lang='fr';try{lang=localStorage.getItem(key)==='en'?'en':'fr';}catch(e){}
 const pairs={
 'Suivi visuel des dossiers':'Visual case tracking','ESPACE PROFESSIONNEL CRIC':'RCIC PROFESSIONAL SPACE',
 'Visualisez les dossiers par statut et mettez à jour leur progression.':'View cases by status and update their progress.',
 'Vérification des droits…':'Checking permissions…','PILOTAGE DES DOSSIERS':'CASE MANAGEMENT',
 'Votre activité, en un coup d’œil.':'Your activity at a glance.',
 'Suivez les dossiers autorisés et faites progresser leur traitement par étape.':'Track authorized cases and move them through each stage.',
 'Total des dossiers':'Total cases','Dans votre cabinet':'In your practice','En attente':'Pending',
 'À prendre en charge':'To be handled','Actifs':'Active','En cours de traitement':'In progress',
 'Fermés':'Closed','Dossiers clôturés':'Closed cases','Outils professionnels CRIC':'RCIC professional tools',
 'Gestion des clients':'Client management','Rechercher un dossier':'Search for a case',
 'Référence ou catégorie':'Reference or category','Actualiser':'Refresh','Créer un dossier →':'Create a case →',
 'Déconnexion':'Sign out','Mon espace':'My space','Vue d’ensemble':'Overview',
 'Clients':'Clients','Outils CRIC':'RCIC tools','Messagerie':'Messaging','Rendez-vous':'Appointments',
 'Documents':'Documents','Échéances':'Deadlines','Facturation':'Billing','Finances':'Finances',
 'Mon profil professionnel':'My professional profile','Espace professionnel':'Professional space',
 'NAVIGATION':'NAVIGATION','Espace sécurisé MADIC':'Secure MADIC space',
 'Statut':'Status','Fermé':'Closed','Actif':'Active','Dossier':'Case','Sans catégorie':'Uncategorized'
 };
 const reverse=Object.fromEntries(Object.entries(pairs).map(([a,b])=>[b,a]));
 function apply(next){lang=next==='en'?'en':'fr';document.documentElement.lang=lang==='en'?'en-CA':'fr-CA';
 document.querySelectorAll('[data-fr][data-en]').forEach(el=>{el.textContent=el.getAttribute('data-'+lang);});
 document.querySelectorAll('[data-madic-fr][data-madic-en]:not([data-fr])').forEach(el=>{el.textContent=el.getAttribute('data-madic-'+lang);});
 document.querySelectorAll('main, aside, header').forEach(root=>{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(node.parentElement?.closest('script,style,[data-fr][data-en],[data-madic-fr][data-madic-en]'))continue;const raw=node.nodeValue;const trimmed=raw.trim();if(!trimmed)continue;const translated=lang==='en'?pairs[trimmed]:reverse[trimmed];if(translated)node.nodeValue=raw.replace(trimmed,translated);}});
 document.querySelectorAll('.madic-lang-controls button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
 document.querySelectorAll('#kbSearch').forEach(el=>{el.placeholder=lang==='en'?'Reference or category':'Référence ou catégorie';});
 }
 document.querySelectorAll('.madic-lang-controls button').forEach(b=>b.addEventListener('click',()=>{try{localStorage.setItem(key,b.dataset.lang);}catch(e){}apply(b.dataset.lang);}));
 apply(lang);
 const observer=new MutationObserver(()=>{if(lang==='en'){observer.disconnect();apply('en');observer.observe(document.querySelector('#kbWorkspace')||document.body,{childList:true,subtree:true});}});
 observer.observe(document.querySelector('#kbWorkspace')||document.body,{childList:true,subtree:true});
})();
