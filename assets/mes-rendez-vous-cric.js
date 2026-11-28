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

/* Scripts autonomes : mes-rendez-vous-cric.html */

/* Source consolidee : madic-appointments-client(20261107-040956).js */
(async () => {
  "use strict";
  if (window.MADIC_GUEST_PORTAL) return;
  const isEnglish = () => {
    try {
      return (localStorage.getItem("madic_ui_language") || "fr") === "en";
    } catch (_) {
      return document.documentElement.lang.startsWith("en");
    }
  };
  const L = (fr, en) => (isEnglish() ? en : fr);
  const refreshTranslation = () => {
    if (typeof window.madicTranslateAppointments === "function")
      window.madicTranslateAppointments();
  };
  const $ = (id) => document.getElementById(id),
    notice = (t) => {
      $("rdvNotice").textContent = t;
      refreshTranslation();
    };
  if (typeof window.getMadicSupabase !== "function")
    return notice(
      L(
        "Configuration Supabase manquante.",
        "Supabase configuration is missing.",
      ),
    );
  const db = window.getMadicSupabase();
  let spaces = [],
    slots = [];
  let weekOffset = 0;
  let durationMinutes = 60;
  function durationPicker() {
    if ($("rdvDurationPicker")) return;
    const host = $("rdvCalendar");
    if (!host) return;
    const wrap = document.createElement("div");
    wrap.id = "rdvDurationPicker";

    const label = document.createElement("label");
    label.textContent = L("Durée du rendez-vous : ", "Appointment duration: ");
    label.htmlFor = "rdvDuration";
    const select = document.createElement("select");
    select.id = "rdvDuration";
    select.add(new Option(L("1 heure", "1 hour"), "60"));
    select.add(new Option(L("2 heures", "2 hours"), "120"));
    select.value = String(durationMinutes);
    select.onchange = () => {
      durationMinutes = Number(select.value);
      load().catch((e) => notice(e.message));
    };
    wrap.append(label, select);
    host.parentNode.insertBefore(wrap, host);
  }
  async function bookPeriod(s) {
    if (
      !confirm(
        L(
          `Demander un rendez-vous du ${date(s.starts_at)} au ${date(s.ends_at)} ?`,
          `Request an appointment from ${date(s.starts_at)} to ${date(s.ends_at)}?`,
        ),
      )
    )
      return;
    const { error } = await db.rpc("madic_rdv_book_period", {
      p_slot_id: s.id,
      p_start: s.starts_at,
      p_end: s.ends_at,
    });
    if (error) throw error;
    notice(
      L(
        "Demande envoyée au consultant, en attente de confirmation.",
        "Request sent to your consultant, pending confirmation.",
      ),
    );
  }
  const date = (t) =>
    new Intl.DateTimeFormat(isEnglish() ? "en-CA" : "fr-CA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Toronto",
    }).format(new Date(t));
  const td = (r, t) => {
    const c = r.insertCell();
    c.textContent = t ?? "-";
    return c;
  };
  const mode = {
    video: "Visioconférence",
    phone: "Téléphone",
    in_person: "En personne",
  };
  const modeEn = {
    video: "Video conference",
    phone: "Phone",
    in_person: "In person",
  };
  const statusEn = {
    requested: "Pending confirmation",
    confirmed: "Confirmed",
    declined: "Declined",
    cancelled: "Cancelled",
  };
  const notificationLabelsEn = {
    requested: "New appointment request",
    confirmed: "Your appointment has been confirmed",
    declined: "Your appointment request was declined",
    cancelled: "An appointment was cancelled",
  };
  const status = {
    requested: "En attente de confirmation",
    confirmed: "Confirmé",
    declined: "Refusé",
    cancelled: "Annulé",
  };
  const action = (name, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "secondary";
    b.textContent = name;
    b.onclick = async () => {
      b.disabled = true;
      try {
        await fn();
        await load();
      } catch (e) {
        notice(e.message);
      } finally {
        b.disabled = false;
      }
    };
    return b;
  };
  function renderCalendar() {
    const container = $("rdvCalendar");
    if (!container) return;
    container.replaceChildren();
    // Week boundaries use Montreal civil dates, not the browser's local timezone.
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date()).map((x) => [x.type, x.value]),
    );
    const today = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day));
    const monday = new Date(today);
    monday.setUTCDate(
      monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + weekOffset * 7,
    );
    const last = new Date(monday);
    last.setUTCDate(last.getUTCDate() + 6);
    const key = (d) => d.toISOString().slice(0, 10);
    const label = (d) =>
      new Intl.DateTimeFormat(isEnglish() ? "en-CA" : "fr-CA", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(d);
    $("rdvWeekLabel").textContent = `${label(monday)} - ${label(last)}`;
    $("rdvPrevWeek").disabled = weekOffset <= 0;
    refreshTranslation();
    const dateKey = (iso) => {
      const p = Object.fromEntries(
        fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
      );
      return `${p.year}-${p.month}-${p.day}`;
    };
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setUTCDate(day.getUTCDate() + i);
      const column = document.createElement("section");
      column.className =
        "madic-rdv-day" + (key(day) === key(today) ? " madic-rdv-today" : "");
      const heading = document.createElement("h3");
      heading.textContent = label(day);
      column.append(heading);
      const daySlots = slots.filter((s) => dateKey(s.starts_at) === key(day));
      if (!daySlots.length) {
        const empty = document.createElement("p");
        empty.className = "madic-rdv-muted";
        empty.textContent = L("Aucun créneau", "No available slots");
        column.append(empty);
      }
      for (const s of daySlots) {
        const time = new Intl.DateTimeFormat(isEnglish() ? "en-CA" : "fr-CA", {
          timeZone: "America/Toronto",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date(s.starts_at));
        const b = action(
          `${time} · ${durationMinutes / 60} h · ${L("Demander", "Request")}`,
          async () => {
            await bookPeriod(s);
          },
        );
        b.classList.add("madic-rdv-slot-button");
        b.title = L(mode[s.mode] || s.mode, modeEn[s.mode] || s.mode);
        column.append(b);
      }
      container.append(column);
    }
  }

  const notificationLabels = {
    requested: "Nouvelle demande de rendez-vous",
    confirmed: "Votre rendez-vous a été confirmé",
    declined: "Votre demande de rendez-vous a été refusée",
    cancelled: "Un rendez-vous a été annulé",
  };
  function setupNotifications() {
    if ($("rdvNotifications")) return;
    const section = document.createElement("section");
    section.className = "panel madic-rdv-notifications";
    section.id = "rdvNotifications";
    const heading = document.createElement("h2");
    heading.textContent = L(
      "Notifications de rendez-vous",
      "Appointment notifications",
    );
    const summary = document.createElement("p");
    summary.id = "rdvNotificationSummary";
    summary.className = "madic-rdv-muted";
    const list = document.createElement("div");
    list.id = "rdvNotificationList";
    section.append(heading, summary, list);
    $("rdvApp").prepend(section);
  }
  async function loadNotifications(currentSpaceId) {
    const list = $("rdvNotificationList");
    if (!list) return;
    const { data, error } = await db
      .from("madic_rdv_notifications")
      .select("id,event_type,created_at,read_at")
      .eq("space_id", currentSpaceId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      $("rdvNotificationSummary").textContent =
        L("Notifications indisponibles: ", "Notifications unavailable: ") +
        error.message;
      return;
    }
    list.replaceChildren();
    const unread = (data || []).filter((n) => !n.read_at).length;
    $("rdvNotificationSummary").textContent = unread
      ? L(
          `${unread} notification(s) non lue(s).`,
          `${unread} unread notification(s).`,
        )
      : L("Aucune notification non lue.", "No unread notifications.");
    if (!data?.length) {
      const p = document.createElement("p");
      p.textContent = L(
        "Aucune notification pour le moment.",
        "No notifications at this time.",
      );
      list.append(p);
    }
    for (const n of data || []) {
      const line = document.createElement("div");
      line.className =
        "madic-rdv-notification" +
        (n.read_at ? "" : " madic-rdv-notification-unread");
      const info = document.createElement("span");
      info.textContent = `${L(notificationLabels[n.event_type] || n.event_type, notificationLabelsEn[n.event_type] || n.event_type)} · ${date(n.created_at)}`;
      if (!n.read_at) info.classList.add("madic-rdv-notification-title");
      line.append(info);
      if (!n.read_at) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "secondary";
        b.textContent = L("Marquer comme lue", "Mark as read");
        b.onclick = async () => {
          b.disabled = true;
          const { error } = await db.rpc("madic_rdv_mark_notification_read", {
            p_notification_id: n.id,
          });
          if (error) {
            notice("Notification : " + error.message);
            b.disabled = false;
            return;
          }
          await loadNotifications(currentSpaceId);
        };
        line.append(b);
      }
      list.append(line);
    }
    refreshTranslation();
  }

  async function load() {
    const spaceId = $("rdvSpace").value;
    if (!spaces.some((x) => x.space_id === spaceId))
      throw Error(L("Cabinet non autorisé.", "Unauthorized firm."));
    const [sr, ar] = await Promise.all([
      db.rpc("madic_rdv_available_periods", {
        p_space_id: spaceId,
        p_duration_minutes: durationMinutes,
      }),
      db
        .from("madic_cric_appointments")
        .select("id,slot_id,status,starts_at,ends_at")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: false }),
    ]);
    if (sr.error) throw sr.error;
    if (ar.error) throw ar.error;
    // La RPC exclut les reservations actives de TOUS les clients du cabinet.
    // Un second controle cote client ecarte les creneaux devenus passes.
    slots = (sr.data || []).filter((s) => Date.parse(s.starts_at) > Date.now());
    renderCalendar();
    const sb = $("slotRows");
    sb.replaceChildren();
    for (const s of slots) {
      const r = sb.insertRow();
      td(r, date(s.starts_at));
      td(r, date(s.ends_at));
      td(r, L(mode[s.mode], modeEn[s.mode]));
      r.insertCell().append(
        action(
          `${L("Demander", "Request")} ${durationMinutes / 60} h`,
          async () => {
            await bookPeriod(s);
            notice(
              L(
                "Demande envoyée au consultant, en attente de confirmation.",
                "Request sent to your consultant, pending confirmation.",
              ),
            );
          },
        ),
      );
    }
    if (!slots.length) {
      const r = sb.insertRow();
      r.insertCell().colSpan = 4;
      r.cells[0].textContent = L(
        "Aucun créneau disponible pour le moment.",
        "No time slots available at this time.",
      );
    }
    const allIds = [...new Set((ar.data || []).map((x) => x.slot_id))];
    let slotMap = new Map(slots.map((s) => [s.id, s]));
    if (allIds.length) {
      const { data, error } = await db
        .from("madic_cric_appointment_slots")
        .select("id,starts_at,ends_at,mode")
        .in("id", allIds);
      if (error) throw error;
      for (const s of data || []) slotMap.set(s.id, s);
    }
    const br = $("bookingRows");
    br.replaceChildren();
    for (const a of ar.data || []) {
      const s = slotMap.get(a.slot_id);
      const r = br.insertRow();
      td(
        r,
        a.starts_at && a.ends_at
          ? `${date(a.starts_at)} - ${date(a.ends_at)}`
          : s
            ? `${date(s.starts_at)} - ${date(s.ends_at)}`
            : "-",
      );
      td(r, s ? L(mode[s.mode], modeEn[s.mode]) : "-");
      const statusCell = td(
        r,
        L(status[a.status] || a.status, statusEn[a.status] || a.status),
      );
      statusCell.classList.add(
        "madic-rdv-status",
        `madic-rdv-status-${a.status}`,
      );
      const detail = r.insertCell();
      detail.textContent =
        a.status === "confirmed"
          ? L("Disponible via « Voir le lien »", "Available via ‘View link’")
          : a.status === "requested"
            ? L("Communiqué après confirmation", "Provided after confirmation")
            : "-";
      const cell = r.insertCell();
      cell.className = "madic-rdv-actions";
      if (a.status === "confirmed")
        cell.append(
          action(L("Voir le lien", "View link"), async () => {
            const { data, error } = await db.rpc("madic_rdv_meeting_details", {
              p_appointment_id: a.id,
            });
            if (error) throw error;
            alert(
              data?.[0]?.location_info ||
                L(
                  "Le consultant n’a pas indiqué de lieu ou lien.",
                  "The consultant has not provided a location or link.",
                ),
            );
          }),
        );
      if (["requested", "confirmed"].includes(a.status))
        cell.append(
          action(L("Annuler", "Cancel"), async () => {
            if (
              !confirm(
                L("Annuler ce rendez-vous ?", "Cancel this appointment?"),
              )
            )
              return;
            const { error } = await db.rpc("madic_rdv_set_status", {
              p_appointment_id: a.id,
              p_status: "cancelled",
            });
            if (error) throw error;
          }),
        );
    }
    if (!ar.data?.length) {
      const r = br.insertRow();
      r.insertCell().colSpan = 5;
      r.cells[0].textContent = L(
        "Aucun rendez-vous demandé.",
        "No appointments requested.",
      );
    }
    await loadNotifications(spaceId);
    refreshTranslation();
    notice(L("Rendez-vous chargés.", "Appointments loaded."));
  }
  window.madicRdvRefreshLocale = () => {
    renderCalendar();
    durationPicker();
    const durationLabel = document.querySelector("#rdvDurationPicker label");
    if (durationLabel)
      durationLabel.textContent = L(
        "Durée du rendez-vous : ",
        "Appointment duration: ",
      );
    const durationSelect = $("rdvDuration");
    if (durationSelect) {
      durationSelect.options[0].textContent = L("1 heure", "1 hour");
      durationSelect.options[1].textContent = L("2 heures", "2 hours");
    }
    load().catch((e) => notice(e.message));
  };
  try {
    const {
      data: { user },
      error: ue,
    } = await db.auth.getUser();
    if (ue || !user)
      throw Error(L("Connexion client requise.", "Client sign-in required."));
    const { data, error } = await db.rpc("madic_my_cric_client_spaces");
    if (error) throw error;
    spaces = data || [];
    if (!spaces.length)
      throw Error(L("Aucun cabinet associé.", "No associated firm."));
    for (const s of spaces) {
      const opt = document.createElement("option");
      opt.value = s.space_id;
      opt.textContent = s.space_name;
      $("rdvSpace").append(opt);
    }
    $("rdvSpace").onchange = () => {
      weekOffset = 0;
      load().catch((e) => notice(e.message));
    };
    $("rdvPrevWeek").onclick = () => {
      weekOffset = Math.max(0, weekOffset - 1);
      renderCalendar();
    };
    $("rdvNextWeek").onclick = () => {
      weekOffset++;
      renderCalendar();
    };
    setupNotifications();
    durationPicker();
    $("rdvApp").hidden = false;
    await load();
  } catch (e) {
    notice(L("Chargement impossible: ", "Unable to load: ") + e.message);
  }
})();

