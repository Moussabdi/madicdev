(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  if (params.get("guest") !== "1" && !params.has("access")) return;

  const page = location.pathname
    .split("/")
    .pop()
    .replace(/\.html$/, "");
  const pages = new Set([
    "dashboard-client-cric",
    "actualites-client-cric",
    "profil-client-cric",
    "mes-dossiers-client-cric",
    "documents-client-cric",
    "factures-client-cric",
    "mes-rendez-vous-cric",
    "messagerie-client-cric",
    "mes-contrats",
    "formulaire",
  ]);
  const id = (name) => document.getElementById(name);
  const lang = () =>
    document.documentElement.lang.startsWith("en") ? "en" : "fr";
  const tr = (fr, en) => (lang() === "en" ? en : fr);
  const locale = () => (lang() === "en" ? "en-CA" : "fr-CA");
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
  const accessUrl = new URL(
    "invitation-client-cric.html?guest=1",
    location.href,
  );
  let db,
    access,
    banner,
    notice,
    content,
    checking = false;
  let portalHeader;
  const urls = new Set();
  function showError() {
    label(
      notice,
      "Impossible de charger cette information. Actualisez la page ou vérifiez que l’accès est encore actif.",
      "Unable to load this information. Refresh the page or check that the access is still active.",
    );
  }
  function failAccess(fr, en) {
    // Supprimer les pièces et les données déjà rendues dès que la révocation est détectée.
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls.clear();
    access = null;
    if (content) {
      for (const child of [...content.children]) {
        if (child !== banner && child !== portalHeader) child.remove();
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
      try {
        await run();
      } catch {
        showError();
      } finally {
        button.disabled = false;
      }
    });
    return button;
  }
  async function initialize() {
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
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
    access = wanted
      ? grants?.find((item) => item.grant_id === wanted)
      : grants?.[0];
    if (!access) {
      failAccess(
        "Cet accès invité est indisponible ou a été révoqué.",
        "This guest access is unavailable or has been revoked.",
      );
      return false;
    }
    if (!wanted) history.replaceState(null, "", scoped(location.href));
    for (const anchor of document.querySelectorAll("a[href]")) {
      const url = new URL(anchor.href, location.href);
      if (
        url.origin === location.origin &&
        pages.has(
          url.pathname
            .split("/")
            .pop()
            .replace(/\.html$/, ""),
        )
      ) {
        anchor.href = scoped(url).href;
      }
    }
    banner.querySelector("[data-guest-name]").textContent = access.client_name;
    if (grants.length > 1) {
      const select = element("select");
      const caption = element("label", null, "madic-guest-banner__picker");
      select.append(
        ...grants.map(
          (item) =>
            new Option(item.client_name + " · " + item.cabinet, item.grant_id),
        ),
      );
      select.value = access.grant_id;
      select.addEventListener("change", () =>
        location.assign(scoped(location.href, select.value)),
      );
      const captionText = element("span");
      label(captionText, "Dossier partagé", "Shared file");
      caption.append(captionText, select);
      banner.append(caption);
    }
    return true;
  }

  // La promesse attend la construction du bandeau et l’exécution des modules d’interface existants.
  let resolveStart;
  const started = new Promise((resolve) => {
    resolveStart = resolve;
  });
  async function read(section, offset = 0) {
    if (!(await started) || !access) throw Error("Guest access unavailable");
    const grant = access.grant_id;
    const { data, error } = await db.rpc("madic_guest_read", {
      p_grant: grant,
      p_section: section,
      p_offset: offset,
    });
    if (error || access?.grant_id !== grant)
      throw error || Error("Guest access unavailable");
    return data;
  }
  window.MADIC_GUEST_PORTAL = { read, showError };
  document.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  function clearText(name) {
    const node = id(name);
    if (node) {
      node.textContent = "";
      node.hidden = true;
    }
  }
  const statuses = {
    actif: ["Actif", "Active"],
    en_attente: ["En attente", "Pending"],
    ferme: ["Fermé", "Closed"],
    confirme: ["Confirmé", "Confirmed"],
    confirmed: ["Confirmé", "Confirmed"],
    pending: ["En attente", "Pending"],
    requested: ["Demandé", "Requested"],
    cancelled: ["Annulé", "Cancelled"],
    canceled: ["Annulé", "Cancelled"],
    completed: ["Terminé", "Completed"],
    refused: ["Refusé", "Declined"],
    declined: ["Refusé", "Declined"],
    accepte: ["Accepté", "Accepted"],
    refuse: ["Refusé", "Declined"],
    recu: ["Reçu", "Received"],
    publie: ["Publié", "Published"],
    signe: ["Signé", "Signed"],
    client_signe: ["Signé par le client", "Signed by client"],
    deux_signatures: ["Signé par les deux parties", "Signed by both parties"],
    received: ["Reçue", "Received"],
    reviewing: ["En analyse", "Under review"],
    responded: ["Réponse envoyée", "Responded"],
    closed: ["Fermée", "Closed"],
    requested_doc: ["Demandé", "Requested"],
    uploaded: ["Transmis", "Uploaded"],
    video: ["Vidéo", "Video"],
    phone: ["Téléphone", "Phone"],
    in_person: ["En personne", "In person"],
    consultation: ["Consultation", "Consultation"],
    proposition: ["Proposition", "Proposal"],
  };
  function status(value) {
    const span = element("span", value || "-");
    if (Object.hasOwn(statuses, value)) label(span, ...statuses[value]);
    return span;
  }
  function date(value) {
    if (!value) return "-";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(+parsed)
      ? "-"
      : parsed.toLocaleString(locale(), { timeZone: "America/Toronto" });
  }
  function money(value, currency) {
    const code = /^[A-Z]{3}$/.test(currency || "") ? currency : "CAD";
    return new Intl.NumberFormat(locale(), {
      style: "currency",
      currency: code,
    }).format((Number(value) || 0) / 100);
  }
  function cell(row, value) {
    const td = row.insertCell();
    if (value instanceof Node) td.append(value);
    else td.textContent = value ?? "-";
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
      rows.slice(0, 25).forEach((record) => {
        const line = tbody.insertRow();
        columns.forEach((property) =>
          cell(
            line,
            typeof property === "function"
              ? property(record)
              : record[property],
          ),
        );
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
    const { data, error } = await db.functions.invoke(
      "madic-send-client-invitation",
      {
        body: {
          action: "guest_download",
          grant_id: grant,
          bucket: row.bucket,
          path: row.file,
        },
      },
    );
    if (error || !(data instanceof Blob) || access?.grant_id !== grant)
      throw error || Error("File unavailable");
    return data;
  }
  function download(row) {
    return row.file
      ? action("Télécharger", "Download", async () => {
          const url = URL.createObjectURL(await fileBlob(row));
          urls.add(url);
          const link = element("a");
          link.href = url;
          link.download = row.original_name || row.filename || "MADIC.pdf";
          link.click();
          setTimeout(() => {
            URL.revokeObjectURL(url);
            urls.delete(url);
          }, 5000);
        })
      : "-";
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
    const images = [
      id("madicClientAvatarImage"),
      id("madicProfileAvatarImage"),
    ].filter(Boolean);
    if (!images.length || !profile.file) return;
    try {
      const url = URL.createObjectURL(await fileBlob(profile));
      urls.add(url);
      images.forEach((image) => {
        image.src = url;
      });
    } catch {
      // L’avatar neutre du portail reste affiché.
    }
  }
  function fillProfile(profile) {
    show("profileContent");
    hide("toggleProfile");
    hide("profileHint");
    const form = id("profile");
    const mapped = { first: "first_name", last: "last_name" };
    for (const field of form.querySelectorAll("input, select, textarea")) {
      const value = profile[mapped[field.id] || field.name || field.id];
      if (field.type !== "file" && value != null) {
        if (
          field.tagName === "SELECT" &&
          ![...field.options].some((opt) => opt.value === String(value))
        ) {
          field.add(new Option(String(value), String(value)));
        }
        field.value = value;
      }
      field.disabled = true;
      if (field.value) {
        field.closest("[hidden]")?.removeAttribute("hidden");
      }
    }
    form
      .querySelectorAll("button, .madic-profile-photo-actions")
      .forEach((node) => {
        node.hidden = true;
      });
  }
  function invoiceDetail(invoice) {
    const details = element("details");
    const summary = element("summary");
    label(summary, "Voir la facture", "View invoice");
    details.append(summary);
    if (invoice.description) details.append(element("p", invoice.description));
    if (Array.isArray(invoice.items)) {
      const list = element("ul");
      invoice.items.forEach((item) =>
        list.append(
          element(
            "li",
            [
              item.description,
              item.quantity,
              money(item.unit_price_cents, invoice.currency),
            ]
              .filter((value) => value != null)
              .join(" · "),
          ),
        ),
      );
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
      if (upload.nextElementSibling?.tagName === "P")
        upload.nextElementSibling.hidden = true;
    }
    clearText("docreqClientNotice");
    await Promise.all([
      table(id("docreqClientRows"), "requests", [
        "title",
        "instructions",
        (r) => date(r.due_on),
        (r) => status(r.status),
      ]),
      table(id("documents"), "documents", [
        "original_name",
        (r) => date(r.created_at),
        (r) => status(r.review_status || r.status),
        "review_reason",
        download,
      ]),
    ]);
  }
  async function appointments() {
    id("rdvSpace").append(new Option(access.cabinet));
    id("rdvSpace").disabled = true;
    id("slotRows").closest("section").hidden = true;
    clearText("rdvNotice");
    show("rdvApp");
    await table(id("bookingRows"), "appointments", [
      (r) => date(r.starts_at),
      (r) => status(r.mode),
      (r) => status(r.status),
      (r) => r.location_info || "-",
      () => "-",
    ]);
  }
  async function overview() {
    const [service, appointments, messages] = await Promise.all([
      read("service"),
      read("appointments"),
      read("messages"),
    ]);
    if (service) {
      show("madicJourneyPanel");
      id("madicJourneyStage").replaceChildren(status(service.status));
      id("madicJourneyStatus").replaceChildren(
        status(service.service_type),
        document.createTextNode(" · " + date(service.updated_at)),
      );
    }
    show("madicImmigrationFormCard");
    show("madicClientMessagingCard");
    const summary = id("madicClientMessagesSummary");
    if (messages.length)
      summary.textContent =
        messages[0].subject + " · " + date(messages[0].created_at);
    else label(summary, "Aucun message.", "No messages.");
    const rdv = id("madic-appointments")?.querySelector("p");
    if (appointments.length)
      rdv?.replaceChildren(
        document.createTextNode(date(appointments[0].starts_at) + " · "),
        status(appointments[0].status),
      );
    else label(rdv, "Aucun rendez-vous.", "No appointments.");
  }
  async function messages() {
    const list = id("clientMsgConversations"),
      historyNode = id("clientMsgMessages");
    id("clientMsgCabinet").append(new Option(access.cabinet));
    id("clientMsgCabinet").disabled = true;
    hide("clientMsgSendForm");
    clearText("clientMsgAutoRefreshState");
    clearText("clientMsgStatus");
    hide("madicConsultantPresence");
    show("clientMsgApp");
    let selected,
      version = 0;
    async function open(conversation, button) {
      selected = conversation.conversation_id;
      const activeVersion = ++version;
      list
        .querySelectorAll("button[aria-current]")
        .forEach((node) =>
          node.setAttribute("aria-current", String(node === button)),
        );
      id("clientMsgTitle").textContent = conversation.subject;
      clearText("clientMsgSubject");
      historyNode.replaceChildren();
      let messageOffset = 0,
        attachmentOffset = 0;
      const timeline = element("div"),
        attachments = element("div");
      historyNode.append(timeline, attachments);
      async function pageMessages(more) {
        const records = await read("messages:" + selected, messageOffset);
        if (activeVersion !== version) return;
        more?.remove();
        const entries = records.slice(0, 25);
        const bubbles = entries.reverse().map((item) => {
          const bubble = element(
            "div",
            item.body,
            "madic-client-msg-bubble" +
              (item.sender === "client" ? " madic-client-msg-own" : ""),
          );
          const time = element("time");
          time.dateTime = item.created_at;
          label(
            time,
            (item.sender === "client" ? "Client" : "Cabinet") +
              " · " +
              date(item.created_at),
            (item.sender === "client" ? "Client" : "Firm") +
              " · " +
              date(item.created_at),
          );
          bubble.append(time);
          return bubble;
        });
        timeline.prepend(...bubbles);
        if (records.length > 25) {
          messageOffset += 25;
          const previous = action(
            "Afficher les messages précédents",
            "Show earlier messages",
            () => pageMessages(previous),
          );
          timeline.prepend(previous);
        } else if (!timeline.children.length) {
          const empty = element("p");
          label(
            empty,
            "Aucun message dans cette conversation.",
            "No messages in this conversation.",
          );
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
          const moreFiles = action(
            "Afficher les autres pièces jointes",
            "Show more attachments",
            () => pageAttachments(moreFiles),
          );
          attachments.append(moreFiles);
        }
      }
      await Promise.all([pageMessages(), pageAttachments()]);
    }
    let offset = 0,
      request = 0;
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
        const button = action(item.subject, item.subject, () =>
          open(item, button),
        );
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
    id("clientMsgRefresh").addEventListener("click", () =>
      loadList(true).catch(showError),
    );
    await loadList(true);
  }
  async function contracts() {
    const root = id("madic-contracts");
    clearText("contract-message");
    const list = element("table");
    const head = list.createTHead().insertRow();
    [
      ["Contrat", "Contract"],
      ["Statut", "Status"],
      ["Date", "Date"],
      ["Consulter", "View"],
      ["Copie", "Copy"],
    ].forEach((names) => {
      const th = element("th");
      label(th, ...names);
      head.append(th);
    });
    const primary = list.createTBody(),
      legacy = list.createTBody();
    const preview = element("div");
    root.replaceChildren(list, preview);
    let revision = 0;
    function openContract(item, isLegacy) {
      return action("Voir le contrat", "View contract", async () => {
        const current = ++revision;
        const { data, error } = await db.rpc(
          isLegacy ? "madic_guest_legacy_contract" : "madic_guest_contract",
          { p_grant: access?.grant_id, p_contract: item.contract_id },
        );
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
        template.content
          .querySelectorAll(
            "script,iframe,object,embed,form,button,input,textarea,select,link,meta,base,svg,math",
          )
          .forEach((node) => node.remove());
        template.content
          .querySelectorAll("a,area")
          .forEach((node) => node.removeAttribute("href"));
        frame.srcdoc =
          '<!doctype html><meta charset="utf-8">' +
          "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'\">" +
          template.innerHTML;
        preview.replaceChildren(frame);
        frame.scrollIntoView({ block: "nearest" });
      });
    }
    await Promise.all([
      table(primary, "contracts", [
        "reference",
        (r) => status(r.status),
        (r) => date(r.created_at),
        (r) => openContract(r, false),
        download,
      ]),
      table(legacy, "legacy_contracts", [
        "title",
        (r) => status(r.status),
        (r) => date(r.published_at),
        (r) => openContract(r, true),
        () => "-",
      ]),
    ]);
  }

  async function verifyAccess() {
    if (!access || checking || document.hidden) return;
    checking = true;
    try {
      const { data, error } = await db.rpc("madic_guest_list");
      if (error) throw error;
      if (!data?.some((item) => item.grant_id === access?.grant_id)) {
        failAccess(
          "Cet accès invité est indisponible ou a été révoqué.",
          "This guest access is unavailable or has been revoked.",
        );
      }
    } catch {
      failAccess(
        "Impossible de vérifier cet accès. Actualisez la page.",
        "Unable to verify this access. Refresh the page.",
      );
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
    portalHeader = content.querySelector(":scope > header");
    banner = element("section", null, "madic-guest-banner");
    banner.setAttribute("aria-labelledby", "madicGuestBannerLabel");
    const identity = element("div");
    const title = element("strong", null, "madic-guest-banner__label");
    title.id = "madicGuestBannerLabel";
    const client = element("p", null, "madic-guest-banner__name");
    client.dataset.guestName = "";
    label(title, "Lecture seule", "Read only");
    identity.append(title, client);

    notice = element("p", null, "madic-guest-banner__notice");
    notice.setAttribute("role", "status");
    const exit = element("a");
    exit.href = accessUrl.href;
    label(exit, "Mes accès invités", "My guest accesses");
    const actions = element("div", null, "madic-guest-banner__actions");
    actions.append(exit);
    banner.append(identity, actions, notice);
    if (portalHeader) portalHeader.after(banner);
    else content.prepend(banner);
    let signingOut = false;
    async function signOutGuest() {
      if (signingOut) return;
      signingOut = true;
      try {
        const guestDb = db || window.getMadicSupabase();
        const { error } = await guestDb.auth.signOut();
        if (error) throw error;
        location.replace(accessUrl.href);
      } catch {
        label(
          notice,
          "Impossible de vous déconnecter. Réessayez.",
          "Unable to sign out. Please try again.",
        );
        signingOut = false;
      }
    }

    // Les commandes de déconnexion suivent le parcours invité.
    for (const control of document.querySelectorAll(
      '#logout,#madicHeaderSignout,[data-madic-signout="true"]',
    )) {
      control.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          void signOutGuest();
        },
        true,
      );
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
    observer.observe(document.documentElement, { attributeFilter: ["lang"] });
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
        label(
          formCard.querySelector("p"),
          "Consultez les réponses enregistrées au questionnaire.",
          "View the saved questionnaire responses.",
        );
        label(
          formCard.querySelector("a"),
          "Consulter le formulaire →",
          "View the form →",
        );
      }
      if (page === "formulaire") {
        label(
          document.querySelector(".form-hero__content h1"),
          "Formulaire d’immigration",
          "Immigration form",
        );
        label(
          document.querySelector(".form-hero__content p"),
          "Consultez les réponses enregistrées par le client.",
          "View the answers saved by the client.",
        );
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
          await table(id("dossiers"), "dossiers", [
            "reference",
            "category",
            (row) => status(row.status),
          ]);
        },
        "documents-client-cric": documents,
        "factures-client-cric": async () => {
          show("clientInvoicesPanel");
          clearText("clientInvoicesNotice");
          await table(id("clientInvoicesRows"), "invoices", [
            "invoice_number",
            (r) => date(r.issued_on),
            (r) => date(r.due_on),
            (r) => money(r.total_cents, r.currency),
            (r) => money(r.balance_cents, r.currency),
            invoiceDetail,
          ]);
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
      else
        failAccess(
          "Impossible de vérifier l’accès invité. Actualisez la page.",
          "Unable to verify guest access. Refresh the page.",
        );
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    void start();
  }
})();

const profileIrccEnglish = Object.freeze({
  "Résidence temporaire (visite, étude, travail)":
    "Temporary residence (visit, study, work)",
  "Catégorie de l’immigration économique": "Economic immigration class",
  "Parrainage d’un membre de la famille": "Family sponsorship",
  Réfugiés: "Refugees",
  "Cas pour circonstances d’ordre humanitaire":
    "Humanitarian and compassionate considerations",
  Passeport: "Passport",
  Citoyenneté: "Citizenship",
  "Cartes de résident permanent": "Permanent resident cards",
  "Remplacement ou modification de documents, vérification d’un statut":
    "Document replacement or amendment, or verification of status",
  "Visa de visiteur (de l’étranger)": "Visitor visa from outside Canada",
  "Visa de visiteur (à partir du Canada)": "Visitor visa from within Canada",
  "Prolongation de séjour à titre de visiteur (Fiche du visiteur)":
    "Visitor extension (visitor record)",
  "Super visa (parents et grands-parents)":
    "Super visa for parents and grandparents",
  "Permis d’études (de l’étranger)": "Study permit from outside Canada",
  "Permis d’études du Canada": "Study permit from within Canada",
  "Prolongation d’un permis d’études au Canada":
    "Study permit extension in Canada",
  "Permis de travail (de l’étranger)": "Work permit from outside Canada",
  "Permis de travail du Canada": "Work permit from within Canada",
  "Prolongation du permis de travail du Canada":
    "Canadian work permit extension",
  "Dans le cadre du Programme des travailleurs agricoles saisonniers":
    "Seasonal Agricultural Worker Program",
  "Expérience internationale Canada": "International Experience Canada",
  "Autorisation de voyage électronique (AVE)":
    "Electronic travel authorization (eTA)",
  "Entrée express": "Express Entry",
  "Travailleurs qualifiés (fédéral)": "Federal Skilled Worker Program",
  "Catégorie de l’expérience canadienne": "Canadian Experience Class",
  "Métiers spécialisés (fédéral)": "Federal Skilled Trades Program",
  "Programme des candidats des provinces": "Provincial Nominee Program",
  "Travailleurs qualifiés sélectionnés par le Québec":
    "Quebec-selected skilled workers",
  "Gens d’affaires (immigration économique)":
    "Business immigration (economic class)",
  "Autre demande d’immigration économique":
    "Other economic immigration application",
  "Époux, conjoint de fait ou partenaire conjugal":
    "Spouse, common-law or conjugal partner",
  "Enfant à charge": "Dependent child",
  "Parents ou grands-parents": "Parents or grandparents",
  "Autre membre de la famille": "Other family member",
  "Demande d’asile présentée au Canada": "Refugee claim made in Canada",
  "Réinstallation des réfugiés depuis l’étranger":
    "Refugee resettlement from abroad",
  "Personne protégée - résidence permanente":
    "Protected person - permanent residence",
  "Autre demande concernant les réfugiés": "Other refugee application",
  "Demande pour considérations d’ordre humanitaire":
    "Humanitarian and compassionate application",
  "Nouveau passeport canadien": "New Canadian passport",
  "Renouvellement de passeport canadien": "Canadian passport renewal",
  "Remplacement de passeport canadien": "Canadian passport replacement",
  "Attribution de la citoyenneté canadienne": "Grant of Canadian citizenship",
  "Certificat de citoyenneté": "Citizenship certificate",
  "Reprise de la citoyenneté canadienne": "Resumption of Canadian citizenship",
  "Renonciation à la citoyenneté canadienne":
    "Renunciation of Canadian citizenship",
  "Première carte de résident permanent": "First permanent resident card",
  "Renouvellement de la carte de résident permanent":
    "Permanent resident card renewal",
  "Remplacement de la carte de résident permanent":
    "Permanent resident card replacement",
  "Remplacement d’un document d’immigration":
    "Replacement of an immigration document",
  "Modification d’un document d’immigration":
    "Amendment of an immigration document",
  "Vérification du statut": "Verification of status",
});

/* SOURCE: assets/madic-formulaire-supabase.js */
/* MADIC - Formulaire client. Enregistrement direct dans Supabase avec RLS. */
(async () => {
  "use strict";
  const form = document.getElementById("madic-intake-form");
  const status = document.getElementById("madic-form-status");
  if (!form || !status) return;
  const guest = window.MADIC_GUEST_PORTAL;
  const message = (s, error = false) => {
    status.textContent = s;
    status.hidden = !error;
    status.style.color = error ? "#ffa3a3" : "#a5b7cc";
    status.classList.toggle("madic-status-hidden", !error);
  };
  if (
    !window.MADIC_CONFIG?.url ||
    !window.MADIC_CONFIG?.anonKey ||
    !window.supabase
  ) {
    message("Configuration Supabase manquante.", true);
    form.querySelector('[type="submit"]').disabled = true;
    return;
  }
  const db =
    typeof window.getMadicSupabase === "function"
      ? window.getMadicSupabase()
      : window.supabase.createClient(
          window.MADIC_CONFIG.url,
          window.MADIC_CONFIG.anonKey,
        );
  const {
    data: { user },
    error: authError,
  } = guest ? { data: { user: null } } : await db.auth.getUser();
  if (!guest && (authError || !user)) {
    location.replace("connexion-client-cric.html");
    return;
  }
  // Champs communs avec le profil du portail CRIC (mêmes colonnes que cric-client-dashboard.js).
  const profileMap = {
    prenom: "first_name",
    nom: "last_name",
    telephone: "phone",
    date_naissance: "date_of_birth",
    no_appart: "address_apartment",
    no_rue: "address_number",
    rue: "address_street",
    ville: "address_city",
    code_postale: "address_postal_code",
    province: "address_region",
  };
  const normalize = (v) =>
    String(v ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\s-]+/g, "")
      .toLowerCase();
  const setField = (name, value, overwrite = false) => {
    const e = [...form.elements].find((el) => el.name === name);
    if (!e || value == null || value === "" || (!overwrite && e.value)) return;
    if (e.tagName === "SELECT") {
      const option = [...e.options].find(
        (o) =>
          normalize(o.value) === normalize(value) ||
          normalize(o.textContent) === normalize(value),
      );
      if (option) e.value = option.value;
    } else e.value = value;
  };
  let profile = null;
  try {
    const result = guest
      ? { data: await guest.read("profile") }
      : await db.from("profiles").select("*").eq("id", user.id).single();
    if (result.error) throw result.error;
    profile = result.data;
  } catch (e) {
    message("Profil indisponible : " + e.message, true);
  }
  const profileFields = () => ({
    ...Object.fromEntries(
      Object.keys(profileMap).map((name) => [
        name,
        form.elements.namedItem(name)?.value.trim() || "",
      ]),
    ),
    sex: form.elements.namedItem("sex")?.value || "",
  });
  let profileBaseline = {};
  // Le projet IRCC du profil apporte du contexte. Un choix déjà saisi
  // dans le formulaire prime sur les suggestions du profil.
  function applyProfileProject() {
    const category = profile?.ircc_application_category;
    const type = profile?.ircc_application_type;
    const section = document.getElementById("madic-profile-ircc-context");
    if (!section) return;
    section.hidden = !category && !type;
    for (const [suffix, value] of [
      ["category", category],
      ["type", type],
    ]) {
      const line = document.getElementById("madic-profile-ircc-" + suffix);
      const text = typeof value === "string" ? value.trim() : "";
      line.hidden = !text;
      line.dataset.profileLabel = text;
      const english = document.documentElement.lang.startsWith("en");
      line.textContent = english ? (profileIrccEnglish[text] ?? text) : text;
    }
    const permanent = form.elements.namedItem("residence_permanente");
    const temporary = form.elements.namedItem("residence_temporaire");
    if (
      type !== "Travailleurs qualifiés sélectionnés par le Québec" ||
      (temporary?.value && temporary.value !== "aucun") ||
      permanent?.disabled ||
      (permanent?.value && permanent.value !== "immigration_economique")
    )
      return;
    setField("province_destination", "quebec");
    if (form.elements.namedItem("province_destination")?.value === "quebec") {
      setField("residence_permanente", "immigration_economique");
      permanent.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  function fillFromProfile(overwrite = false) {
    if (!profile) return;
    for (const [field, column] of Object.entries(profileMap))
      setField(field, profile[column], overwrite);
    if (profile.gender) {
      const gender = normalize(profile.gender);
      setField(
        "sex",
        /^(male|masculin|homme|m)$/.test(gender)
          ? "salle"
          : /^(female|feminin|femme|f)$/.test(gender)
            ? "terrasse"
            : "",
        overwrite,
      );
    }
    setField("courriel", profile.email || user?.email, overwrite);
    applyProfileProject();
    syncQuebecQuestions();
    profileBaseline = profileFields();
  }
  async function updateProfileFromForm() {
    if (!profile) return;
    const formValues = profileFields();
    const changes = {};
    for (const [field, column] of Object.entries(profileMap)) {
      if (
        !(column in profile) ||
        !formValues[field] ||
        formValues[field] === profileBaseline[field]
      )
        continue;
      changes[column] = formValues[field];
    }
    if ("gender" in profile && formValues.sex !== profileBaseline.sex) {
      if (formValues.sex === "salle") changes.gender = "Homme";
      if (formValues.sex === "terrasse") changes.gender = "Femme";
    }
    // Ne pas modifier l'adresse de connexion du compte Auth depuis ce formulaire.
    if (!Object.keys(changes).length) return;
    const { error } = await db
      .from("profiles")
      .update(changes)
      .eq("id", user.id);
    if (error)
      throw new Error(
        "Formulaire enregistré, mais synchronisation du profil impossible : " +
          error.message,
      );
    Object.assign(profile, changes);
    profileBaseline = formValues;
  }
  const quebecSection = document.getElementById("madic-intake-quebec");
  function syncQuebecQuestions() {
    if (!quebecSection) return;
    quebecSection.hidden =
      form.elements.namedItem("province_destination")?.value !== "quebec";
    for (const group of quebecSection.querySelectorAll("[data-qc-show]")) {
      const [name, value] = group.dataset.qcShow.split(":");
      const source = form.elements.namedItem("qc_" + name);
      group.hidden =
        source?.value !== value ||
        source.closest("[data-qc-show]")?.hidden === true;
    }
    for (const field of quebecSection.querySelectorAll("input, select")) {
      field.disabled = Boolean(guest) || !!field.closest("[hidden]");
    }
  }
  syncQuebecQuestions();
  form.addEventListener("change", syncQuebecQuestions);

  const fields = [...form.elements].filter(
    (e) => e.name && !["submit", "button", "reset", "file"].includes(e.type),
  );
  const capture = () => {
    const values = {};
    for (const e of fields) {
      if (e.name.startsWith("qc_") && e.disabled) continue;
      if (e.type === "radio") {
        if (e.checked) values[e.name] = e.value;
      } else if (e.type === "checkbox") {
        if (e.name.endsWith("[]")) {
          if (!values[e.name]) values[e.name] = [];
          if (e.checked) values[e.name].push(e.value);
        } else values[e.name] = e.checked;
      } else if (e.tagName === "SELECT" && e.multiple)
        values[e.name] = [...e.selectedOptions].map((o) => o.value);
      else values[e.name] = e.value;
    }
    if (profile?.ircc_application_category || profile?.ircc_application_type) {
      values._madic_profile_ircc = {
        category: profile.ircc_application_category || "",
        type: profile.ircc_application_type || "",
      };
    }
    values._madic_current_step = Number(form.dataset.madicCurrentStep || 0);
    return values;
  };
  const restore = (values) => {
    for (const e of fields) {
      if (!(e.name in values)) continue;
      const v = values[e.name];
      if (e.type === "radio") e.checked = e.value === v;
      else if (e.type === "checkbox")
        e.checked = Array.isArray(v) ? v.includes(e.value) : Boolean(v);
      else if (e.tagName === "SELECT" && e.multiple)
        [...e.options].forEach((o) => {
          o.selected = Array.isArray(v) && v.includes(o.value);
        });
      else e.value = v ?? "";
      e.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };
  if (guest) {
    try {
      const answers = await guest.read("intake");
      if (answers) restore(answers);
      fillFromProfile(true);
    } catch {
      guest.showError();
    } finally {
      fields.forEach((field) => {
        field.disabled = true;
      });
      form.querySelectorAll('[type="submit"]').forEach((button) => {
        button.hidden = true;
      });
    }
    return;
  }
  let saveInProgress = Promise.resolve();
  let autosaveTimer;
  let loadingComplete = false;
  let lastSavedSnapshot = "";
  const queueSave = (state) => {
    const task = saveInProgress.catch(() => {}).then(() => save(state));
    saveInProgress = task;
    return task;
  };
  function scheduleAutosave() {
    if (!loadingComplete) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      const snapshot = JSON.stringify(capture());
      if (snapshot === lastSavedSnapshot) return;
      try {
        await queueSave("draft");
        lastSavedSnapshot = snapshot;
      } catch (err) {
        message("Enregistrement automatique impossible : " + err.message, true);
      }
    }, 900);
  }
  form.addEventListener("input", scheduleAutosave);
  form.addEventListener("change", scheduleAutosave);
  form.addEventListener("madic:step-change", scheduleAutosave);
  async function save(state) {
    const { error } = await db.from("madic_client_intake").upsert(
      {
        user_id: user.id,
        answers: capture(),
        status: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    await updateProfileFromForm();
    message(
      state === "submitted"
        ? "Formulaire soumis et enregistré dans votre espace sécurisé."
        : "Brouillon enregistré dans Supabase.",
    );
  }
  let restoredStep = 0;
  try {
    const { data, error } = await db
      .from("madic_client_intake")
      .select("answers,status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (data?.answers) {
      restore(data.answers);
      restoredStep = Number(data.answers._madic_current_step) || 0;
      message(
        data.status === "submitted"
          ? "Vos réponses précédentes ont été chargées (formulaire déjà soumis)."
          : "Votre brouillon précédent a été chargé.",
      );
    }
    // Le profil actuel fait foi pour les données communes : synchronisation dans les deux sens.
    fillFromProfile(true);
    form.elements
      .namedItem("date_naissance")
      ?.dispatchEvent(new Event("change", { bubbles: true }));
  } catch (e) {
    message("Impossible de charger les réponses : " + e.message, true);
  }
  // Restaurer l'etape apres le chargement du brouillon et du profil.
  // L'evenement est emis apres l'initialisation synchrone du script de navigation.
  if (typeof restoredStep !== "undefined") {
    form.dispatchEvent(
      new CustomEvent("madic:restore-step", { detail: { step: restoredStep } }),
    );
  }
  loadingComplete = true;
  lastSavedSnapshot = JSON.stringify(capture());
  // La confirmation n'est jamais affichée avant le succès de la sauvegarde distante.
  const confirmation = document.getElementById("madic-submit-modal");
  const showConfirmation = () => {
    if (!confirmation) return;
    confirmation.hidden = false;
    document.body.style.overflow = "hidden";
    document.getElementById("madic-next-step")?.focus();
  };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      clearTimeout(autosaveTimer);
      await queueSave("submitted");
      lastSavedSnapshot = JSON.stringify(capture());
      showConfirmation();
    } catch (err) {
      message("Envoi impossible : " + err.message, true);
    } finally {
      submit.disabled = false;
    }
  });
})();

