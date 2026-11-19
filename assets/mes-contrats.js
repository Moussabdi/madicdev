/* Mode invité des pages client. Les lectures passent par un accès Supabase révocable. */
(() => {
  "use strict";
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
    let renderedLanguage = lang();
    const observer = new MutationObserver(() => {
      const nextLanguage = lang();
      if (nextLanguage === renderedLanguage) return;
      renderedLanguage = nextLanguage;
      for (const [node, names] of i18n) {
        if (!node.isConnected) {
          i18n.delete(node);
          continue;
        }
        const translated = tr(...names);
        if (node.textContent !== translated) node.textContent = translated;
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {once: true});
  } else {
    void start();
  }
})();

;
/* MADIC - Mes contrats : scripts de la page consolides. */
(async function () {
  "use strict";
  if (!window.supabase && !window.MADIC_GUEST_PORTAL) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Impossible de charger la bibliotheque Supabase."));
      document.head.appendChild(s);
    });
  }
/* Module 1 */
/* MADIC - module de contrats. Prototype : ne constitue pas une signature electronique qualifiee. */
(() => {
  "use strict";
  if (window.MADIC_GUEST_PORTAL) return;
  const config = window.MADIC_CONFIG;
  const root = document.getElementById("madic-contracts");
  if (!root) return;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const client = window.getMadicSupabase();
  const note = (s, bad = false) => {
    document.getElementById("contract-message").textContent = s;
    document.getElementById("contract-message").style.color = bad
      ? "#b42318"
      : "inherit";
  };
  const fmt = (x) => new Date(x).toLocaleString("fr-CA");
  const name = (c) =>
    [c.client_snapshot?.first_name, c.client_snapshot?.last_name]
      .filter(Boolean)
      .join(" ");
  const renderText = (c) => {
    const variables = {
      client_name: name(c),
      rate: Number(c.rate).toFixed(2),
      spouse_extra: Number(c.spouse_extra).toFixed(2),
      currency: c.currency,
      business_address: c.business_address,
      consultant_name: c.consultant_name,
      consultant_licence: c.consultant_licence,
    };
    return esc(c.body_snapshot)
      .replace(/\{\{([a-z_]+)\}\}/g, (_, key) => esc(variables[key] ?? ""))
      .replace(/\\n/g, "<br>")
      .replace(/\n/g, "<br>");
  };
  const FORFAIT_REFERENCE_CLAUSES =
    "CONTRAT DE CONSULTATION INITIALE - TAUX FORFAITAIRE\n\nJe soussigné(e), {{client_name}}, demande une consultation de la part de MAD Immigration Canadienne (MADIC) inc., située au Bureau 202, 1622 Rue Barré, Saint-Laurent, Québec, H4L 4M8, Canada.\n\n1. OBJET DE LA CONSULTATION\nL'objet du contrat de consultation initiale est d'obtenir un avis professionnel du consultant sur mes projets ou objectifs d'immigration au Canada.\n\n2. HONORAIRES PROFESSIONNELS\nDes honoraires forfaitaires de {{rate}} {{currency}} sont exigibles pour une personne. Un montant additionnel de {{spouse_extra}} {{currency}} s'applique pour l'inclusion de l'époux ou de l'épouse. Ces honoraires couvrent la consultation ainsi que les travaux professionnels visés par le présent mandat, effectués par le consultant ou ses associés autorisés.\n\n3. DÉCLARATION RELATIVE À UN AUTRE REPRÉSENTANT\nJe confirme ne pas avoir conclu de contrat avec un autre individu autorisé à me représenter en vertu de la législation applicable en matière d'immigration et de protection des réfugiés. Le cas échéant, je m'engage à en informer MADIC avant le début du mandat.\n\n4. CONDITIONS ET MODALITÉS DE PAIEMENT\nLes conditions du présent contrat sont soumises aux lois applicables au Québec et au Canada. Les paiements peuvent être effectués par virement Interac, traite bancaire, chèque personnel, dépôt direct ou virement bancaire international selon les instructions transmises par MADIC.\nPaiement Interac : madimmigrationcanadienne@gmail.com\nLes coordonnées bancaires complètes seront communiquées par un moyen approprié et ne sont pas intégrées dans ce modèle public.\n\n5. STATUT ET OBLIGATIONS PROFESSIONNELLES DU CONSULTANT\nLe mandat est exécuté par {{consultant_name}}, titulaire du permis {{consultant_licence}}, consultant réglementé en immigration canadienne. À ce titre, il est tenu de respecter les exigences professionnelles, le code de déontologie et les règles applicables du Collège des consultants en immigration et en citoyenneté (CCIC). Le Collège réglemente la profession dans l'intérêt public et veille notamment à la protection du public, aux normes de pratique et au respect du code de déontologie.\n\n6. NOTE IMPORTANTE - DÉBUT DU MANDAT\nLa consultation ou le projet débute officiellement à compter de la réception du dépôt requis. Le tarif forfaitaire de référence du document fourni est de 599 $ US pour une personne, auquel s'ajoutent 150 $ US pour un conjoint, soit 749 $ US pour un couple. Les montants contractuels applicables sont ceux indiqués à la section 2 et doivent être vérifiés par l'administrateur avant publication.\n\n7. ACCEPTATION ET SIGNATURES\nJe comprends et accepte les conditions du présent contrat. Toute modification des conditions contractuelles doit faire l'objet d'un accord approprié entre les parties.\n\nRENSEIGNEMENTS SUR LE CLIENT\nNom et prénom : {{client_name}}\nDate de naissance : à compléter dans le dossier du client\nAdresse de résidence : à compléter dans le dossier du client\nCourriel et téléphone : selon le profil du client\n\nCONSULTANT\nNom : {{consultant_name}}\nPermis : {{consultant_licence}}\nPermis au registre du Québec (document de référence) : 12152\nAdresse professionnelle : {{business_address}}\n\nSIGNATURES\nSignature du client : par la procédure de signature électronique du portail MADIC\nDate et ville du client : à compléter ou à consigner lors de la signature\nSignature du consultant : à compléter selon la procédure professionnelle applicable\nDate et ville du consultant : à compléter\n\nCOORDONNÉES MADIC\nTéléphone : 514-442-3076\nCourriel : madimmigrationcanadienne@gmail.com\nSite Web : https://madimmigrationcanadienne.netlify.app/";
  let contracts = [],
    dossiers = [],
    templates = [],
    profiles = [],
    initialContracts = [];
  const admin = root.dataset.mode === "admin";
  const button = (text, action, id) =>
    `<button type="button" class="secondary" data-action="${esc(action)}" data-id="${esc(id)}">${esc(text)}</button>`;
  async function call(fn, args) {
    const { data, error } = await client.rpc(fn, args);
    if (error) throw error;
    return data;
  }
  async function load() {
    const {
      data: { user },
      error: authErr,
    } = await client.auth.getUser();
    if (authErr || !user) {
      location.href = "connexion.html";
      return;
    }
    if (admin) {
      const { data: p, error: pe } = await client
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (pe || p?.role !== "admin") {
        location.href = "dashboard.html";
        return;
      }
      const results = await Promise.all([
        client.from("madic_contract_templates").select("*").order("kind"),
        client
          .from("dossiers")
          .select("id,client_id,reference,status")
          .eq("status", "actif"),
        client
          .from("profiles")
          .select("id,first_name,last_name,email")
          .eq("role", "client"),
        client
          .from("madic_contracts")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      for (const r of results) if (r.error) throw r.error;
      [templates, dossiers, profiles, contracts] = results.map((r) => r.data);
      renderAdmin();
    } else {
      const { data, error } = await client
        .from("madic_contracts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      contracts = data;
      // Le contrat initial est la version figee de #contractDocument publiee par le CRIC.
      const { data: initialData, error: initialError } = await client
        .from("madic_initial_contracts")
        .select("*")
        .eq("client_id", user.id)
        .in("status", ["publie", "signe"])
        .order("created_at", { ascending: false });
      if (initialError) throw initialError;
       initialContracts = initialData || [];
       const dossierIds=[...new Set([...initialContracts,...contracts].map(c=>c.dossier_id).filter(Boolean))];
       dossiers=[];
       if(dossierIds.length){const {data:ds,error:de}=await client.from('dossiers').select('id,reference,category').in('id',dossierIds);if(de)console.warn('Références de dossiers indisponibles',de);else dossiers=ds||[];}
       renderClient();
    }
  }
  const LOGO_BUCKET = "madic-contract-logos";
  const logoPath = (side) =>
    side === "left" ? "branding/logo-gauche" : "branding/logo-droit";
  const logoUrl = (side) =>
    client.storage.from(LOGO_BUCKET).getPublicUrl(logoPath(side)).data
      .publicUrl;
  document.addEventListener("error", (event) => { if (event.target.matches?.("img[data-logo]")) event.target.hidden = true; }, true);
  function logoHeader() {
    return `<div class="madic-contract-logo-header"><img data-logo="left" src="${esc(logoUrl("left") + "?v=" + Date.now())}" alt="Logo gauche"><img data-logo="right" src="${esc(logoUrl("right") + "?v=" + Date.now())}" alt="Logo droit"></div>`;
  }
  async function setupLogoAdmin() {
    const status = root.querySelector("#madic-logo-status");
    const refresh = () => {
      for (const side of ["left", "right"]) {
        const img = root.querySelector(`[data-logo-preview="${side}"]`);
        if (!img) continue;
        img.hidden = false;
        img.onerror = () => {
          img.hidden = true;
        };
        img.src = logoUrl(side) + "?v=" + Date.now();
      }
    };
    refresh();
    for (const side of ["left", "right"]) {
      root
        .querySelector(`[data-logo-upload="${side}"]`)
        .addEventListener("click", async () => {
          const file = root.querySelector(`[data-logo-file="${side}"]`)
            .files[0];
          if (!file) {
            status.textContent = "Choisissez une image.";
            return;
          }
          if (
            !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
            file.size > 2 * 1024 * 1024
          ) {
            status.textContent = "Format PNG, JPG ou WebP, maximum 2 Mo.";
            return;
          }
          const ext =
            file.type === "image/png"
              ? "png"
              : file.type === "image/webp"
                ? "webp"
                : "jpg";
          // Stable object path with a content type set explicitly for public display.
          const { error } = await client.storage
            .from(LOGO_BUCKET)
            .upload(logoPath(side), file, {
              upsert: true,
              contentType: file.type,
              cacheControl: "60",
            });
          status.textContent = error
            ? "Erreur : " + error.message
            : "Logo " + (side === "left" ? "gauche" : "droit") + " enregistré.";
          if (!error) refresh();
        });
      root
        .querySelector(`[data-logo-remove="${side}"]`)
        .addEventListener("click", async () => {
          if (!confirm("Supprimer ce logo des contrats ?")) return;
          const { error } = await client.storage
            .from(LOGO_BUCKET)
            .remove([logoPath(side)]);
          status.textContent = error
            ? "Erreur : " + error.message
            : "Logo supprimé.";
          if (!error) refresh();
        });
    }
  }
  function renderAdmin() {
    root.innerHTML = `<section class="madic-logo-admin"><h2>Logos des contrats</h2><p>Importation réservée à l’administrateur. Les logos s’affichent à gauche et à droite de l’en-tête du contrat.</p>
  <div class="madic-logo-grid">${["left", "right"].map((side) => `<div class="madic-logo-slot"><h3>Logo ${side === "left" ? "gauche" : "droit"}</h3><img class="madic-logo-preview" data-logo-preview="${side}" alt="Aperçu du logo ${side === "left" ? "gauche" : "droit"}" hidden><input type="file" data-logo-file="${side}" accept="image/png,image/jpeg,image/webp"><button type="button" data-logo-upload="${side}">Téléverser</button><button type="button" class="secondary" data-logo-remove="${side}">Supprimer</button></div>`).join("")}</div><p class="madic-logo-status" id="madic-logo-status"></p></section><hr><h2>Modèles modifiables</h2><p>Les modifications s'appliquent aux futurs contrats. Un contrat déjà créé conserve sa version.</p>
   <label>Modèle <select id="template-kind">${templates.map((t) => `<option value="${esc(t.kind)}">${esc(t.title)}</option>`).join("")}</select></label>
   <form id="template-form"><label>Titre <input name="title" required></label><label>Tarif <input name="rate" type="number" step="0.01" min="0" required></label>
   <label>Supplément conjoint <input name="spouse_extra" type="number" step="0.01" min="0" required></label>
   <label>Devise <select name="currency"><option value="USD">USD</option><option value="CAD">CAD</option></select></label>
   <label>Adresse <textarea name="address" required rows="2"></textarea></label>
   <label>Clauses du contrat <textarea name="body" rows="15" required></textarea></label>
   <p>Variables : {{client_name}}, {{rate}}, {{spouse_extra}}, {{currency}}, {{business_address}}, {{consultant_name}}, {{consultant_licence}}</p>
       <button type="button" id="load-reference-clauses" class="secondary">Insérer le contenu complet dans le modèle forfaitaire</button>
    <button type="submit">Enregistrer le modèle</button></form><hr>
   <h2>Préparer un contrat</h2><form id="new-contract"><label>Dossier actif <select name="dossier" required>${dossiers
     .map((d) => {
       const p = profiles.find((p) => p.id === d.client_id);
       return `<option value="${esc(d.id)}">${esc(d.reference)} - ${esc([p?.first_name, p?.last_name].filter(Boolean).join(" "))}</option>`;
     })
     .join(
       "",
     )}</select></label><label>Type <select name="kind"><option value="horaire">Horaire</option><option value="forfait">Forfaitaire</option></select></label>
   <button type="submit" ${dossiers.length ? "" : "disabled"}>Créer un brouillon</button></form><hr>
   <h2>Suivi des contrats</h2><div class="madic-contract-table-scroll"><table><thead><tr><th>Client</th><th>Type</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody>
   ${
     contracts
       .map(
         (
           c,
         ) => `<tr><td>${esc(name(c))}</td><td>${esc(c.template_kind)}</td><td>${esc(c.status)}</td><td>${esc(fmt(c.created_at))}</td>
   <td>${button("Consulter", "view", c.id)} ${c.status === "brouillon" ? button("Modifier", "edit", c.id) + " " + button("Publier", "publish", c.id) : ""}</td></tr>`,
       )
       .join("") || '<tr><td colspan="5">Aucun contrat</td></tr>'
   }
   </tbody></table></div><div id="contract-preview"></div>`;
    setupLogoAdmin();
    const select = root.querySelector("#template-kind");
    const form = root.querySelector("#template-form");
    const fill = () => {
      const t = templates.find((x) => x.kind === select.value);
      if (!t) return;
      for (const k of ["title", "rate", "spouse_extra", "currency", "body"])
        form.elements.namedItem(k).value = t[k];
      form.elements.namedItem("address").value = t.business_address;
    };
    select.addEventListener("change", fill);
    fill();
    root
      .querySelector("#load-reference-clauses")
      .addEventListener("click", () => {
        if (select.value !== "forfait") {
          note(
            "Sélectionnez le modèle « taux forfaitaire » avant de charger les clauses.",
            true,
          );
          return;
        }
        if (
          !confirm(
            "Remplacer le texte actuellement affiché dans le champ « Clauses du contrat » par le contenu du document de référence ? Les changements ne seront enregistrés que lorsque vous cliquerez sur « Enregistrer le modèle ».",
          )
        )
          return;
        form.elements.namedItem("body").value = FORFAIT_REFERENCE_CLAUSES;
        note(
          "Clauses du document de référence chargées. Vérifiez et adaptez le texte, les montants, la devise et les renseignements avant de cliquer sur « Enregistrer le modèle ».",
        );
      });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const f = e.currentTarget;
        await call("madic_save_contract_template", {
          p_kind: select.value,
          p_title: f.elements.namedItem("title").value,
          p_body: f.elements.namedItem("body").value,
          p_rate: Number(f.elements.namedItem("rate").value),
          p_spouse_extra: Number(f.elements.namedItem("spouse_extra").value),
          p_currency: f.elements.namedItem("currency").value,
          p_address: f.elements.namedItem("address").value,
        });
        note("Modèle enregistré.");
        await load();
      } catch (err) {
        note(err.message, true);
      }
    });
    root
      .querySelector("#new-contract")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          const f = e.currentTarget;
          await call("madic_create_contract", {
            p_dossier_id: f.elements.namedItem("dossier").value,
            p_kind: f.elements.namedItem("kind").value,
          });
          note("Brouillon créé. Vérifiez son contenu avant publication.");
          await load();
        } catch (err) {
          note(err.message, true);
        }
      });
  }
     document.addEventListener('madic-contracts-language-changed', () => { if (!admin) renderClient(); });
     function renderClient() {
     const en=(()=>{try{return localStorage.getItem('madic-client-language')==='en';}catch(_){return document.documentElement.lang.toLowerCase().startsWith('en');}})();
     const tr=(fr,english)=>en?english:fr;
     const dossierLabel=c=>{const d=dossiers.find(x=>x.id===c.dossier_id);return d?[d.reference,d.category].filter(Boolean).join(' - '):c.dossier_id?tr('Dossier associé (référence indisponible)','Associated case (reference unavailable)'):tr('Non renseigné','Not specified');};
     const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
     const timestamp=x=>{if(!x)return '-';const d=new Date(x);if(Number.isNaN(d.getTime()))return '-';return new Intl.DateTimeFormat(en?'en-CA':'fr-CA',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:zone,timeZoneName:'short'}).format(d);};
     const newest=new Set();
     const initialRows=initialContracts.map(c=>{
       const key=(c.space_id||'')+':'+(c.dossier_id||c.id);
       const isLatest=!newest.has(key);newest.add(key);
       const signed=c.status==='signe';const canSign=isLatest&&!signed;
       const label=isLatest?tr('Version la plus récente','Latest version'):tr('Version antérieure','Previous version');
       return `<tr><td>${tr('Consultation initiale','Initial consultation')} - ${esc(label)}</td><td>${esc(dossierLabel(c))}</td><td>${esc(timestamp(c.created_at))}</td><td>${esc(timestamp(c.client_signed_at||c.signed_at))}</td><td>${signed?tr('Signé','Signed'):canSign?tr('Signature requise','Signature required'):tr('Version remplacée','Superseded version')}</td><td><a class="secondary madic-initial-open" href="contrat-initial-client.html?id=${encodeURIComponent(c.id)}">${canSign?tr('Consulter / signer','Review / sign'):tr('Voir le contrat','View contract')}</a></td></tr>`;
     });
     const legacyRows=contracts.map(c=>`<tr><td>${esc(c.title||tr('Contrat de consultation','Consultation contract'))}</td><td>${esc(dossierLabel(c))}</td><td>${esc(timestamp(c.published_at||c.created_at))}</td><td>${esc(timestamp(c.signed_at))}</td><td>${esc(c.status==='signe'?tr('Signé','Signed'):c.status==='publie'?tr('Signature requise','Signature required'):c.status==='brouillon'?tr('Brouillon','Draft'):tr('Ancien contrat','Previous contract'))}</td><td>${button(c.status==='publie'?tr('Signer le contrat','Sign contract'):tr('Voir le contrat','View contract'),'view',c.id)}</td></tr>`);
     root.innerHTML=`<h2>${tr('Mes contrats','My contracts')}</h2><p>${tr('Dates et heures selon votre fuseau horaire','Dates and times in your time zone')} (${esc(zone)}). ${tr('Toutes les versions des contrats initiaux sont conservées, de la plus récente à la plus ancienne.','All versions of initial contracts are retained, from newest to oldest.')}</p><table><thead><tr><th>${tr('Contrat','Contract')}</th><th>${tr('Dossier','Case')}</th><th>${tr('Transmission','Sent')}</th><th>${tr('Signature du client','Client signature')}</th><th>${tr('État','Status')}</th><th>${tr('Action','Action')}</th></tr></thead><tbody>${initialRows.concat(legacyRows).join('')||`<tr><td colspan="6">${tr('Aucun contrat disponible.','No contracts available.')}</td></tr>`}</tbody></table><div id="contract-preview"></div>`;
   }