/* Source consolidee : madic-client-sidebar(5).js */
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
    toggle.textContent = editing
      ? localStorage.getItem("madic_ui_language") === "en"
        ? "Done"
        : "Terminer"
      : localStorage.getItem("madic_ui_language") === "en"
        ? "Customize menu"
        : "Personnaliser le menu";
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

/* Source consolidee : madic-footer(2).js */
/* Footer commun MADIC : traduction des libellés sur les pages sans gestionnaire FR/EN. */
(function () {
  "use strict";
  function apply(lang) {
    lang = String(lang).toLowerCase().startsWith("en") ? "en" : "fr";
    document
      .querySelectorAll(".madic-footer [data-fr][data-en]")
      .forEach(function (el) {
        el.textContent = el.getAttribute("data-" + lang);
      });
  }
  var lang = "fr";
  try {
    lang =
      new URLSearchParams(location.search).get("lang") ||
      localStorage.getItem("madic_ui_language") ||
      localStorage.getItem("madic-lang") ||
      "fr";
  } catch (e) {}
  apply(lang);
  window.addEventListener("storage", function (e) {
    if (e.key === "madic-lang") apply(e.newValue);
  });
})();

/* Script local original 1 */

/* Explicit click-only interface translation. No observer, no form value changes. */
(function () {
  "use strict";
  const dict = {
    "Espace client": "Client space",
    "ESPACE CLIENT · CONSULTATIONS": "CLIENT SPACE · CONSULTATIONS",
    "Choisissez un créneau, suivez vos demandes et retrouvez les informations de vos consultations.":
      "Choose a time slot, track your requests and find your consultation details.",
    "Les horaires sont affichés à l'heure de Montréal (heure de l'Est). Vérifiez le décalage avec votre pays.":
      "Times are shown in Montréal time (Eastern Time). Check the time difference with your country.",
    Réinitialiser: "Reset",
    Terminer: "Done",
    "Glissez les éléments ou utilisez les flèches pour choisir votre ordre.":
      "Drag items or use the arrows to choose their order.",
    "Glisser pour déplacer": "Drag to move",
    Monter: "Move up",
    Descendre: "Move down",
    "Outils du compte": "Account tools",
    "Notifications de messagerie": "Messaging notifications",
    "Navigation de mon espace client": "Client space navigation",
    "Menu personnalisable": "Customizable menu",
    "Calendrier des créneaux disponibles": "Available time slots calendar",
    "Mes rendez-vous": "My appointments",
    "Vérification des accès…": "Checking access…",
    "Pied de page MADIC / MADIC footer": "MADIC footer",
    "Liens du pied de page": "Footer links",
    "Page à venir / Page coming soon": "Page coming soon",
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
      if (typeof window.madicRdvRefreshLocale === "function")
        window.madicRdvRefreshLocale();
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
        word = raw.trim().replace(/\s+/g, " ");
      if (Object.prototype.hasOwnProperty.call(map, word))
        node.nodeValue = raw.replace(raw.trim(), map[word]);
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
  window.madicTranslateAppointments = translate;
  apply();
})();

/* Script local original 2 */

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

/* Mobile client navigation */

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

/* MADIC client: display preferences, independent of business logic. */
(()=>{function init(){const d=document.querySelector('#madicClientDrawer'),c=d?.querySelector('.madic-collapse'),t=d?.querySelector('.madic-theme-trigger'),m=d?.querySelector('#madicThemeOptions');if(!c||!t||!m)return;
const read=(k,v)=>{try{return localStorage.getItem(k)||v}catch{return v}},save=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};let compact=read('madic-client-sidebar','expanded')==='compact',theme=read('madic-admin-theme','light');const media=matchMedia('(prefers-color-scheme:dark)');
function close(){if(m.matches(':popover-open'))m.hidePopover();m.hidden=true;t.setAttribute('aria-expanded','false')}
function apply(){document.body.classList.toggle('madic-client-compact',compact);c.setAttribute('aria-expanded',String(!compact));const en=document.documentElement.lang.startsWith('en');c.title=c.ariaLabel=compact?(en?'Expand menu':'Développer le menu'):(en?'Collapse menu':'Réduire le menu');c.querySelector('span').textContent=c.title;t.ariaLabel=en?'Appearance':'Apparence';document.documentElement.dataset.madicTheme=theme==='system'?(media.matches?'dark':'light'):theme;m.querySelectorAll('[data-theme-choice]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.themeChoice===theme));b.querySelector('span').textContent=({system:en?'System':'Système',light:en?'Light':'Clair',dark:en?'Dark':'Sombre'})[b.dataset.themeChoice]});}
c.addEventListener('click',()=>{close();compact=!compact;save('madic-client-sidebar',compact?'compact':'expanded');apply()});t.addEventListener('click',()=>{if(!m.hidden){close();return}m.hidden=false;m.setAttribute('popover','manual');m.showPopover();const a=t.getBoundingClientRect(),r=d.getBoundingClientRect();m.style.setProperty('--madic-popup-x',Math.max(4,Math.min(compact?r.right+4:r.left+8,innerWidth-160))+'px');m.style.setProperty('--madic-popup-y',Math.max(4,Math.min(a.bottom-m.offsetHeight,innerHeight-m.offsetHeight-4))+'px');t.setAttribute('aria-expanded','true')});m.addEventListener('click',e=>{const b=e.target.closest('[data-theme-choice]');if(b){theme=b.dataset.themeChoice;save('madic-admin-theme',theme);apply();close()}});document.addEventListener('click',e=>{if(!m.contains(e.target)&&!t.contains(e.target))close()});window.addEventListener('resize',close);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!m.hidden){close();e.stopImmediatePropagation()}},true);media.addEventListener('change',apply);new MutationObserver(apply).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});apply();}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init()})();