/* SOURCE: assets/madic-navigation-ciblee.js */
/* Navigation uniquement : ne modifie ni les champs ni la logique Supabase */
(() => {
  "use strict";
  const form = document.getElementById("madic-intake-form");
  if (!form) return;
  const steps = [...form.querySelectorAll("fieldset")];
  if (!steps.length) return;
  const prev = document.getElementById("madic-step-prev"),
    next = document.getElementById("madic-step-next");
  const label = document.getElementById("madic-step-label"),
    count = document.getElementById("madic-step-count"),
    fill = document.getElementById("madic-progress-fill");
  const last = steps[steps.length - 1];
  /* Le consentement, la ville et le bouton Soumettre restent visibles à la dernière étape. */
  const extras = [
    ...form.querySelectorAll(".madic-signature-place,.txt-right"),
  ];
  let current = 0;
  /* L'etape courante est partagee avec la sauvegarde Supabase. */
  form.addEventListener("madic:restore-step", (e) =>
    show(Number(e.detail?.step) || 0),
  );
  function show(i) {
    current = Math.max(0, Math.min(i, steps.length - 1));
    steps.forEach((s, k) => {
      s.classList.toggle("madic-step-inactive", k !== current);
    });
    extras.forEach((el) =>
      el.classList.toggle("madic-step-inactive", current !== steps.length - 1),
    );
    prev.hidden = current === 0;
    next.hidden = current === steps.length - 1;
    label.textContent =
      steps[current]
        .querySelector("legend")
        ?.textContent.trim()
        .replace(/\s+/g, " ") || `Section ${current + 1}`;
    count.textContent = `${current + 1} / ${steps.length}`;
    fill.style.width = `${(100 * (current + 1)) / steps.length}%`;
    form.dataset.madicCurrentStep = String(current);
    form.dispatchEvent(
      new CustomEvent("madic:step-change", { detail: { step: current } }),
    );
    document
      .querySelector(".madic-steps")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function validate(i) {
    for (const field of steps[i].querySelectorAll("input,select,textarea")) {
      if (field.disabled || field.type === "hidden") continue;
      if (!field.checkValidity()) {
        field.reportValidity();
        field.focus();
        return false;
      }
    }
    return true;
  }
  next?.addEventListener("click", () => {
    if (validate(current)) show(current + 1);
  });
  prev?.addEventListener("click", () => show(current - 1));
  /* Pour les champs invalides d'autres étapes, les rendre visibles avant soumission. */
  form.addEventListener(
    "click",
    (e) => {
      if (!e.target.closest('[type="submit"]')) return;
      for (let i = 0; i < steps.length; i++) {
        if (!validate(i)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          show(i);
          const invalid = steps[i].querySelector(":invalid");
          invalid?.focus();
          return;
        }
      }
    },
    true,
  );
  show(0);
})();

/* SOURCE: inline HTML */

(() => {
  const form = document.getElementById("madic-intake-form");
  if (!form) return;
  const groups = [
    {
      question: "question_lang_fr",
      fields: [
        "expression_orale",
        "comprehension_orale",
        "comprehension_ecrite",
        "expression_ecrite",
      ],
    },
    {
      question: "question_lang_en",
      fields: ["speaking", "listening", "reading", "writing"],
    },
  ];
  function refresh(group) {
    const question = document.getElementById(group.question);
    if (!question) return;
    const enabled = Boolean(question.value && question.value !== "aucun");
    group.fields.forEach((id) => {
      const field = document.getElementById(id);
      if (!field) return;
      field.disabled = !enabled;
      field.required = enabled;
      field.setAttribute("aria-disabled", String(!enabled));
    });
  }
  groups.forEach((group) => {
    const question = document.getElementById(group.question);
    if (!question) return;
    question.addEventListener("change", () => refresh(group));
    refresh(group);
  });
  // Le chargement du brouillon Supabase restaure les questions par des evenements change.
})();

/* SOURCE: inline HTML */

(() => {
  const dob = document.getElementById("date_naissance");
  const age = document.getElementById("madic_age_calcule");
  const count = document.getElementById("nbr_enfant");
  const children = [1, 2, 3, 4].map((n) =>
    document.getElementById("age_enfant_" + n),
  );
  if (!dob || !age || !count || children.some((el) => !el)) return;

  function updateAge() {
    age.value = "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob.value)) return;
    const [year, month, day] = dob.value.split("-").map(Number);
    const birth = new Date(year, month - 1, day);
    if (
      birth.getFullYear() !== year ||
      birth.getMonth() !== month - 1 ||
      birth.getDate() !== day
    )
      return;
    const today = new Date();
    if (birth > today) return;
    let years = today.getFullYear() - year;
    if (
      today.getMonth() + 1 < month ||
      (today.getMonth() + 1 === month && today.getDate() < day)
    )
      years--;
    age.value = String(years);
  }

  function updateChildren() {
    const raw = count.value.trim();
    const number = raw === "" ? 0 : Number(raw);
    const active = Number.isInteger(number)
      ? Math.max(0, Math.min(4, number))
      : 0;
    children.forEach((el, index) => {
      const enabled = index < active;
      if (!enabled && !el.disabled) el.value = "";
      el.disabled = !enabled;
      el.required = enabled;
    });
  }

  dob.addEventListener("input", updateAge);
  dob.addEventListener("change", updateAge);
  count.addEventListener("input", updateChildren);
  count.addEventListener("change", updateChildren);
  updateAge();
  updateChildren();
})();

/* SOURCE: inline HTML */

(() => {
  const temporary = document.getElementById("residence_temporaire");
  const permanent = document.getElementById("residence_permanente");
  if (!temporary || !permanent) return;

  const isSelected = (element) =>
    element.value !== "" && element.value !== "aucun";
  const setAvailability = (element, disabled) => {
    element.disabled = disabled;
    element.required = !disabled;
    element.setAttribute("aria-disabled", String(disabled));
  };
  const update = (changed) => {
    const tempChosen = isSelected(temporary);
    const permChosen = isSelected(permanent);
    // Si un brouillon contient deux choix, le dernier champ modifié prévaut.
    if (tempChosen && permChosen) {
      if (changed === permanent) temporary.value = "";
      else permanent.value = "";
    }
    setAvailability(permanent, isSelected(temporary));
    setAvailability(temporary, isSelected(permanent));
  };
  temporary.addEventListener("change", () => update(temporary));
  permanent.addEventListener("change", () => update(permanent));
  update(temporary);
})();

/* SOURCE: inline HTML */

(() => {
  const dialog = document.getElementById("madic-residence-help-dialog");
  const panel = dialog?.querySelector(".madic-residence-help-panel");
  const closeButton = document.getElementById("madic-residence-help-close");
  if (!dialog || !panel || !closeButton) return;
  let opener = null;
  const translations = {
    fr: {
      title: "Information importante - Choix du type de résidence",
      text: "Vous devez choisir un seul type de résidence par dossier : résidence temporaire ou résidence permanente. Si vous souhaitez entreprendre des démarches pour les deux types de résidence, vous devez ouvrir un dossier distinct pour chaque demande auprès de votre consultant en immigration.",
      close: "Fermer",
      label: "Information sur le choix de résidence",
    },
    en: {
      title: "Important information - Choosing a residence type",
      text: "You must select only one type of residence per file: temporary residence or permanent residence. If you wish to apply for both types of residence, you must open a separate file for each application with your immigration consultant.",
      close: "Close",
      label: "Information about residence types",
    },
  };
  const language = () =>
    document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "fr";
  const updateLanguage = () => {
    const t = translations[language()];
    document.getElementById("madic-residence-help-title").textContent = t.title;
    document.getElementById("madic-residence-help-text").textContent = t.text;
    closeButton.textContent = t.close;
    document
      .querySelectorAll(".madic-residence-help")
      .forEach((b) => b.setAttribute("aria-label", t.label));
  };
  const close = () => {
    dialog.hidden = true;
    opener?.focus();
  };
  document.querySelectorAll(".madic-residence-help").forEach((button) =>
    button.addEventListener("click", () => {
      opener = button;
      updateLanguage();
      dialog.hidden = false;
      closeButton.focus();
    }),
  );
  closeButton.addEventListener("click", close);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });
  document.addEventListener("keydown", (e) => {
    if (dialog.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      closeButton.focus();
    }
  });
  new MutationObserver(updateLanguage).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  updateLanguage();
})();