function editContract(c) {
    const preview = root.querySelector("#contract-preview");
    preview.innerHTML = `<hr><h3>Modifier le brouillon - ${esc(name(c))}</h3>
   <form id="draft-edit"><label>Titre <input name="title" required></label>
   <label>Tarif <input name="rate" type="number" step="0.01" min="0" required></label>
   <label>Supplément conjoint <input name="spouse_extra" type="number" step="0.01" min="0" required></label>
   <label>Devise <select name="currency"><option>USD</option><option>CAD</option></select></label>
   <label>Adresse professionnelle <textarea name="address" rows="2" required></textarea></label>
   <label>Clauses <textarea name="body" rows="14" required></textarea></label>
   <label>Renseignements du client (JSON) <textarea name="snapshot" rows="7" required></textarea></label>
   <button type="submit">Enregistrer le brouillon</button></form>`;
    const f = preview.querySelector("#draft-edit");
    for (const [k, v] of Object.entries({
      title: c.title,
      rate: c.rate,
      spouse_extra: c.spouse_extra,
      currency: c.currency,
      body: c.body_snapshot,
      address: c.business_address,
      snapshot: JSON.stringify(c.client_snapshot, null, 2),
    }))
      f.elements.namedItem(k).value = v;
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const g = (k) => f.elements.namedItem(k).value;
        await call("madic_update_contract_draft", {
          p_contract_id: c.id,
          p_title: g("title"),
          p_body: g("body"),
          p_rate: Number(g("rate")),
          p_spouse_extra: Number(g("spouse_extra")),
          p_currency: g("currency"),
          p_address: g("address"),
          p_client_snapshot: JSON.parse(g("snapshot")),
        });
        note("Brouillon modifié.");
        await load();
      } catch (err) {
        note(err.message, true);
      }
    });
  }
  function show(c) {
    const signed = c.status === "signe";
    const preview = root.querySelector("#contract-preview");
    preview.innerHTML = `<hr><section id="contract-print">${logoHeader()}<h2>${esc(c.title)}</h2>
   <p><strong>Client :</strong> ${esc(name(c))}<br><strong>Courriel :</strong> ${esc(c.client_snapshot?.email)}<br>
   <strong>Consultant :</strong> ${esc(c.consultant_name)} - ${esc(c.consultant_licence)}</p>
   <div class="madic-contract-text">${renderText(c)}</div>
   <p><strong>Version :</strong> ${esc(c.version)} · <strong>Statut :</strong> ${esc(c.status)}</p>
   ${
     signed
       ? `<p><strong>Signé par :</strong> ${esc(c.signed_name)}<br><strong>Date (UTC) :</strong> ${esc(c.signed_at)}<br>
   <strong>Empreinte SHA-256 :</strong> <code class="madic-contract-digest">${esc(c.signed_digest)}</code></p>`
       : ""
   }</section>
   <button type="button" class="secondary" id="contract-print-button">Imprimer / enregistrer en PDF</button>
   ${
     !admin && c.status === "publie"
       ? `<form id="sign-contract"><label>Votre prénom et nom exacts
   <input name="signed_name" required autocomplete="name" placeholder="${esc(name(c))}"></label>
   <label><input type="checkbox" name="accept" required> J'ai lu l'intégralité du contrat, j'en accepte les conditions et je consens expressément à le signer électroniquement.</label>
   <button type="submit">Signer électroniquement</button></form>`
       : ""
   }`;
    preview
      .querySelector("#contract-print-button")
      .addEventListener("click", () => {
        const w = window.open("", "_blank");
        if (!w) {
          note("Autorisez les fenêtres contextuelles pour imprimer.", true);
          return;
        }
        w.opener = null;
        w.document.write(
          `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Contrat MADIC</title><link rel="stylesheet" href="assets/mes-contrats.css"><body class="madic-contract-print-page">${preview.querySelector("#contract-print").innerHTML}</body></html>`,
        );
        w.document.close();
        w.focus();
        w.print();
      });
    const sign = preview.querySelector("#sign-contract");
    if (sign)
      sign.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (
          !confirm(
            "Confirmez-vous vouloir signer electroniquement ce contrat ? Cette action est definitive.",
          )
        )
          return;
        const f = e.currentTarget;
        try {
          await call("madic_sign_contract", {
            p_contract_id: c.id,
            p_full_name: f.elements.namedItem("signed_name").value,
            p_accept: f.elements.namedItem("accept").checked,
          });
          note("Contrat signé. Une trace de consentement a été enregistrée.");
          await load();
        } catch (err) {
          note(err.message, true);
        }
      });
  }
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-action]");
    if (!b) return;
    const c = contracts.find((x) => x.id === b.dataset.id);
    if (!c) return;
    if (b.dataset.action === "view") {
      show(c);
      return;
    }
    if (b.dataset.action === "edit") {
      editContract(c);
      return;
    }
    if (b.dataset.action === "publish") {
      if (
        !confirm(
          "Avez-vous vérifié toutes les clauses, les tarifs, les coordonnées et les renseignements du client ? Publier ce contrat ?",
        )
      )
        return;
      try {
        await call("madic_publish_contract", { p_contract_id: c.id });
        note("Contrat publié dans l’espace du client.");
        await load();
      } catch (err) {
        note(err.message, true);
      }
    }
  });
  load().catch((e) => note(e.message, true));
})();


