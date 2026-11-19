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
/* MADIC messagerie client : scripts regroupes, ordre original conserve. */
(async function(){
  if (!window.supabase && !window.MADIC_GUEST_PORTAL) { await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';s.onload=resolve;s.onerror=()=>reject(new Error("Supabase CDN unavailable"));document.head.appendChild(s);}); }

/* --- madic-presence.js --- */
/* MADIC Presence v2 : canal partagé par cabinet, diagnostic explicite. */
(() => {
  "use strict";
  let clientChannel = null;
  let clientVersion = 0;
  const badge = () => document.getElementById("madicConsultantPresence");
  function display(state, detail = "") {
    const el = badge();
    if (!el) return;
    el.classList.remove(
      "madic-presence--online",
      "madic-presence--offline",
      "madic-presence--unknown",
    );
    el.classList.add("madic-presence--" + state);
    const text = el.querySelector(".madic-presence-label");
    if (text)
      text.textContent = {
        online: "Consultant en ligne",
        offline: "Consultant hors ligne",
        unknown: "Présence du consultant indisponible",
      }[state];
    el.title = detail;
  }
  function channel(db, spaceId, key) {
    if (!db || !/^[a-f0-9-]{36}$/i.test(String(spaceId || ""))) return null;
    return db.channel("madic-cric-presence:" + spaceId, {
      config: { presence: { key } },
    });
  }
  function watchClient(db, spaceId) {
    clientVersion++;
    const version = clientVersion;
    if (clientChannel) {
      void db.removeChannel(clientChannel);
      clientChannel = null;
    }
    display("unknown", "Connexion au service de présence...");
    const ch = channel(
      db,
      spaceId,
      "client-" + Math.random().toString(36).slice(2),
    );
    if (!ch) {
      console.warn(
        "[MADIC Presence] Identifiant de cabinet invalide côté client.",
      );
      return;
    }
    clientChannel = ch;
    let subscribed = false,
      synced = false;
    function sync() {
      if (version !== clientVersion) return;
      synced = true;
      const peers = Object.values(ch.presenceState()).flat();
      display(
        peers.some((p) => p?.role === "consultant") ? "online" : "offline",
      );
    }
    ch.on("presence", { event: "sync" }, sync).subscribe((state, err) => {
      if (version !== clientVersion) return;
      console.info("[MADIC Presence] Client canal:", state, err || "");
      if (state === "SUBSCRIBED") {
        subscribed = true; /* attendre la synchronisation initiale */
      }
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(state))
        display("unknown", err?.message || state);
    });
    window.setTimeout(() => {
      if (version === clientVersion && (!subscribed || !synced))
        display("unknown", "Synchronisation Realtime non confirmée");
    }, 10000);
  }
  function publishConsultant(db, spaceId, userId) {
    if (!userId) return;
    const ch = channel(
      db,
      spaceId,
      "consultant-" + userId + "-" + Math.random().toString(36).slice(2),
    );
    if (!ch) {
      console.warn(
        "[MADIC Presence] Identifiant de cabinet invalide côté CRIC.",
      );
      return;
    }
    ch.subscribe(async (state, err) => {
      console.info("[MADIC Presence] CRIC canal:", state, err || "");
      if (state === "SUBSCRIBED") {
        try {
          const result = await ch.track({
            role: "consultant",
            user_id: userId,
            since: new Date().toISOString(),
          });
          if (result !== "ok")
            console.error(
              "[MADIC Presence] Échec de publication track():",
              result,
            );
          else console.info("[MADIC Presence] CRIC présence publiée.");
        } catch (e) {
          console.error("[MADIC Presence] Erreur track():", e);
        }
      }
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(state))
        console.error("[MADIC Presence] Canal CRIC indisponible:", state, err);
    });
    window.addEventListener(
      "pagehide",
      () => {
        void db.removeChannel(ch);
      },
      { once: true },
    );
  }
  window.MADICPresence = { watchClient, publishConsultant };
})();


/* --- messagerie-client-cric.js --- */
/* MADIC 7.3 : messagerie du client, accès filtré par les RLS Supabase. */
(async () => {
  "use strict";
  if (window.MADIC_GUEST_PORTAL) return;
  const $ = (id) => document.getElementById(id);
  const status = (value) => {
    $("clientMsgStatus").textContent = value;
  };
  if (
    !window.MADIC_CONFIG?.url ||
    !window.MADIC_CONFIG?.anonKey ||
    typeof window.getMadicSupabase !== "function"
  )
    return status("Configuration Supabase manquante.");
  const db = window.getMadicSupabase();
  let uid,
    spaces = [],
    conversations = [],
    selectedId = null;
  const date = (value) =>
    new Intl.DateTimeFormat(document.documentElement.lang === "en-CA" ? "en-CA" : "fr-CA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Toronto",
    }).format(new Date(value));
  const showError = (error) =>
    status("Erreur : " + (error?.message || String(error)));
  const cabinetId = () => $("clientMsgCabinet").value;
  async function loadConversations() {
    const space = cabinetId();
    if (!spaces.some((s) => s.space_id === space))
      throw Error("Cabinet non autorisé.");
    const { data, error } = await db
      .from("madic_cric_conversations")
      .select("id,space_id,client_id,subject,created_at")
      .eq("space_id", space)
      .eq("client_id", uid)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error)
      throw Error("Lecture des conversations refusée : " + error.message);
    conversations = data || [];
    status("Messagerie du client chargée.");
    const list = $("clientMsgConversations");
    list.replaceChildren();
    let unreadTotal = 0;
    const ids = conversations.map((c) => c.id);
    const counts = new Map();
    const latestMessages = new Map();
    if (ids.length) {
      const [messagesResult, readsResult] = await Promise.all([
        db
          .from("madic_cric_messages")
          .select("conversation_id,sender_id,body,created_at")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false })
          .limit(1000),
        db
          .from("madic_cric_message_reads")
          .select("conversation_id,last_read_at")
          .eq("user_id", uid)
          .in("conversation_id", ids),
      ]);
      if (messagesResult.error) throw messagesResult.error;
      if (readsResult.error) throw readsResult.error;
      const reads = new Map(
        (readsResult.data || []).map((r) => [
          r.conversation_id,
          r.last_read_at,
        ]),
      );
      for (const m of messagesResult.data || []) {
        if (!latestMessages.has(m.conversation_id))
          latestMessages.set(m.conversation_id, m);
        if (
          m.sender_id !== uid &&
          (!reads.has(m.conversation_id) ||
            new Date(m.created_at) > new Date(reads.get(m.conversation_id)))
        )
          counts.set(
            m.conversation_id,
            (counts.get(m.conversation_id) || 0) + 1,
          );
      }
    }
    // La derniere activite determine l'ordre, sans changer les identifiants.
    const sortedConversations = [...conversations].sort((a, b) => {
      const ta =
        new Date(
          latestMessages.get(a.id)?.created_at || a.created_at,
        ).getTime() || 0;
      const tb =
        new Date(
          latestMessages.get(b.id)?.created_at || b.created_at,
        ).getTime() || 0;
      return tb - ta || b.created_at.localeCompare(a.created_at);
    });
    for (const c of sortedConversations) {
      const count = counts.get(c.id) || 0;
      unreadTotal += count;
      const li = document.createElement("li"),
        btn = document.createElement("button"),
        small = document.createElement("small");
      btn.type = "button";
      btn.setAttribute("aria-current", String(c.id === selectedId));
      btn.dataset.conversationId = c.id;
      const subject = document.createElement("span");
      subject.className = "madic-conversation-subject";
      subject.textContent = c.subject;
      btn.append(subject);
      if (count) {
        const unread = document.createElement("span");
        unread.textContent = ` (${count} non lu${count > 1 ? "s" : ""})`;
        btn.append(unread);
      }
      const latest = latestMessages.get(c.id);
      small.textContent = latest
        ? "Dernier message : " + date(latest.created_at)
        : "Conversation créée : " + date(c.created_at);
      btn.append(small);
      if (latest) {
        const preview = document.createElement("span");
        preview.className = "madic-client-msg-preview";
        preview.style.display = "block";
        preview.style.fontSize = "0.85em";
        preview.style.opacity = "0.8";
        preview.textContent =
          (latest.sender_id === uid ? "Vous : " : "Consultant : ") +
          (latest.body || "").replace(/\s+/g, " ").slice(0, 110);
        btn.append(preview);
      }
      btn.addEventListener("click", () =>
        openConversation(c.id).catch(showError),
      );
      li.append(btn);
      list.append(li);
    }
    if (!conversations.length) {
      const li = document.createElement("li");
      li.textContent =
        "Aucune conversation disponible pour ce compte. Si votre consultant en a créé une, contactez-le.";
      list.append(li);
    }
    $("clientMsgUnread").textContent = String(unreadTotal);
    $("clientMsgUnread").hidden = unreadTotal === 0;
    if (selectedId && !conversations.some((c) => c.id === selectedId))
      clearSelection();
  }
  function clearSelection() {
    selectedId = null;
    $("clientMsgTitle").textContent = "Choisissez une conversation";
    $("clientMsgSubject").textContent =
      "Les conversations sont ouvertes par votre consultant.";
    $("clientMsgMessages").replaceChildren();
    $("clientMsgSendForm").hidden = true;
  }
  async function openConversation(id) {
    const conversation = conversations.find((c) => c.id === id);
    if (!conversation) throw Error("Conversation non disponible.");
    selectedId = id;
    $("clientMsgTitle").textContent = conversation.subject;
    $("clientMsgSubject").textContent = "Conversation avec votre consultant";
    $("clientMsgSendForm").hidden = false;
    await loadMessages();
    await loadConversations();
  }
  async function loadMessages() {
    if (!selectedId) return;
    const id = selectedId;
    const { data, error } = await db
      .from("madic_cric_messages")
      .select("id,conversation_id,sender_id,body,created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) throw error;
    if (selectedId !== id) return;
    const history = $("clientMsgMessages");
    history.replaceChildren();
    for (const m of data || []) {
      const bubble = document.createElement("div"),
        time = document.createElement("time");
      bubble.className =
        "madic-client-msg-bubble" +
        (m.sender_id === uid ? " madic-client-msg-own" : "");
      bubble.textContent = m.body;
      time.dateTime = m.created_at;
      time.textContent =
        (m.sender_id === uid ? "Vous" : "Consultant") +
        " · " +
        date(m.created_at);
      bubble.append(time);
      history.append(bubble);
    }
    if (!data?.length)
      history.textContent = "Aucun message dans cette conversation.";
    history.scrollTop = history.scrollHeight;
    const { error: readError } = await db
      .from("madic_cric_message_reads")
      .upsert(
        {
          conversation_id: id,
          user_id: uid,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id,user_id" },
      );
    if (readError)
      console.warn(
        "MADIC : état de lecture non enregistré :",
        readError.message,
      );
  }
  try {
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      location.replace("connexion-client-cric.html");
      return;
    }
    uid = auth.user.id;
    const { data: linked, error: linkError } = await db.rpc(
      "madic_my_cric_client_spaces",
    );
    if (linkError) throw linkError;
    spaces = linked || [];
    if (!spaces.length)
      throw Error("Aucun cabinet CRIC associé à votre compte.");
    for (const s of spaces) {
      const opt = document.createElement("option");
      opt.value = s.space_id;
      opt.textContent = s.space_name;
      $("clientMsgCabinet").append(opt);
    }
    $("clientMsgApp").hidden = false;
    if (window.MADICPresence) window.MADICPresence.watchClient(db, cabinetId());
    await loadConversations();
    // Module 7.5b : actualisation automatique observable et protection contre les requêtes simultanées.
    let refreshing = false;
    let refreshTimer = null;
    const refreshState = $("clientMsgAutoRefreshState");
    const refreshLabel = (message) => {
      if (refreshState) refreshState.textContent = message;
    };
    async function autoRefresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        await loadConversations();
        if (selectedId) {
          await loadMessages();
          await loadConversations();
        }
        refreshLabel(
          "Dernière vérification automatique : " +
            new Date().toLocaleTimeString("fr-CA", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
        );
      } catch (error) {
        refreshLabel(
          "Actualisation automatique en erreur : " +
            (error?.message || String(error)),
        );
        console.warn("MADIC : actualisation automatique indisponible :", error);
      } finally {
        refreshing = false;
      }
    }
    function startAutoRefresh() {
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
      refreshLabel("Actualisation automatique activée (10 secondes).");
      refreshTimer = window.setInterval(() => {
        void autoRefresh();
      }, 10000);
    }
    startAutoRefresh();
    void autoRefresh();
    document.addEventListener("visibilitychange", () => {
      void autoRefresh();
    });
    window.addEventListener("pageshow", () => {
      startAutoRefresh();
      void autoRefresh();
    });

    $("clientMsgCabinet").addEventListener("change", () => {
      clearSelection();
      if (window.MADICPresence)
        window.MADICPresence.watchClient(db, cabinetId());
      loadConversations().catch(showError);
    });
    $("clientMsgRefresh").addEventListener("click", async () => {
      try {
        await loadConversations();
        await loadMessages();
        await loadConversations();
        status("Messages actualisés.");
      } catch (e) {
        showError(e);
      }
    });
    $("clientMsgSendForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = $("clientMsgBody").value.trim();
      if (!body || !selectedId) return;
      const button = $("clientMsgSend");
      button.disabled = true;
      try {
        const { error } = await db
          .from("madic_cric_messages")
          .insert({ conversation_id: selectedId, sender_id: uid, body });
        if (error) throw error;
        $("clientMsgBody").value = "";
        await loadMessages();
        await loadConversations();
        status("Réponse envoyée.");
      } catch (e) {
        showError(e);
      } finally {
        button.disabled = false;
      }
    });
  } catch (e) {
    showError(e);
  }
})();