/* SOURCE: assets/madic-client-sidebar.js */
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

/* SOURCE: inline HTML */

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
    "Cabinet CRIC": "RCIC firm",
    Conversations: "Conversations",
    Actualiser: "Refresh",
    "Choisissez une conversation": "Choose a conversation",
    "Les conversations sont ouvertes par votre consultant.":
      "Conversations are opened by your consultant.",
    "Votre réponse": "Your reply",
    "Envoyer ma réponse": "Send my reply",
    "Écrivez votre message…": "Write your message…",
    "Mes rendez-vous et consultations": "My appointments and consultations",
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
  function translate() {
    const map = lang === "en" ? dict : reverse;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(n) {
          return n.parentElement &&
            n.parentElement.closest(
              'script,style,textarea,option,[contenteditable="true"]',
            )
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        },
      },
    );
    let node;
    while ((node = walker.nextNode())) {
      const raw = node.nodeValue,
        word = raw.trim();
      if (Object.prototype.hasOwnProperty.call(map, word))
        node.nodeValue = raw.replace(word, map[word]);
    }
    for (const el of document.querySelectorAll(
      "[placeholder],[aria-label],[title]",
    )) {
      for (const a of ["placeholder", "aria-label", "title"]) {
        const v = el.getAttribute(a);
        if (v && Object.prototype.hasOwnProperty.call(map, v))
          el.setAttribute(a, map[v]);
      }
    }
  }
  function apply() {
    const pageLanguage = lang === "en" ? "en-CA" : "fr-CA";
    if (document.documentElement.lang !== pageLanguage)
      document.documentElement.lang = pageLanguage;
    translate();
    for (const code of ["fr", "en"])
      buttons[code].setAttribute("aria-pressed", String(code === lang));
  }
  apply();
})();

