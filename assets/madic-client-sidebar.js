/* Préférences locales de navigation : aucun changement des données Supabase. */
(function () {
  if (document.currentScript?.hasAttribute("data-madic-guest-portal")) return;
  const sidebar = document.querySelector(".madic-side-nav");
  const nav = sidebar?.querySelector(".madic-side-links");
  const toggle = document.getElementById("madicCustomizeNav");
  const reset = document.getElementById("madicResetNav");
  const help = document.getElementById("madicNavHelp");
  if (!nav || !toggle || !reset) return;
  const storageKey = "madic-client-nav-order-v2";
  const entries = () => Array.from(nav.querySelectorAll(".madic-nav-entry"));
  const save = () => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(entries().map((el) => el.dataset.navKey)),
      );
    } catch (_) {}
  };
  try {
    const order = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (Array.isArray(order)) {
      const byKey = new Map(entries().map((el) => [el.dataset.navKey, el]));
      order.forEach((key) => {
        if (byKey.has(key)) nav.appendChild(byKey.get(key));
      });
    }
  } catch (_) {}
  toggle.addEventListener("click", () => {
    const editing = sidebar.classList.toggle("madic-editing");
    toggle.setAttribute("aria-pressed", String(editing));
    toggle.textContent = editing ? "Terminer" : "Personnaliser le menu";
    reset.hidden = !editing;
    help.hidden = !editing;
  });
  reset.addEventListener("click", () => {
    entries()
      .sort(
        (a, b) =>
          [
            "nav-0",
            "nav-7",
            "nav-1",
            "nav-2",
            "nav-3",
            "nav-4",
            "nav-5",
            "nav-6",
          ].indexOf(a.dataset.navKey) -
          [
            "nav-0",
            "nav-7",
            "nav-1",
            "nav-2",
            "nav-3",
            "nav-4",
            "nav-5",
            "nav-6",
          ].indexOf(b.dataset.navKey),
      )
      .forEach((el) => nav.appendChild(el));
    save();
  });
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-move]");
    if (!button) return;
    const item = button.closest(".madic-nav-entry");
    if (button.dataset.move === "up" && item.previousElementSibling)
      nav.insertBefore(item, item.previousElementSibling);
    if (button.dataset.move === "down" && item.nextElementSibling)
      nav.insertBefore(item.nextElementSibling, item);
    save();
    button.focus();
  });
  let dragged = null;
  nav.addEventListener("dragstart", (event) => {
    const handle = event.target.closest(".madic-drag-handle");
    if (!sidebar.classList.contains("madic-editing") || !handle) {
      event.preventDefault();
      return;
    }
    dragged = handle.closest(".madic-nav-entry");
    dragged.classList.add("madic-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", dragged.dataset.navKey);
  });
  nav.addEventListener("dragover", (event) => {
    const target = event.target.closest(".madic-nav-entry");
    if (!dragged || !target || target === dragged) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    entries().forEach((el) => el.classList.remove("madic-drag-over"));
    target.classList.add("madic-drag-over");
  });
  nav.addEventListener("drop", (event) => {
    const target = event.target.closest(".madic-nav-entry");
    if (!dragged || !target || target === dragged) return;
    event.preventDefault();
    const rect = target.getBoundingClientRect();
    const after = window.matchMedia("(max-width: 800px)").matches
      ? event.clientX > rect.left + rect.width / 2
      : event.clientY > rect.top + rect.height / 2;
    nav.insertBefore(dragged, after ? target.nextSibling : target);
    save();
  });
  nav.addEventListener("dragend", () => {
    entries().forEach((el) =>
      el.classList.remove("madic-drag-over", "madic-dragging"),
    );
    dragged = null;
  });
})();