/* --- madic-messagerie-pieces-jointes.js --- */
/* MADIC : pièces jointes des conversations, sans changement aux scripts de messagerie. */
(async () => {
  "use strict";
  if (window.MADIC_GUEST_PORTAL) return;
  const isClient = !!document.getElementById("clientMsgSendForm");
  const prefix = isClient ? "clientMsg" : "msg";
  const form = document.getElementById(prefix + "SendForm");
  const history = document.getElementById(prefix + "Messages");
  if (!form || !history || typeof window.getMadicSupabase !== "function")
    return;
  const db = window.getMadicSupabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth?.user) return;
  const uid = auth.user.id;
  const bucket = "madic-message-attachments";
  const maxSize = 10 * 1024 * 1024;
  const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".pdf,.jpg,.jpeg,.png";
  picker.id = prefix + "AttachmentFile";
  const label = document.createElement("label");
  label.htmlFor = picker.id;
  label.textContent = "Joindre un document (PDF, JPG, PNG - 10 Mo maximum)";
  const upload = document.createElement("button");
  upload.type = "button";
  upload.textContent = "Envoyer la pièce jointe";
  upload.className = "secondary";
  const info = document.createElement("small");
  info.setAttribute("role", "status");
  info.setAttribute("aria-live", "polite");
  info.style.display = "block";
  form.append(label, picker, upload, info);
  const section = document.createElement("section");
  section.className = "madic-message-attachments";
  section.style.marginTop = "1rem";
  const title = document.createElement("h3");
  title.textContent = "Pièces jointes de la conversation";
  const list = document.createElement("ul");
  const count = document.createElement("small");
  count.className = "madic-attachment-count";
  count.setAttribute("aria-live", "polite");
  const heading = document.createElement("div");
  heading.className = "madic-attachment-heading";
  heading.append(title, count);
  list.className = "madic-attachment-list";
  section.append(heading, list);
  history.insertAdjacentElement("afterend", section);
  // L'identifiant est porte par le bouton reel, meme lorsque la liste est filtree.
  // Ne jamais deduire une conversation de sa position dans la liste.
  function currentConversation() {
    const listId = isClient ? "clientMsgConversations" : "msgConversations";
    const selected = document.querySelector(
      "#" + listId + ' button[aria-current="true"]',
    );
    return selected?.dataset.conversationId || null;
  }
  function selectedClientName() {
    if (isClient) return null;
    // Le regroupement affiche seulement l'objet dans le bouton de conversation.
    // Le titre du client sélectionné est déjà affiché par le module principal.
    const name = document
      .getElementById("msgCurrentClient")
      ?.textContent?.trim();
    if (name && name !== "Client" && name !== "Sélectionnez un client")
      return name;
    return null;
  }
  function clearAttachments() {
    section.hidden = true;
    list.replaceChildren();
  }
  let busy = false,
    lastId = null;
  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const id = currentConversation();
      if (id !== lastId) clearAttachments();
      section.hidden = !id;
      if (!id) {
        lastId = null;
        list.replaceChildren();
        return;
      }
      const { data, error } = await db
        .from("madic_cric_message_attachments")
        .select("id,filename,storage_path,size_bytes,created_at,uploader_id")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      if (id !== currentConversation()) {
        clearAttachments();
        return;
      }
      list.replaceChildren();
      count.textContent =
        (data || []).length +
        " document" +
        ((data || []).length === 1 ? "" : "s");
      for (const file of data || []) {
        const li = document.createElement("li");
        li.className = "madic-attachment-item";
        const openButton = document.createElement("button");
        const downloadButton = document.createElement("button");
        openButton.type = downloadButton.type = "button";
        openButton.className = downloadButton.className = "secondary";
        openButton.textContent = "Ouvrir";
        downloadButton.textContent = "Télécharger";
        openButton.classList.add("madic-attachment-open");
        downloadButton.classList.add("madic-attachment-download");
        const sender =
          file.uploader_id === uid
            ? "Vous"
            : isClient
              ? "Consultant CRIC"
              : selectedClientName() || "Client";
        const meta = document.createElement("small");
        meta.textContent =
          "Envoyé par : " +
          sender +
          " · " +
          new Intl.DateTimeFormat("fr-CA", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "America/Toronto",
          }).format(new Date(file.created_at));
        meta.className = "madic-attachment-meta";
        const filename = document.createElement("strong");
        filename.className = "madic-attachment-filename";
        filename.textContent = file.filename;
        const size = document.createElement("small");
        size.className = "madic-attachment-size";
        size.textContent =
          Math.ceil(file.size_bytes / 1024).toLocaleString("fr-CA") + " Ko";
        const icon = document.createElement("span");
        icon.className = "madic-attachment-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = /\.pdf$/i.test(file.filename) ? "PDF" : "IMG";
        const detail = document.createElement("div");
        detail.className = "madic-attachment-detail";
        detail.append(filename, size, meta);
        const buttons = document.createElement("div");
        buttons.className = "madic-attachment-actions";
        buttons.append(openButton, downloadButton);
        async function openAttachment() {
          openButton.disabled = true;
          try {
            const { data: signed, error } = await db.storage
              .from(bucket)
              .createSignedUrl(file.storage_path, 60);
            if (error) throw error;
            if (!signed?.signedUrl)
              throw Error("Lien temporaire indisponible.");
            window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
          } catch (e) {
            info.textContent =
              "Ouverture impossible : " + (e?.message || String(e));
          } finally {
            openButton.disabled = false;
          }
        }
        async function downloadAttachment() {
          downloadButton.disabled = true;
          try {
            // Supabase Storage verifies the current user's permissions before returning bytes.
            const { data: blob, error } = await db.storage
              .from(bucket)
              .download(file.storage_path);
            if (error) throw error;
            if (!blob) throw Error("Fichier indisponible.");
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = (file.filename || "piece-jointe")
              .split(/[\\/]/)
              .pop();
            anchor.style.display = "none";
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 60000);
            info.textContent = "Téléchargement lancé : " + file.filename;
          } catch (e) {
            info.textContent =
              "Téléchargement impossible : " + (e?.message || String(e));
          } finally {
            downloadButton.disabled = false;
          }
        }
        openButton.addEventListener("click", openAttachment);
        downloadButton.addEventListener("click", downloadAttachment);
        li.append(icon, detail, buttons);
        list.append(li);
      }
      if (!data?.length) {
        const li = document.createElement("li");
        li.textContent = "Aucune pièce jointe.";
        list.append(li);
      }
      lastId = id;
    } catch (e) {
      info.textContent = "Pièces jointes : " + (e?.message || String(e));
    } finally {
      busy = false;
    }
  }
  upload.addEventListener("click", async () => {
    const file = picker.files?.[0];
    if (!file) return void (info.textContent = "Sélectionnez un fichier.");
    if (!allowed.has(file.type) || !/\.(pdf|jpe?g|png)$/i.test(file.name))
      return void (info.textContent = "Format non autorisé.");
    if (file.size > maxSize || !file.size)
      return void (info.textContent =
        "Le fichier doit mesurer entre 1 octet et 10 Mo.");
    upload.disabled = true;
    let path = null;
    try {
      const id = currentConversation();
      if (!id) throw Error("Sélectionnez une conversation.");
      const extension = file.name.split(".").pop().toLowerCase();
      path = id + "/" + crypto.randomUUID() + "." + extension;
      const { error: uploadError } = await db.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      if (id !== currentConversation())
        throw Error(
          "La conversation a change pendant le transfert. Verifiez le fichier avant de continuer.",
        );
      const { error: rowError } = await db
        .from("madic_cric_message_attachments")
        .insert({
          conversation_id: id,
          uploader_id: uid,
          filename: file.name.slice(0, 240),
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        });
      if (rowError) throw rowError;
      picker.value = "";
      info.textContent = "Pièce jointe envoyée.";
      await refresh();
    } catch (e) {
      info.textContent = "Envoi impossible : " + (e?.message || String(e));
    } finally {
      upload.disabled = false;
    }
  });
  section.hidden = true;
  setInterval(() => {
    void refresh();
  }, 10000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refresh();
  });
  document.addEventListener("click", (e) => {
    if (
      e.target.closest(
        "#" +
          (isClient ? "clientMsgConversations" : "msgConversations") +
          " button",
      )
    ) {
      clearAttachments();
      setTimeout(() => {
        void refresh();
      }, 250);
    }
  });
  document
    .getElementById("clientMsgCabinet")
    ?.addEventListener("change", () => {
      clearAttachments();
      setTimeout(() => {
        void refresh();
      }, 250);
    });
  setTimeout(() => {
    void refresh();
  }, 800);
})();