/* SOURCE: inline HTML */

/* Déconnexion du portail client. */
(function () {
  "use strict";
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

/* MADIC form: self-contained key-based FR/EN translations. */
(function () {
  "use strict";
  const en = {
    "form.declaration":
      "I acknowledge that any false statement or concealment of a material fact in this form may lead to an incorrect assessment of my case. If my application is submitted to the Government of Canada with false or incomplete information, this may affect my application and my admissibility to Canada.",
    "form.clientInformation": "Client information",
    "form.firstName": "First name:",
    "form.lastName": "Last name:",
    "form.birthDate": "Date of birth:",
    "form.gender": "Gender:",
    "form.selectGender": "Select your gender!",
    "form.male": "Male",
    "form.female": "Female",
    "form.birthCountry": "Country of birth:",
    "form.selectBirthCountry": "Select your country of birth!",
    "form.nationalityCountry": "Country of citizenship:",
    "form.selectNationalityCountry": "Select your country of citizenship!",
    "form.residenceCountry": "Country of residence:",
    "form.selectResidenceCountry": "Select your country of residence!",
    "form.maritalStatus": "Current marital status:",
    "form.selectMaritalStatus": "Select your marital status!",
    "form.single": "Single",
    "form.married": "Married",
    "form.commonLaw": "Common-law partner",
    "form.childrenUnder22": "How many children under 22 do you have?",
    "form.child1Age": "Age of child 1:",
    "form.selectAge": "Select an age!",
    "form.none": "None",
    "form.child2Age": "Age of child 2:",
    "form.child3Age": "Age of child 3:",
    "form.child4Age": "Age of child 4:",
    "form.phone": "Your phone number",
    "form.email": "Your email address",
    "form.residentialAddress": "Residential address",
    "form.apartmentNumber": "Apartment/unit number:",
    "form.streetNumber": "Street number:",
    "form.city": "City:",
    "form.postalCode": "Postal code:",
    "form.province": "Province:",
    "form.country": "Country:",
    "form.selectCountry": "Select your country!",
    "form.languages": "Language proficiency",
    "form.frenchLevel": "French proficiency:",
    "form.selectLevel": "Select your level!",
    "form.excellent": "Excellent",
    "form.intermediate": "Intermediate",
    "form.basic": "Basic",
    "form.englishLevel": "English proficiency:",
    "form.advanced": "Advanced",
    "form.frenchTestQuestion":
      "Have you had your French language proficiency assessed by an authorized testing organization?",
    "form.selectLanguageTest": "Select your language test!",
    "form.noLanguageTest": "No, I have not taken any language tests yet",
    "form.tefCanada": "Yes, I have taken the TEF Canada test",
    "form.tcfCanada": "Yes, I have taken the TCF Canada test",
    "form.tefaq": "Yes, I have taken the TEFaQ test",
    "form.tcfq": "Yes, I have taken the TCFQ test",
    "form.delf": "Yes, I have taken the DELF test",
    "form.dalf": "Yes, I have taken the DALF test",
    "form.englishTestQuestion":
      "Have you had your English language proficiency assessed by an authorized testing organization?",
    "form.ielts": "Yes, I have taken the IELTS test",
    "form.celpip": "Yes, I have taken the CELPIP test",
    "form.frenchScores": "If yes, what are your French language test scores?",
    "form.speaking": "Speaking:",
    "form.listening": "Listening:",
    "form.reading": "Reading:",
    "form.writing": "Writing:",
    "form.englishScores": "If yes, what are your English language test scores?",
    "form.education": "Education",
    "form.highestEducation": "Your highest level of education:",
    "form.bachelor": "Bachelor's degree",
    "form.certificate": "Certificate",
    "form.licence": "Bachelor's degree (licence)",
    "form.master": "Master's degree",
    "form.phd": "Doctorate (PhD)",
    "form.doctor": "Physician",
    "form.pharmacist": "Pharmacist",
    "form.yearsEducation": "Number of years of education:",
    "form.fieldOfStudy": "Your field of study or specialization:",
    "form.spouseEducationLevel": "Your spouse's highest level of education:",
    "form.spouseYearsEducation": "Your spouse's years of education:",
    "form.spouseFieldOfStudy":
      "Your spouse's field of study or specialization:",
    "form.employment": "Work experience / Employment",
    "form.currentEmployment": "Your current employment:",
    "form.yearsExperience": "Years of work experience:",
    "form.selectYearsExperience": "Select years of experience!",
    "form.jobTitle": "Your job title:",
    "form.jobDuties": "Your current job duties:",
    "form.spouseCurrentEmployment": "Your spouse's current employment:",
    "form.spouseYearsExperience": "Your spouse's years of work experience:",
    "form.selectSpouseYearsExperience":
      "Select your spouse's years of experience!",
    "form.spouseJobTitle": "Your spouse's job title:",
    "form.spouseJobDuties": "Your spouse's current job duties:",
    "form.immigrationProject": "Immigration plans",
    "form.familyCanada": "Do you have family in Canada?",
    "form.selectFamily": "Select your family relationship in Canada!",
    "form.noFamilyCanada": "No, I do not have family in Canada",
    "form.siblingCanada": "Yes, I have a brother or sister over 18 in Canada",
    "form.parentCanada": "Yes, my father or mother lives in Canada",
    "form.childCanada": "Yes, my son or daughter lives in Canada",
    "form.grandchildCanada":
      "Yes, my grandson or granddaughter lives in Canada",
    "form.destinationProvinceQuestion":
      "Which province would you like to settle in?",
    "form.selectProvince": "Select a Canadian province!",
    "form.britishColumbia": "British Columbia",
    "form.newBrunswick": "New Brunswick",
    "form.novaScotia": "Nova Scotia",
    "form.pei": "Prince Edward Island",
    "form.newfoundland": "Newfoundland and Labrador",
    "form.jobOffer": "Do you have a job offer in Canada?",
    "form.selectJobOffer": "Select a job-offer response!",
    "form.noJobOffer": "No, I do not have a job offer in Canada",
    "form.yesJobOffer": "Yes, I have a job offer in Canada",
    "form.temporaryResidenceQuestion":
      "Do you wish to come to Canada as a temporary resident?",
    "form.selectTemporaryResidence":
      "Select your temporary residence category!",
    "form.visitor": "Visitor",
    "form.businessVisitor": "Business visitor",
    "form.superVisa": "Visitor - Super Visa",
    "form.student": "Student",
    "form.temporaryWorker": "Temporary worker",
    "form.permanentResidenceQuestion":
      "Do you wish to settle in Canada as a permanent resident?",
    "form.selectPermanentResidence":
      "Select your permanent residence category!",
    "form.economicImmigration": "Economic immigration",
    "form.spouseSponsorship": "Spousal sponsorship",
    "form.spouseChildrenSponsorship":
      "Sponsorship - Spouse with dependent children",
    "form.parentsSponsorship": "Sponsorship - Parents and grandparents",
    "form.orphanSiblingSponsorship": "Sponsorship - Orphaned sibling under 18",
    "form.adoptedChildSponsorship": "Sponsorship - Adopted child",
    "form.groupFive": "Sponsorship - Group of five",
    "form.humanitarian": "Humanitarian considerations",
    "form.refugee": "Refugee or asylum claimant",
    "form.travelHistory": "Previous travel",
    "form.previousApplication":
      "Have you previously applied for a visa, study permit, work permit or other Canadian immigration authorization?",
    "form.no": "No",
    "form.yes": "Yes",
    "form.travelEuropeUsa":
      "Have you ever travelled to Europe or the United States?",
    "form.previousRefusal":
      "Have you ever been refused a visa or electronic travel authorization (eTA)?",
    "form.inadmissibility":
      "Inadmissibility (please explain if you answer yes)",
    "form.criminalOffence":
      "Have you ever been convicted of a criminal offence?",
    "form.healthQuestion":
      "Have you ever travelled to Europe or the United States?",
    "form.explanation":
      "Explanation if you answered yes to either of the two questions above",
    "form.importantInformation": "Important information",
    "form.consent":
      "I understand that MAD Immigration Canadienne (MADIC) Inc. collects my information for the assessment of my immigration request and I consent to its use for this purpose.",
    "form.age1": "1 year",
    "form.age2": "2 years",
    "form.age3": "3 years",
    "form.age4": "4 years",
    "form.age5": "5 years",
    "form.age6": "6 years",
    "form.age7": "7 years",
    "form.age8": "8 years",
    "form.age9": "9 years",
    "form.age10": "10 years",
    "form.age11": "11 years",
    "form.age12": "12 years",
    "form.age13": "13 years",
    "form.age14": "14 years",
    "form.age15": "15 years",
    "form.age16": "16 years",
    "form.age17": "17 years",
    "form.age18": "18 years",
    "form.age19": "19 years",
    "form.age20": "20 years",
    "form.age21": "21 years",
    "form.firstNamePlaceholder": "Enter your first name",
    "form.lastNamePlaceholder": "Enter your last name",
    "form.apartmentPlaceholder": "Enter your apartment/unit number",
    "form.streetPlaceholder": "Enter your street number",
    "form.cityPlaceholder": "Enter your city",
    "form.postalCodePlaceholder": "Enter your postal code",
    "form.provincePlaceholder": "Enter your province",
    "form.yearsEducationPlaceholder": "Enter your number of years of education",
    "form.fieldOfStudyPlaceholder":
      "Enter your field of study or specialization",
    "form.spouseYearsEducationPlaceholder":
      "Enter your spouse's years of education",
    "form.spouseFieldOfStudyPlaceholder":
      "Enter your spouse's field of study or specialization",
    "form.currentEmploymentPlaceholder": "Enter your current employment",
    "form.jobTitlePlaceholder": "Enter your job title",
    "form.jobDutiesPlaceholder": "Enter your current job duties",
    "form.spouseCurrentEmploymentPlaceholder":
      "Enter your spouse's current employment",
    "form.spouseJobTitlePlaceholder": "Enter your spouse's job title",
    "form.spouseJobDutiesPlaceholder": "Enter your spouse's current job duties",
    "form.explanationPlaceholder": "Please provide your explanation",
    "form.clientSpace": "Client space",
    "form.calculatedAge": "Age:",
    "form.streetName": "Street name:",
    "form.streetNamePlaceholder": "Street name",
    "form.signaturePlace": "Contract signing location (city):",
    "form.signaturePlacePlaceholder": "City where the contract will be signed",
    "form.signatureHelp":
      "This information will be used to prefill the signing location in your contracts. You can confirm it before signing.",
    "form.submit": "Submit",
    "form.profileIrcc": "Plans recorded in your profile",
    "qc.heading": "Additional questions - Quebec",
    "qc.hint":
      "Enter work experience in full-time equivalent months. For French, use the Quebec scale (0 to 12) based on an accepted test or document. Leave unknown answers blank.",
    "qc.residence": "Where do you currently live?",
    "qc.residence.qc": "In Quebec",
    "qc.residence.canada": "Elsewhere in Canada",
    "qc.residence.abroad": "Outside Canada",
    "qc.status": "If you live in Quebec, what is your current status?",
    "qc.status.valid": "Valid legal status",
    "qc.status.none": "No legal status",
    "qc.intent": "Do you intend to live and work in Quebec permanently?",
    "qc.intent.yes": "Yes",
    "qc.intent.no": "No",
    "qc.noc": "NOC code for the primary occupation, if known (5 digits)",
    "qc.regulated": "Is your intended occupation regulated in Quebec?",
    "qc.regulated.yes": "Yes",
    "qc.regulated.no": "No",
    "qc.regulated.unknown": "I don’t know",
    "qc.recognition": "Professional recognition in Quebec",
    "qc.recognition.authorized": "Authorization to practise",
    "qc.recognition.equivalence":
      "Partial or full recognition issued within the past five years",
    "qc.recognition.pending": "In progress or no documentation",
    "qc.exception":
      "Do you have recognized evidence of exceptional achievement or an opinion from a MIFI partner?",
    "qc.exception.yes": "Yes",
    "qc.exception.no": "No",
    "qc.exception.unknown": "I don’t know",
    "qc.work":
      "Months of paid work in your primary occupation over the past 5 years",
    "qc.qcwork": "Of those, months in this occupation in Quebec",
    "qc.workTotal":
      "Total months of work over the past 5 years across all occupations",
    "qc.workQcTotal":
      "Of those, months of work in Quebec across all occupations",
    "qc.validatedOffer": "Job offer in this occupation validated by MIFI",
    "qc.validatedOffer.none": "No validated offer",
    "qc.validatedOffer.cmm": "Within the Montréal Metropolitan Community",
    "qc.validatedOffer.outside":
      "In Quebec outside the Montréal Metropolitan Community",
    "qc.validatedOffer.unknown": "Validation or location to be confirmed",
    "qc.degree":
      "Highest qualification type for the Quebec assessment, if known",
    "qc.degree.secondary": "General secondary school",
    "qc.degree.vocational":
      "Secondary vocational qualification comparable to a DVS or AVS",
    "qc.degree.college": "College qualification comparable to an ACS or DCS",
    "qc.degree.bachelor": "Bachelor’s degree or equivalent",
    "qc.degree.master": "Master’s degree or equivalent",
    "qc.degree.doctorate": "Doctorate",
    "qc.degree.none": "No qualification",
    "qc.degree.other": "Other qualification or type to be confirmed",
    "qc.degreeplace": "Where did you obtain this qualification?",
    "qc.degreeplace.qc": "In Quebec",
    "qc.degreeplace.elsewhere": "Outside Quebec",
    "qc.fulltime": "Was it a program of at least one year of full-time study?",
    "qc.fulltime.yes": "Yes",
    "qc.fulltime.no": "No",
    "qc.hours":
      "Length of the vocational or college program in hours, if known",
    "qc.credits": "Number of university credits, if known",
    "qc.graduation": "Date the qualification was awarded",
    "qc.oralListen": "French - listening",
    "qc.oralSpeak": "French - speaking",
    "qc.writtenRead": "French - reading",
    "qc.writtenWrite": "French - writing",
    "qc.spouse": "Will your spouse or partner accompany you?",
    "qc.spouse.yes": "Yes",
    "qc.spouse.no": "No",
    "qc.spouseListen": "Spouse or partner’s French - listening",
    "qc.spouseSpeak": "Spouse or partner’s French - speaking",
    "qc.spouseRead": "Spouse or partner’s French - reading",
    "qc.spouseWrite": "Spouse or partner’s French - writing",
    "qc.spouseAge": "Age of spouse or partner",
    "qc.spouseQcWork":
      "Spouse or partner’s months of work in Quebec over the past 5 years",
    "qc.finance":
      "Can you support your family for the first three months under the applicable scale?",
    "qc.finance.yes": "Yes",
    "qc.finance.no": "No",
    "qc.finance.unknown": "I don’t know",
    "qc.scholarship":
      "Do you have an outstanding scholarship-related return obligation?",
    "qc.scholarship.none": "No, or requirement already met",
    "qc.scholarship.unmet": "Yes",
    "qc.excluded":
      "Is the intended job in an excluded sector or in a business you control?",
    "qc.excluded.yes": "Yes",
    "qc.excluded.no": "No",
    "qc.excluded.unknown": "I don’t know",
    "qc.outsideCmm":
      "Do you currently live in Quebec outside the Montréal Metropolitan Community?",
    "qc.outsideCmm.yes": "Yes",
    "qc.outsideCmm.no": "No",
    "qc.outsideResidenceMonths":
      "How many months have you lived outside this metropolitan area?",
    "qc.regionalFamily":
      "Do you have a close relative in the Quebec region where you plan to settle, outside the Montréal metropolitan area?",
    "qc.regionalFamily.yes": "Yes",
    "qc.regionalFamily.no": "No",
    "qc.regionalFamily.unknown": "I don’t know",
    "qc.arrimaScore": "Full Arrima score, only if already known",
    "qc.blank": "Select…",
  };
  const nodes = Array.from(
    document.querySelectorAll(
      "[data-i18n], [data-i18n-placeholder], [data-i18n-value]",
    ),
  );
  const originals = new WeakMap();
  nodes.forEach((el) => {
    originals.set(el, {
      html: el.innerHTML,
      placeholder: el.getAttribute("placeholder"),
      value: el.getAttribute("value"),
    });
  });
  function applyFormLanguage() {
    const english = document.documentElement.lang
      .toLowerCase()
      .startsWith("en");
    for (const line of document.querySelectorAll("[data-profile-label]")) {
      const value = line.dataset.profileLabel;
      line.textContent = english ? (profileIrccEnglish[value] ?? value) : value;
    }
    nodes.forEach((el) => {
      const original = originals.get(el);
      if (!original) return;
      const key = el.getAttribute("data-i18n");
      if (key && Object.prototype.hasOwnProperty.call(en, key)) {
        if (!english) {
          if (el.innerHTML !== original.html) el.innerHTML = original.html;
        } else {
          const text = en[key];
          // Keep required-field markers and any other nested markup intact.
          if (el.querySelector(".req")) {
            const first = Array.from(el.childNodes).find(
              (n) => n.nodeType === Node.TEXT_NODE,
            );
            if (first) first.nodeValue = text + " ";
          } else if (el.textContent !== text) {
            el.textContent = text;
          }
        }
      }
      const placeholderKey = el.getAttribute("data-i18n-placeholder");
      if (placeholderKey)
        el.setAttribute(
          "placeholder",
          english
            ? en[placeholderKey] || original.placeholder || ""
            : original.placeholder || "",
        );
      const valueKey = el.getAttribute("data-i18n-value");
      if (valueKey)
        el.setAttribute(
          "value",
          english ? en[valueKey] || original.value || "" : original.value || "",
        );
    });
  }
  // Apply after the existing form language switch has updated <html lang>.
  const observer = new MutationObserver(applyFormLanguage);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest(".madic-three-lang button"))
      queueMicrotask(applyFormLanguage);
  });
  applyFormLanguage();
})();