/* Mode invité des pages client. Les lectures passent par un accès Supabase révocable. */
(() => {
  "use strict";
  if (!document.currentScript?.hasAttribute("data-madic-guest-portal")) return;
  const params = new URLSearchParams(location.search);
  if (params.get("guest") !== "1" && !params.has("access")) return;

  const page = location.pathname.split("/").pop().replace(/\.html$/, "");
  const pages = new Set([
    "dashboard-client-cric", "actualites-client-cric", "profil-client-cric",
    "mes-dossiers-client-cric", "documents-client-cric", "factures-client-cric",
    "mes-rendez-vous-cric", "messagerie-client-cric", "mes-contrats", "formulaire",
  ]);
  const id = name => document.getElementById(name);
  const lang = () => document.documentElement.lang.startsWith("en") ? "en" : "fr";
  const tr = (fr, en) => lang() === "en" ? en : fr;
  const locale = () => lang() === "en" ? "en-CA" : "fr-CA";
  const i18n = new Map();
  function label(node, fr, en) {
    if (!node) return;
    i18n.set(node, [fr, en]);
    node.textContent = tr(fr, en);
  }
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  const accessUrl = new URL("invitation-client-cric.html?guest=1", location.href);
  let db, access, banner, notice, content, checking = false;
  const urls = new Set();
  function showError() {
    label(notice, "Impossible de charger cette information. Actualisez la page ou vérifiez que l’accès est encore actif.",
      "Unable to load this information. Refresh the page or check that the access is still active.");
  }
  function failAccess(fr, en) {
    // Supprimer les pièces et les données déjà rendues dès que la révocation est détectée.
    urls.forEach(url => URL.revokeObjectURL(url));
    urls.clear();
    access = null;
    if (content) {
      for (const child of [...content.children]) {
        if (child !== banner) child.remove();
      }
    }
    label(notice, fr, en);
  }
  function scoped(url, grant = access?.grant_id) {
    const link = new URL(url, location.href);
    link.searchParams.set("guest", "1");
    if (grant) link.searchParams.set("access", grant);
    return link;
  }
  function action(fr, en, run) {
    const button = element("button", null, "secondary");
    button.type = "button";
    label(button, fr, en);
    button.addEventListener("click", async () => {
      button.disabled = true;
      try { await run(); } catch { showError(); }
      finally { button.disabled = false; }
    });
    return button;
  }
  async function initialize() {
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
    }
    db = window.getMadicSupabase();
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      const preferred = params.get("access");
      if (preferred) accessUrl.searchParams.set("access", preferred);
      location.replace(accessUrl.href);
      return false;
    }
    const { data: grants, error } = await db.rpc("madic_guest_list");
    if (error) throw error;
    const wanted = params.get("access");
    access = wanted ? grants?.find(item => item.grant_id === wanted) : grants?.[0];
    if (!access) {
      failAccess("Cet accès invité est indisponible ou a été révoqué.",
        "This guest access is unavailable or has been revoked.");
      return false;
    }
    if (!wanted) history.replaceState(null, "", scoped(location.href));
    for (const anchor of document.querySelectorAll("a[href]")) {
      const url = new URL(anchor.href, location.href);
      if (url.origin === location.origin && pages.has(url.pathname.split("/").pop().replace(/\.html$/, ""))) {
        anchor.href = scoped(url).href;
      }
    }
    banner.querySelector("[data-guest-name]").textContent = access.client_name;
    if (grants.length > 1) {
      const select = element("select");
      const caption = element("label");
      select.append(...grants.map(item => new Option(item.client_name + " · " + item.cabinet, item.grant_id)));
      select.value = access.grant_id;
      select.addEventListener("change", () => location.assign(scoped(location.href, select.value)));
      const captionText = element("span");
      label(captionText, "Dossier partagé", "Shared file");
      caption.append(captionText, select);
      banner.append(caption);
    }
    return true;
  }

  // La promesse attend la construction du bandeau et l’exécution des modules d’interface existants.
  let resolveStart;
  const started = new Promise(resolve => { resolveStart = resolve; });
  async function read(section, offset = 0) {
    if (!await started || !access) throw Error("Guest access unavailable");
    const grant = access.grant_id;
    const { data, error } = await db.rpc("madic_guest_read",
      { p_grant: grant, p_section: section, p_offset: offset });
    if (error || access?.grant_id !== grant) throw error || Error("Guest access unavailable");
    return data;
  }
  window.MADIC_GUEST_PORTAL = { read, showError };
  document.addEventListener("submit", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  function clearText(name) {
    const node = id(name);
    if (node) {
      node.textContent = "";
      node.hidden = true;
    }
  }
  const statuses = {
    actif: ["Actif", "Active"], en_attente: ["En attente", "Pending"], ferme: ["Fermé", "Closed"],
    confirme: ["Confirmé", "Confirmed"], confirmed: ["Confirmé", "Confirmed"],
    pending: ["En attente", "Pending"], requested: ["Demandé", "Requested"],
    cancelled: ["Annulé", "Cancelled"], canceled: ["Annulé", "Cancelled"],
    completed: ["Terminé", "Completed"], refused: ["Refusé", "Declined"], declined: ["Refusé", "Declined"],
    accepte: ["Accepté", "Accepted"], refuse: ["Refusé", "Declined"], recu: ["Reçu", "Received"],
    publie: ["Publié", "Published"], signe: ["Signé", "Signed"], client_signe: ["Signé par le client", "Signed by client"],
    deux_signatures: ["Signé par les deux parties", "Signed by both parties"],
    received: ["Reçue", "Received"], reviewing: ["En analyse", "Under review"], responded: ["Réponse envoyée", "Responded"],
    closed: ["Fermée", "Closed"], requested_doc: ["Demandé", "Requested"], uploaded: ["Transmis", "Uploaded"],
    video: ["Vidéo", "Video"], phone: ["Téléphone", "Phone"], in_person: ["En personne", "In person"],
    consultation: ["Consultation", "Consultation"], proposition: ["Proposition", "Proposal"],
  };
  function status(value) {
    const span = element("span", value || "—");
    if (Object.hasOwn(statuses, value)) label(span, ...statuses[value]);
    return span;
  }
  function date(value) {
    if (!value) return "—";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(+parsed) ? "—" : parsed.toLocaleString(locale(), {timeZone: "America/Toronto"});
  }
  function money(value, currency) {
    const code = /^[A-Z]{3}$/.test(currency || "") ? currency : "CAD";
    return new Intl.NumberFormat(locale(), {style: "currency", currency: code}).format((Number(value) || 0) / 100);
  }
  function cell(row, value) {
    const td = row.insertCell();
    if (value instanceof Node) td.append(value);
    else td.textContent = value ?? "—";
  }
  async function table(tbody, section, columns) {
    let offset = 0;
    async function load(target) {
      const rows = await read(section, offset);
      target?.remove();
      if (!rows.length && !offset) {
        const td = tbody.insertRow().insertCell();
        td.colSpan = columns.length;
        label(td, "Aucun élément à afficher.", "Nothing to display.");
      }
      rows.slice(0, 25).forEach(record => {
        const line = tbody.insertRow();
        columns.forEach(property => cell(line, typeof property === "function" ? property(record) : record[property]));
      });
      if (rows.length > 25) {
        offset += 25;
        const more = tbody.insertRow();
        const td = more.insertCell();
        td.colSpan = columns.length;
        td.append(action("Afficher la suite", "Show more", () => load(more)));
      }
    }
    tbody.replaceChildren();
    await load();
  }
  async function fileBlob(row) {
    const grant = access?.grant_id;
    if (!grant) throw Error("Guest access unavailable");
    const { data, error } = await db.functions.invoke("madic-send-client-invitation", {
      body: { action: "guest_download", grant_id: grant, bucket: row.bucket, path: row.file },
    });
    if (error || !(data instanceof Blob) || access?.grant_id !== grant) throw error || Error("File unavailable");
    return data;
  }
  function download(row) {
    return row.file ? action("Télécharger", "Download", async () => {
      const url = URL.createObjectURL(await fileBlob(row));
      urls.add(url);
      const link = element("a");
      link.href = url;
      link.download = row.original_name || row.filename || "MADIC.pdf";
      link.click();
      setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 5000);
    }) : "—";
  }
  function show(idName) {
    const node = id(idName);
    if (node) node.hidden = false;
    return node;
  }
  function hide(idName) {
    const node = id(idName);
    if (node) node.hidden = true;
  }
  async function showAvatar(profile) {
    const images = [id("madicClientAvatarImage"), id("madicProfileAvatarImage")].filter(Boolean);
    if (!images.length || !profile.file) return;
    try {
      const url = URL.createObjectURL(await fileBlob(profile));
      urls.add(url);
      images.forEach(image => { image.src = url; });
    } catch {
      // L’avatar neutre du portail reste affiché.
    }
  }
  function fillProfile(profile) {
    show("profileContent");
    hide("toggleProfile");
    hide("profileHint");
    const form = id("profile");
    const mapped = {first: "first_name", last: "last_name"};
    for (const field of form.querySelectorAll("input, select, textarea")) {
      const value = profile[mapped[field.id] || field.name || field.id];
      if (field.type !== "file" && value != null) {
        if (field.tagName === "SELECT" && ![...field.options].some(opt => opt.value === String(value))) {
          field.add(new Option(String(value), String(value)));
        }
        field.value = value;
      }
      field.disabled = true;
      if (field.value) {
        field.closest("[hidden]")?.removeAttribute("hidden");
      }
    }
    form.querySelectorAll('button, .madic-profile-photo-actions').forEach(node => { node.hidden = true; });
  }
  function invoiceDetail(invoice) {
    const details = element("details");
    const summary = element("summary");
    label(summary, "Voir la facture", "View invoice");
    details.append(summary);
    if (invoice.description) details.append(element("p", invoice.description));
    if (Array.isArray(invoice.items)) {
      const list = element("ul");
      invoice.items.forEach(item => list.append(element("li", [item.description, item.quantity,
        money(item.unit_price_cents, invoice.currency)].filter(value => value != null).join(" · "))));
      details.append(list);
    }
    if (invoice.notes) details.append(element("p", invoice.notes));
    return details;
  }
  async function documents() {
    hide("upload");
    const upload = id("upload-heading");
    if (upload) {
      upload.hidden = true;
      if (upload.nextElementSibling?.tagName === "P") upload.nextElementSibling.hidden = true;
    }
    clearText("docreqClientNotice");
    await Promise.all([
      table(id("docreqClientRows"), "requests", ["title", "instructions", r => date(r.due_on), r => status(r.status)]),
      table(id("documents"), "documents", ["original_name", r => date(r.created_at),
        r => status(r.review_status || r.status), "review_reason", download]),
    ]);
  }
  async function appointments() {
    id("rdvSpace").append(new Option(access.cabinet));
    id("rdvSpace").disabled = true;
    id("slotRows").closest("section").hidden = true;
    clearText("rdvNotice");
    show("rdvApp");
    await table(id("bookingRows"), "appointments", [
      r => date(r.starts_at), r => status(r.mode), r => status(r.status),
      r => r.location_info || "—", () => "—",
    ]);
  }
  async function overview() {
    const [service, appointments, messages] = await Promise.all([
      read("service"), read("appointments"), read("messages"),
    ]);
    if (service) {
      show("madicJourneyPanel");
      id("madicJourneyStage").replaceChildren(status(service.status));
      id("madicJourneyStatus").replaceChildren(status(service.service_type),
        document.createTextNode(" · " + date(service.updated_at)));
    }
    show("madicImmigrationFormCard");
    show("madicClientMessagingCard");
    const summary = id("madicClientMessagesSummary");
    if (messages.length) summary.textContent = messages[0].subject + " · " + date(messages[0].created_at);
    else label(summary, "Aucun message.", "No messages.");
    const rdv = id("madic-appointments")?.querySelector("p");
    if (appointments.length) rdv?.replaceChildren(
      document.createTextNode(date(appointments[0].starts_at) + " · "), status(appointments[0].status));
    else label(rdv, "Aucun rendez-vous.", "No appointments.");
  }
  async function messages() {
    const list = id("clientMsgConversations"), historyNode = id("clientMsgMessages");
    id("clientMsgCabinet").append(new Option(access.cabinet));
    id("clientMsgCabinet").disabled = true;
    hide("clientMsgSendForm");
    clearText("clientMsgAutoRefreshState");
    clearText("clientMsgStatus");
    hide("madicConsultantPresence");
    show("clientMsgApp");
    let selected, version = 0;
    async function open(conversation, button) {
      selected = conversation.conversation_id;
      const activeVersion = ++version;
      list.querySelectorAll("button[aria-current]").forEach(node =>
        node.setAttribute("aria-current", String(node === button)));
      id("clientMsgTitle").textContent = conversation.subject;
      clearText("clientMsgSubject");
      historyNode.replaceChildren();
      let messageOffset = 0, attachmentOffset = 0;
      const timeline = element("div"), attachments = element("div");
      historyNode.append(timeline, attachments);
      async function pageMessages(more) {
        const records = await read("messages:" + selected, messageOffset);
        if (activeVersion !== version) return;
        more?.remove();
        const entries = records.slice(0, 25);
        const bubbles = entries.reverse().map(item => {
          const bubble = element("div", item.body,
            "madic-client-msg-bubble" + (item.sender === "client" ? " madic-client-msg-own" : ""));
          const time = element("time");
          time.dateTime = item.created_at;
          label(time, (item.sender === "client" ? "Client" : "Cabinet") + " · " + date(item.created_at),
            (item.sender === "client" ? "Client" : "Firm") + " · " + date(item.created_at));
          bubble.append(time);
          return bubble;
        });
        timeline.prepend(...bubbles);
        if (records.length > 25) {
          messageOffset += 25;
          const previous = action("Afficher les messages précédents", "Show earlier messages", () => pageMessages(previous));
          timeline.prepend(previous);
        } else if (!timeline.children.length) {
          const empty = element("p");
          label(empty, "Aucun message dans cette conversation.", "No messages in this conversation.");
          timeline.append(empty);
        }
      }
      async function pageAttachments(more) {
        const records = await read("attachments:" + selected, attachmentOffset);
        if (activeVersion !== version) return;
        more?.remove();
        for (const item of records.slice(0, 25)) {
          const row = element("p", item.filename + " ");
          row.append(download(item));
          attachments.append(row);
        }
        if (records.length > 25) {
          attachmentOffset += 25;
          const moreFiles = action("Afficher les autres pièces jointes", "Show more attachments", () => pageAttachments(moreFiles));
          attachments.append(moreFiles);
        }
      }
      await Promise.all([pageMessages(), pageAttachments()]);
    }
    let offset = 0, request = 0;
    async function loadList(reset = false) {
      const pending = ++request;
      if (reset) offset = 0;
      const records = await read("conversations", offset);
      if (pending !== request) return;
      if (reset) {
        list.replaceChildren();
        historyNode.replaceChildren();
        version++;
      } else list.querySelector("[data-guest-more]")?.remove();
      for (const item of records.slice(0, 25)) {
        const li = element("li");
        const button = action(item.subject, item.subject, () => open(item, button));
        button.setAttribute("aria-current", "false");
        li.append(button);
        list.append(li);
      }
      if (records.length > 25) {
        offset += 25;
        const more = element("li");
        more.dataset.guestMore = "";
        more.append(action("Afficher la suite", "Show more", () => loadList()));
        list.append(more);
      }
      if (!records.length && !list.children.length) {
        const empty = element("li");
        label(empty, "Aucune conversation.", "No conversations.");
        list.append(empty);
      }
      if (reset) {
        const first = list.querySelector("button[aria-current]");
        if (first) first.click();
      }
    }
    id("clientMsgRefresh").addEventListener("click", () => loadList(true).catch(showError));
    await loadList(true);
  }
  async function contracts() {
    const root = id("madic-contracts");
    clearText("contract-message");
    const list = element("table");
    const head = list.createTHead().insertRow();
    [["Contrat", "Contract"], ["Statut", "Status"], ["Date", "Date"], ["Consulter", "View"], ["Copie", "Copy"]]
      .forEach(names => { const th = element("th"); label(th, ...names); head.append(th); });
    const primary = list.createTBody(), legacy = list.createTBody();
    const preview = element("div");
    root.replaceChildren(list, preview);
    let revision = 0;
    function openContract(item, isLegacy) {
      return action("Voir le contrat", "View contract", async () => {
        const current = ++revision;
        const { data, error } = await db.rpc(isLegacy ? "madic_guest_legacy_contract" : "madic_guest_contract",
          { p_grant: access?.grant_id, p_contract: item.contract_id });
        if (!access || current !== revision) return;
        if (error || !data) throw error || Error("Contract unavailable");
        if (isLegacy) {
          preview.replaceChildren(element("pre", data));
          return;
        }
        const frame = element("iframe");
        frame.title = tr("Contrat en lecture seule", "Read-only contract");
        frame.setAttribute("sandbox", "");
        frame.referrerPolicy = "no-referrer";
        frame.width = "100%";
        frame.height = "650";
        const template = element("template");
        template.innerHTML = data;
        template.content.querySelectorAll("script,iframe,object,embed,form,button,input,textarea,select,link,meta,base,svg,math")
          .forEach(node => node.remove());
        template.content.querySelectorAll("a,area").forEach(node => node.removeAttribute("href"));
        frame.srcdoc = '<!doctype html><meta charset="utf-8">' +
          '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; form-action \'none\'; base-uri \'none\'">' +
          template.innerHTML;
        preview.replaceChildren(frame);
        frame.scrollIntoView({block: "nearest"});
      });
    }
    await Promise.all([
      table(primary, "contracts", ["reference", r => status(r.status), r => date(r.created_at), r => openContract(r, false), download]),
      table(legacy, "legacy_contracts", ["title", r => status(r.status), r => date(r.published_at), r => openContract(r, true), () => "—"]),
    ]);
  }

  async function verifyAccess() {
    if (!access || checking || document.hidden) return;
    checking = true;
    try {
      const { data, error } = await db.rpc("madic_guest_list");
      if (error) throw error;
      if (!data?.some(item => item.grant_id === access?.grant_id)) {
        failAccess("Cet accès invité est indisponible ou a été révoqué.",
          "This guest access is unavailable or has been revoked.");
      }
    } catch {
      failAccess("Impossible de vérifier cet accès. Actualisez la page.",
        "Unable to verify this access. Refresh the page.");
    } finally {
      checking = false;
    }
  }

  async function start() {
    content = document.querySelector(".madic-app-content");
    if (!content) {
      resolveStart(false);
      return;
    }
    banner = element("section", null, "panel");
    const title = element("strong"), client = element("p");
    label(title, "Lecture seule", "Read only");
    client.dataset.guestName = "";
    notice = element("p");
    notice.setAttribute("role", "status");
    const exit = element("a");
    exit.href = accessUrl.href;
    label(exit, "Mes accès invités", "My guest accesses");
    const signout = action("Déconnexion", "Sign out", async () => {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      location.replace(accessUrl.href);
    });
    banner.append(title, client, notice, exit, document.createTextNode(" "), signout);
    content.prepend(banner);
    // Les boutons natifs de déconnexion suivent également le parcours invité.
    for (const control of document.querySelectorAll('#logout,#madicHeaderSignout,[data-madic-signout="true"]')) {
      control.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        signout.click();
      }, true);
    }
    const observer = new MutationObserver(() => {
      for (const [node, names] of i18n) {
        if (!node.isConnected) i18n.delete(node);
        else node.textContent = tr(...names);
      }
    });
    observer.observe(document.documentElement, {attributeFilter: ["lang"]});
    try {
      const allowed = await initialize();
      resolveStart(allowed);
      if (!allowed) return;
      window.addEventListener("focus", verifyAccess);
      window.setInterval(verifyAccess, 60000);
      document.addEventListener("visibilitychange", verifyAccess);
      clearText("message");
      hide("madicJourneyLink");
      hide("madic-next-step");
      hide("madicClientMessagesUnread");
      const formCard = id("madicImmigrationFormCard");
      if (formCard) {
        label(formCard.querySelector("p"), "Consultez les réponses enregistrées au questionnaire.",
          "View the saved questionnaire responses.");
        label(formCard.querySelector("a"), "Consulter le formulaire →", "View the form →");
      }
      if (page === "formulaire") {
        label(document.querySelector(".form-hero__content h1"), "Formulaire d’immigration", "Immigration form");
        label(document.querySelector(".form-hero__content p"), "Consultez les réponses enregistrées par le client.",
          "View the answers saved by the client.");
      }
      const welcome = id("welcome");
      if (welcome) welcome.textContent = access.client_name;
      const routes = {
        "dashboard-client-cric": overview,
        "profil-client-cric": async () => {
          const profile = await read("profile");
          if (!profile) return;
          fillProfile(profile);
          await showAvatar(profile);
        },
        "mes-dossiers-client-cric": async () => {
          hide("toggleDossiers");
          show("dossiersContent");
          await table(id("dossiers"), "dossiers", ["reference", "category", row => status(row.status)]);
        },
        "documents-client-cric": documents,
        "factures-client-cric": async () => {
          show("clientInvoicesPanel");
          clearText("clientInvoicesNotice");
          await table(id("clientInvoicesRows"), "invoices", ["invoice_number", r => date(r.issued_on),
            r => date(r.due_on), r => money(r.total_cents, r.currency), r => money(r.balance_cents, r.currency), invoiceDetail]);
        },
        "mes-rendez-vous-cric": appointments,
        "messagerie-client-cric": messages,
        "mes-contrats": contracts,
      };
      await routes[page]?.();
      if (page === "dashboard-client-cric") {
        const profile = await read("profile");
        if (profile) await showAvatar(profile);
      }
    } catch {
      resolveStart(false);
      if (access) showError();
      else failAccess("Impossible de vérifier l’accès invité. Actualisez la page.",
        "Unable to verify guest access. Refresh the page.");
    }
  }
  document.addEventListener("DOMContentLoaded", start, {once: true});
})();