/* Module 2 */
/* Préférences locales de navigation : aucun changement des données Supabase. */
(function () {
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


/* Module 3 */
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
    const pageLanguage = language === 'en' ? 'en-CA' : 'fr-CA';
    if (document.documentElement.lang !== pageLanguage) document.documentElement.lang = pageLanguage;
    document.querySelectorAll('[data-fr][data-en]').forEach(el => {
      const value = el.getAttribute('data-' + language);
      if (el.textContent !== value) el.textContent = value;
    });
    document.querySelectorAll('[data-fr-aria-label][data-en-aria-label], [data-fr-title][data-en-title]').forEach(el => { for (const attr of ['aria-label','title']) { const v=el.getAttribute('data-'+language+'-'+attr); if(v!==null) el.setAttribute(attr,v); } });
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
    document.dispatchEvent(new CustomEvent('madic-contracts-language-changed'));
  }));
  translate();
})();


/* Module 4 */

      /* Navigation and logout only; no observers, no changes to page applications. */
      (function () {
        "use strict";
        var nav = document.querySelector(".madic-side-links");
        var desired = [
          "nav-0",
          "nav-news",
          "nav-7",
          "nav-1",
          "nav-contracts",
          "nav-3",
          "nav-4",
          "nav-5",
          "nav-2",
          "nav-6",
        ];
        if (nav) {
          var nodes = Array.from(
            nav.querySelectorAll(":scope > .madic-nav-entry"),
          );
          var map = new Map(
            nodes.map(function (node) {
              return [node.getAttribute("data-nav-key"), node];
            }),
          );
          desired.forEach(function (key) {
            if (map.has(key)) nav.appendChild(map.get(key));
          });
          try {
            localStorage.setItem(
              "madic-client-nav-order-v2",
              JSON.stringify(desired),
            );
          } catch (_) {}
        }
        var signout = document.getElementById("madicHeaderSignout");
        if (signout)
          signout.addEventListener("click", async function (event) {
            event.preventDefault();
            if (typeof window.getMadicSupabase !== "function") return;
            try {
              await window.getMadicSupabase().auth.signOut();
              window.location.replace("connexion-client-cric.html");
            } catch (error) {
              console.error("MADIC sign out:", error);
            }
          });
      })();
    
})().catch(console.error);