/* Rendre visible l’entrée de la page courante après la mise en place du menu. */
(function () {
  const nav = document.querySelector(".madic-side-nav > .madic-side-links");
  if (!nav) return;

  const defaultOrder = [
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
  let order = defaultOrder;
  try {
    const saved = JSON.parse(localStorage.getItem("madic-client-nav-order-v2"));
    if (Array.isArray(saved)) order = saved;
  } catch (_) {}
  const entries = new Map(
    Array.from(nav.children, (entry) => [entry.dataset.navKey, entry]),
  );
  for (const key of new Set([...order, ...defaultOrder])) {
    const entry = entries.get(key);
    if (entry) nav.appendChild(entry);
  }

  const route = (pathname) =>
    pathname.replace(/\/+$/, "").replace(/\.html$/i, "");
  const currentRoute = route(location.pathname);
  const mobile = window.matchMedia("(max-width: 800px)");
  const header = document.querySelector("body > .madic-client-header");
  let scheduled = false;

  const translateHeader = () => {
    const english = document.documentElement.lang.startsWith("en");
    header?.querySelectorAll("[data-client-header-fr]").forEach((element) => {
      const text = english
        ? element.dataset.clientHeaderEn
        : element.dataset.clientHeaderFr;
      if (element.textContent.trim() !== text) element.textContent = text;
    });
    const bell = header?.querySelector(".madic-hero-notifications");
    if (bell) {
      const label = english
        ? "Message notifications"
        : "Notifications de messagerie";
      bell.setAttribute("aria-label", label);
      bell.title = label;
    }
  };

  const update = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const links = Array.from(
        nav.querySelectorAll(".madic-nav-entry > a[href]"),
      );
      const current = links.find((link) => {
        const target = new URL(link.href);
        return (
          target.origin === location.origin &&
          route(target.pathname) === currentRoute
        );
      });
      if (!current) return;

      for (const link of links) {
        const active = link === current;
        link.classList.toggle("madic-nav-active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }

      if (
        !mobile.matches ||
        nav.closest(".madic-editing") ||
        nav.scrollWidth <= nav.clientWidth
      )
        return;

      const start = nav.getBoundingClientRect().left + nav.clientLeft;
      const end = start + nav.clientWidth;
      const item = current.getBoundingClientRect();
      if (item.left < start || item.right > end) {
        nav.scrollLeft += (item.left + item.right - start - end) / 2;
      }
    });
  };

  new MutationObserver(update).observe(nav, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["href"],
  });
  new MutationObserver(() => {
    translateHeader();
    update();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  new MutationObserver(update).observe(nav.closest(".madic-side-nav"), {
    attributes: true,
    attributeFilter: ["class"],
  });
  window.addEventListener("pageshow", update);
  window.addEventListener("resize", update);
  document.fonts?.ready.then(update);
  translateHeader();
  update();
})();

/* Mobile client navigation; existing account and language handlers retained. */
(function () {
  const init = () => {
    const header = document.querySelector("body > .madic-client-header"),
      drawer = document.querySelector(".madic-side-nav"),
      trigger = document.querySelector(".madic-client-phone-trigger"),
      close = document.querySelector(".madic-client-phone-close"),
      shade = document.querySelector(".madic-client-phone-shade"),
      account = document.querySelector(".madic-client-phone-account"),
      links = header?.querySelector(".toplinks"),
      search = document.querySelector(".madic-client-phone-search");
    if (!header || !drawer || !trigger || !close || !shade) return;
    const mobile = matchMedia("(max-width:900px)");
    function toggle(open) {
      open = !!open && mobile.matches;
      document.body.classList.toggle("madic-client-phone-open", open);
      trigger.setAttribute("aria-expanded", String(open));
      shade.hidden = !open;
      drawer.inert = mobile.matches && !open;
      if (open) close.focus();
    }
    trigger.addEventListener("click", () => toggle(true));
    close.addEventListener("click", () => {
      toggle(false);
      trigger.focus();
    });
    shade.addEventListener("click", () => toggle(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        toggle(false);
        links?.classList.remove("madic-client-account-open");
      }
    });
    mobile.addEventListener("change", () => toggle(false));
    drawer.addEventListener("click", (e) => {
      if (e.target.closest("a[href]")) toggle(false);
    });
    account?.addEventListener("click", () => {
      const open = links?.classList.toggle("madic-client-account-open");
      account.setAttribute("aria-expanded", String(!!open));
    });
    function lang() {
      const en = document.documentElement.lang.startsWith("en");
      close.setAttribute("aria-label", en ? "Close menu" : "Fermer le menu");
      search.querySelector("input").placeholder = en
        ? "Search your space..."
        : "Rechercher dans votre espace...";
      search.querySelector("button").textContent = en ? "Search" : "Rechercher";
      account.querySelector(".madic-client-account-label").textContent = en
        ? "My space"
        : "Mon espace";
      drawer.querySelector(".madic-side-brand strong").textContent = en
        ? "MADIC PORTAL"
        : "MADIC PORTAIL";
    }
    new MutationObserver(lang).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    lang();
    toggle(false);
    search.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = search.querySelector("input").value.trim().toLowerCase();
      if (!q) return;
      const a = [...drawer.querySelectorAll(".madic-side-links a[href]")].find(
        (a) => a.textContent.toLowerCase().includes(q),
      );
      if (a) location.href = a.href;
      else toggle(true);
    });
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