/* --- madic-client-sidebar.js --- */
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


/* --- madic-footer.js --- */
/* Footer commun MADIC : traduction des libellés sur les pages sans gestionnaire FR/EN. */
(function(){"use strict";function apply(lang){lang=lang==="en"?"en":"fr";document.querySelectorAll(".madic-footer [data-fr][data-en]").forEach(function(el){el.textContent=el.getAttribute("data-"+lang);});}var lang="fr";try{lang=new URLSearchParams(location.search).get("lang")||localStorage.getItem("madic-lang")||"fr";}catch(e){}apply(lang);window.addEventListener("storage",function(e){if(e.key==="madic-lang")apply(e.newValue);});})();


/* --- inline --- */

      /* Explicit click-only interface translation. No observer, no form value changes. */
      (function () {
        "use strict";
        const dict = {
          Déconnexion: "Sign out",
          Connexion: "Sign in",
          "Mon espace": "My space",
          "MON ESPACE": "MY SPACE",
          "Personnaliser le menu": "Customize menu",
          "Vue d’ensemble": "Overview",
          Actualités: "News",
          "Mon profil": "My profile",
          "Mes contrats": "My contracts",
          Formulaire: "Form",
          Messagerie: "Messaging",
          "Rendez-vous": "Appointments",
          "Mes dossiers": "My cases",
          Documents: "Documents",
          Factures: "Invoices",
          "Espace client sécurisé": "Secure client space",
          "Votre projet, à votre rythme.": "Your project, at your pace.",
          "Consultant hors ligne": "Consultant offline",
          "Consultant en ligne": "Consultant online",
          "Échanges confidentiels avec votre consultant.":
            "Confidential exchanges with your consultant.",
          "Messagerie du client chargée.": "Client messaging loaded.",
          "Conversation générale": "General conversation",
          "Dernière vérification automatique :": "Last automatic check:",
          "Dernier message :": "Last message:",
          "Vous :": "You:",
          "Cabinet CRIC": "RCIC firm",
          Conversations: "Conversations",
          Actualiser: "Refresh",
          "Choisissez une conversation": "Choose a conversation",
          "Les conversations sont ouvertes par votre consultant.":
            "Conversations are opened by your consultant.",
          "Votre réponse": "Your reply",
          "Envoyer ma réponse": "Send my reply",
          "Écrivez votre message…": "Write your message…",
          "Mes rendez-vous et consultations":
            "My appointments and consultations",
          "Notifications de rendez-vous": "Appointment notifications",
          "Marquer comme lue": "Mark as read",
          "Cabinet de consultation": "Consulting firm",
          "Mon consultant": "My consultant",
          "Créneaux disponibles": "Available time slots",
          "Sélectionnez une plage horaire qui vous convient.":
            "Select a suitable time slot.",
          "Semaine suivante →": "Next week →",
          "← Semaine précédente": "← Previous week",
          "Durée du rendez-vous :": "Appointment duration:",
          "Mes réservations": "My bookings",
          "Retrouvez le statut et les détails de vos rendez-vous.":
            "Find the status and details of your appointments.",
          Début: "Start",
          Fin: "End",
          Type: "Type",
          Action: "Action",
          Statut: "Status",
          "Lieu / lien de consultation": "Consultation location / link",
          Annuler: "Cancel",
          "Voir le lien": "View link",
          Confirmé: "Confirmed",
          "En attente de confirmation": "Pending confirmation",
          "Aucun créneau disponible pour le moment.":
            "No time slots available at this time.",
          "Aucun créneau": "No time slots",
          "ÉVALUATION PRÉLIMINAIRE": "PRELIMINARY ASSESSMENT",
          "Parlez-nous de votre projet d’immigration":
            "Tell us about your immigration plans",
          "Déclaration importante": "Important declaration",
          "Informations importante": "Important information",
          "Informations importantes": "Important information",
          Précédent: "Previous",
          Suivant: "Next",
          Soumettre: "Submit",
          "Pays :": "Country:",
          "Ma messagerie sécurisée": "My secure messaging",
          "PORTAIL CLIENT CRIC": "RCIC CLIENT PORTAL",
          "Présence du consultant indisponible": "Consultant presence unavailable",
          "Connexion au service de présence...": "Connecting to presence service...",
          "Synchronisation Realtime non confirmée": "Realtime synchronization not confirmed",
          "← Retour à mon espace": "← Back to my space",
          "Vérification de votre accès…": "Checking your access…",
          "Initialisation de l’actualisation automatique…": "Initializing automatic refresh…",
          "Conversation avec votre consultant": "Conversation with your consultant",
          "Aucun message dans cette conversation.": "No messages in this conversation.",
          "Aucune conversation disponible pour ce compte. Si votre consultant en a créé une, contactez-le.": "No conversations are available for this account. If your consultant has created one, please contact them.",
          "Joindre un document (PDF, JPG, PNG - 10 Mo maximum)": "Attach a document (PDF, JPG, PNG - 10 MB maximum)",
          "Envoyer la pièce jointe": "Send attachment",
          "Pièces jointes de la conversation": "Conversation attachments",
          "Ouvrir": "Open",
          "Télécharger": "Download",
          "Aucune pièce jointe.": "No attachments.",
          "Sélectionnez un fichier.": "Select a file.",
          "Format non autorisé.": "Unsupported file format.",
          "Le fichier doit mesurer entre 1 octet et 10 Mo.": "The file must be between 1 byte and 10 MB.",
          "Sélectionnez une conversation.": "Select a conversation.",
          "Pièce jointe envoyée.": "Attachment sent.",
          "Terminer": "Done",
          "Réinitialiser": "Reset",
          "Glissez les éléments ou utilisez les flèches pour choisir votre ordre.": "Drag items or use the arrows to change their order.",
          "Glisser pour déplacer": "Drag to move",
          "Monter": "Move up",
          "Descendre": "Move down",
          "Aller au contenu principal": "Skip to main content",
          "Outils du compte": "Account tools",
          "Notifications de messagerie": "Message notifications",
          "Navigation de mon espace client": "Client space navigation",
          "Menu personnalisable": "Customizable menu",
          "Logo MADIC Portail": "MADIC Portal logo",
          "Espace client": "Client space",
          "Messagerie du client chargée.": "Client messaging loaded.",
          "Conversation générale": "General conversation",
          "Dernière vérification automatique :": "Last automatic check:",
          "Dernier message :": "Last message:",
          "Vous :": "You:",
          "Configuration Supabase manquante.": "Supabase configuration missing.",
          "Cabinet non autorisé.": "Unauthorized firm.",
          "Conversation non disponible.": "Conversation unavailable.",
          "À envoyer": "To send",
          "Envoyer": "Send",
          "Votre message a été envoyé.": "Your message has been sent.",
          "Envoi en cours…": "Sending…",
          "Actualisation automatique activée.": "Automatic refresh enabled.",
          "Actualisation automatique désactivée.": "Automatic refresh disabled.",
          "Connaissance des langues": "Language proficiency",
          "Niveau de Français :": "French proficiency:",
          "Niveau d’anglais :": "English proficiency:",
          "Choix votre niveau!": "Choose your level!",
          "Choix de votre pays!": "Choose your country!",
          "Choix votre test de compétence!": "Choose your language test!",
          "Expression orale :": "Speaking:",
          "Expression écrite :": "Writing:",
          "Compréhension orale :": "Listening:",
          "Compréhension écrite :": "Reading:",
        };
        const reverse = Object.fromEntries(
          Object.entries(dict).map(([a, b]) => [b, a]),
        );
        const key = "madic_ui_language";
        let lang = "fr";
        try {
          lang = localStorage.getItem(key) === "en" ? "en" : "fr";
        } catch (_) {}
        const slot =
          document.getElementById("madicHeroLanguage") ||
          document.querySelector("header .toplinks");
        if (!slot) return;
        const wrap = document.createElement("div");
        wrap.className = "madic-three-lang";
        wrap.setAttribute("aria-label", "Langue / Language");
        const buttons = {};
        for (const code of ["fr", "en"]) {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = code.toUpperCase();
          b.addEventListener("click", () => {
            lang = code;
            try {
              localStorage.setItem(key, code);
            } catch (_) {}
            apply();
          });
          wrap.appendChild(b);
          buttons[code] = b;
        }
        slot.appendChild(wrap);
        // Translate UI text, including status messages inserted after Supabase loads.
        // Never translate conversation subjects, message bodies, or uploaded filenames.
        function protectedContent(el) {
          return !!el?.closest('.madic-client-msg-bubble, .madic-client-msg-preview, .madic-attachment-filename, .madic-conversation-subject');
        }
        function convert(value, map) {
          if (Object.prototype.hasOwnProperty.call(map, value)) return map[value];
          if (lang !== 'en') return value;
          const patterns = [
            [/^(\d+) non lus?$/, (_, n) => n + ' unread'],
            [/^Dernière vérification automatique : (.*)$/, (_, t) => 'Last automatic check: ' + t],
            [/^Actualisation automatique en erreur : (.*)$/, (_, e) => 'Automatic refresh error: ' + e],
            [/^Dernier message : (.*)$/, (_, d) => 'Last message: ' + d],
            [/^Conversation créée : (.*)$/, (_, d) => 'Conversation created: ' + d],
            [/^Vous : (.*)$/, (_, body) => 'You: ' + body],
            [/^Consultant : (.*)$/, (_, body) => 'Consultant: ' + body],
            [/^Envoyé par : (.*)$/, (_, rest) => 'Sent by: ' + rest.replace(/^Vous\b/, 'You')],
            [/^(\d+) documents?$/, (_, n) => n + ' document' + (n === '1' ? '' : 's')],
            [/^(\d+) Ko$/, (_, n) => n + ' KB'],
            [/^Pièces jointes : (.*)$/, (_, e) => 'Attachments: ' + e],
            [/^Téléchargement lancé : (.*)$/, (_, f) => 'Download started: ' + f],
            [/^Téléchargement impossible : (.*)$/, (_, e) => 'Download failed: ' + e],
            [/^Ouverture impossible : (.*)$/, (_, e) => 'Unable to open: ' + e],
            [/^Envoi impossible : (.*)$/, (_, e) => 'Unable to send: ' + e],
            [/^Erreur : (.*)$/, (_, e) => 'Error: ' + e],
            [/^Vous · (.*)$/, (_, d) => 'You · ' + d],
          ];
          for (const [pattern, replacement] of patterns) if (pattern.test(value)) return value.replace(pattern, replacement);
          return value;
        }
        function translate() {
          const map = lang === 'en' ? dict : reverse;
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode(n) {
              return n.parentElement && (n.parentElement.closest('script,style,textarea,option,[contenteditable="true"]') || protectedContent(n.parentElement))
                ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
          });
          let node;
          while ((node = walker.nextNode())) {
            const raw = node.nodeValue, word = raw.trim();
            const translated = convert(word, map);
            if (translated !== word) node.nodeValue = raw.replace(word, translated);
          }
          for (const el of document.querySelectorAll('[placeholder],[aria-label],[title]')) {
            if (protectedContent(el)) continue;
            for (const a of ['placeholder', 'aria-label', 'title']) {
              const v = el.getAttribute(a);
              if (v) {
                const translated = convert(v, map);
                if (translated !== v) el.setAttribute(a, translated);
              }
            }
          }
          const title = document.querySelector('title[data-fr][data-en]');
          if (title && title.textContent !== title.getAttribute('data-' + lang)) title.textContent = title.getAttribute('data-' + lang);
        }
        // Dynamic UI strings are generated asynchronously by the messaging and attachment modules.
        let scheduled = false;
        const observer = new MutationObserver(() => {
          if (scheduled) return;
          scheduled = true;
          queueMicrotask(() => { scheduled = false; translate(); });
        });
        observer.observe(document.body, {childList:true, subtree:true, characterData:true});
        function apply() {
          const pageLanguage = lang === "en" ? "en-CA" : "fr-CA";
          if (document.documentElement.lang !== pageLanguage) document.documentElement.lang = pageLanguage;
          translate();
          for (const code of ["fr", "en"])
            buttons[code].setAttribute("aria-pressed", String(code === lang));
        }
        apply();
      })();
    

/* --- inline --- */

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
    

})().catch(error => console.error("MADIC messagerie:",error));
