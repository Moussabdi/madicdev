/* MADIC CRIC: les politiques RLS Supabase constituent la protection des données. */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    cfg = window.MADIC_CONFIG,
    page = document.body.dataset.cricPage;
  const msg = (s, bad = false) => {
    const n = $("message");
    n.textContent = s;
    n.style.color = bad ? "#b42318" : "";
  };
  const date = (x) => (x ? new Date(x).toLocaleDateString("fr-CA") : "-");
  const cell = (r, s) => {
    const t = r.insertCell();
    t.textContent = s ?? "-";
    return t;
  };
  const button = (s, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "secondary";
    b.textContent = s;
    b.addEventListener("click", fn);
    return b;
  };
  if (
    !cfg?.url ||
    !cfg?.anonKey ||
    !window.supabase ||
    typeof window.getMadicSupabase !== "function"
  ) {
    msg("Configuration Supabase manquante.", true);
    return;
  }
  const db = window.getMadicSupabase();
  $("logout").addEventListener("click", async () => {
    await db.auth.signOut();
    location.replace("connexion.html");
  });
  let space,
    clients = [],
    dossiers = [],
    nameById = new Map();
  const name = (c) =>
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
    c.email ||
    "Client";
  async function fetchData() {
    const { data: associations, error: ae } = await db
      .from("madic_cric_clients")
      .select("client_id")
      .eq("space_id", space.id);
    if (ae) throw ae;
    const ids = [...new Set((associations || []).map((x) => x.client_id))];
    clients = [];
    if (ids.length) {
      const { data, error } = await db
        .from("profiles")
        .select("id,first_name,last_name,email,phone")
        .in("id", ids);
      if (error) throw error;
      clients = data || [];
    }
    nameById = new Map(clients.map((c) => [c.id, name(c)]));
    const { data: ds, error: de } = await db
      .from("dossiers")
      .select("id,client_id,space_id,reference,category,status,created_at")
      .eq("space_id", space.id)
      .order("created_at", { ascending: false });
    if (de) throw de;
    dossiers = (ds || []).filter((d) => ids.includes(d.client_id));
  }
  const defaultCategories = [
    "Résidence permanente",
    "Résidence temporaire",
    "Parrainage familial",
    "Visiteur",
    "Permis de travail",
    "Permis d'études",
    "Citoyenneté",
    "Asile",
  ];
  function updateNewCategory() {
    const isNew = $("category").value === "__new__";
    $("new-category-container").hidden = !isNew;
    $("new-category").required = isNew;
    if (!isNew) $("new-category").value = "";
  }
  function renderCategories() {
    const select = $("category"),
      chosen = select.value;
    const values = [
      ...new Set([
        ...defaultCategories,
        ...dossiers.map((d) => d.category).filter(Boolean),
      ]),
    ].sort((a, b) => a.localeCompare(b, "fr"));
    select.replaceChildren();
    for (const [value, label] of [
      ["", "Sélectionner une catégorie"],
      ...values.map((v) => [v, v]),
      ["__new__", "+ Créer une nouvelle catégorie"],
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
    if ([...select.options].some((o) => o.value === chosen))
      select.value = chosen;
    updateNewCategory();
  }
  function renderDossiers() {
    const body = $("dossiersBody");
    body.replaceChildren();
    const clientId = new URLSearchParams(location.search).get("client");
    const list = dossiers.filter((d) => d.client_id === clientId);
    for (const d of list) {
      const r = body.insertRow();
      cell(r, d.reference);
      cell(r, nameById.get(d.client_id) || "Client");
      cell(r, d.category);
      const td = r.insertCell(),
        s = document.createElement("select");
      for (const v of ["en_attente", "actif", "ferme"]) {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = {
          en_attente: "En attente",
          actif: "Actif",
          ferme: "Fermé",
        }[v];
        s.append(o);
      }
      s.value = d.status;
      td.append(s);
      r.insertCell().append(
        button("Enregistrer", async () => {
          if (s.value === d.status) return msg("Aucun changement.");
          const { error } = await db
            .from("dossiers")
            .update({ status: s.value })
            .eq("id", d.id)
            .eq("space_id", space.id);
          if (error)
            return msg("Mise à jour impossible : " + error.message, true);
          msg("Statut enregistré.");
          await reload();
        }),
        button("Gérer les documents", () => {
          location.href =
            "demandes-documents-cric.html?client=" +
            encodeURIComponent(d.client_id) +
            "&dossier=" +
            encodeURIComponent(d.id);
        }),
      );
    }
    if (!list.length) {
      const r = body.insertRow();
      r.insertCell().colSpan = 5;
      r.cells[0].textContent = "Aucun dossier associé à ce client.";
    }
  }
  async function reload() {
    await fetchData();
    const clientId = new URLSearchParams(location.search).get("client");
    if (!clients.some((c) => c.id === clientId))
      throw Error("Client non associé à votre espace CRIC.");
    renderDossiers();
    renderCategories();
  }
  try {
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      location.replace("connexion.html");
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
    const { data: spaces, error: se } = await db
      .from("madic_cric_spaces")
      .select("id,name,access_status")
      .eq("owner_user_id", uid)
      .limit(1);
    if (se) throw se;
    space = spaces?.[0];
    if (!space || space.access_status !== "active")
      throw Error("Espace CRIC absent ou suspendu.");
    const { data: allowed, error: ae } = await db.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: space.id },
    );
    if (ae || allowed !== true) throw Error("Accès à cet espace non autorisé.");
    const clientId = new URLSearchParams(location.search).get("client");
    if (!clientId) throw Error("Identifiant du client manquant.");
    await fetchData();
    const client = clients.find((c) => c.id === clientId);
    if (!client) throw Error("Client non associé à votre espace CRIC.");
    $("clientDetailName").textContent =
      "Client : " + name(client) + " - " + (client.email || "");
    $("dossierClientLabel").textContent = name(client);
    $("clientSelect").value = clientId;
    renderCategories();
    // MADIC : suggérer la catégorie depuis le formulaire du client, sans forcer le choix du CRIC.
    // La lecture est soumise aux politiques RLS de madic_client_intake.
    function intakeLanguage() {
      return document.documentElement.lang.toLowerCase().startsWith("en")
        ? "en"
        : "fr";
    }
    const intakeLabels = {
      residence_temporaire: ["Résidence temporaire", "Temporary residence"],
      residence_permanente: ["Résidence permanente", "Permanent residence"],
    };
    function intakeLabel(key) {
      if (intakeLabels[key])
        return intakeLabels[key][intakeLanguage() === "en" ? 1 : 0];
      return String(key)
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, (c) => c.toUpperCase());
    }
    function intakeValue(value) {
      if (value === null || value === undefined || value === "") return "-";
      if (typeof value === "boolean")
        return intakeLanguage() === "en"
          ? value
            ? "Yes"
            : "No"
          : value
            ? "Oui"
            : "Non";
      if (Array.isArray(value))
        return (
          value
            .map((v) =>
              typeof v === "object" && v !== null
                ? JSON.stringify(v)
                : String(v),
            )
            .join(", ") || "-"
        );
      return String(value);
    }
    function renderIntakeAnswers(answers) {
      const target = $("madicClientIntakeAnswers");
      target.replaceChildren();
      const entries = Object.entries(answers || {});
      for (const [key, value] of entries) {
        const item = document.createElement("div");
        item.className = "madic-intake-entry";
        const dt = document.createElement("dt");
        dt.textContent = intakeLabel(key);
        const dd = document.createElement("dd");
        if (value && typeof value === "object" && !Array.isArray(value)) {
          item.classList.add("madic-intake-wide");
          const nested = document.createElement("dl");
          for (const [subkey, subvalue] of Object.entries(value)) {
            const subdt = document.createElement("dt");
            subdt.textContent = intakeLabel(subkey);
            const subdd = document.createElement("dd");
            subdd.textContent = intakeValue(subvalue);
            nested.append(subdt, subdd);
          }
          dd.append(nested);
        } else dd.textContent = intakeValue(value);
        item.append(dt, dd);
        target.append(item);
      }
      target.hidden = entries.length === 0;
      return entries.length;
    }
    async function loadClientIntake() {
      const status = $("madicClientIntakeStatus");
      const target = $("madicClientIntakeAnswers");
      target.hidden = true;
      const { data, error } = await db
        .from("madic_client_intake")
        .select("answers")
        .eq("user_id", clientId)
        .maybeSingle();
      if (error) {
        status.textContent =
          error.code === "42501" || error.code === "PGRST301"
            ? "Accès non autorisé au formulaire du client."
            : "Formulaire indisponible : " + error.message;
        return;
      }
      const answers =
        data?.answers && typeof data.answers === "object" ? data.answers : {};
      const count = renderIntakeAnswers(answers);
      status.textContent = count
        ? "Formulaire disponible - " + count + " réponse(s)."
        : "Formulaire non rempli ou non accessible.";
      const chosen = (value) => Boolean(value && value !== "aucun");
      const temp = chosen(answers.residence_temporaire);
      const perm = chosen(answers.residence_permanente);
      if (temp === perm) return;
      const categorySelect = $("category");
      if (categoryTouched || categorySelect.value) return;
      const suggested = temp ? "Résidence temporaire" : "Résidence permanente";
      if (
        [...categorySelect.options].some((option) => option.value === suggested)
      ) {
        categorySelect.value = suggested;
        updateNewCategory();
        const info = $("madic-residence-category-info");
        if (info)
          info.textContent =
            "Catégorie proposée selon le formulaire d'immigration du client (modifiable).";
      }
    }
    // Une interaction du CRIC pendant la lecture asynchrone prime sur la suggestion.
    let categoryTouched = false;
    $("category").addEventListener("change", () => {
      categoryTouched = true;
    });
    const suggestIfUntouched = async () => {
      if (categoryTouched) return;
      await loadClientIntake();
    };
    // La catégorie reste modifiable et la création du dossier reste manuelle.
    await suggestIfUntouched();
    $("spaceName").textContent = "Espace professionnel : " + space.name;
    renderDossiers();
    $("workspace").hidden = false;
    setupGuestAccess(db, space.id, clientId);
    setupClientRevocation(db, space.id, clientId);
    msg("Dossiers du client chargés.");
    $("refresh").addEventListener("click", async () => {
      try {
        await reload();
        await loadClientIntake();
        msg("Dossiers actualisés.");
      } catch (e) {
        msg(e.message, true);
      }
    });
    $("category").addEventListener("change", updateNewCategory);
    $("createDossier").addEventListener("submit", async (e) => {
      e.preventDefault();
      const client_id = $("clientSelect").value;
      if (!clients.some((c) => c.id === client_id))
        return msg("Client non autorisé.", true);
      const selected = $("category").value;
      const category = (
        selected === "__new__" ? $("new-category").value : selected
      ).trim();
      if (!category || category.length > 100)
        return msg(
          "Sélectionnez une catégorie valide (100 caractères maximum).",
          true,
        );
      const b = $("createButton");
      b.disabled = true;
      try {
        const { data, error } = await db
          .from("dossiers")
          .insert({
            client_id,
            space_id: space.id,
            category,
            status: $("newStatus").value,
          })
          .select("reference")
          .single();
        if (error) throw error;
        $("createDossier").reset();
        $("clientSelect").value = client_id;
        updateNewCategory();
        await reload();
        msg(
          "Dossier créé. Référence : " +
            (data?.reference || "attribuée par le serveur") +
            ".",
        );
      } catch (err) {
        msg("Création impossible : " + (err.message || String(err)), true);
      } finally {
        b.disabled = false;
      }
    });
  } catch (e) {
    msg(
      "Impossible de charger les données : " + (e.message || String(e)),
      true,
    );
  }
})();

(function () {
  "use strict";
  const entries = [
    ["cric-dashboard.html", "Vue d’ensemble", "squares-2x2"],
    ["gestion-clients-cric.html", "Clients", "users"],
    ["gestion-dossiers-cric.html", "Outils CRIC", "folder-open"],
    ["messagerie-cric.html", "Messagerie", "chat-bubble-left-right"],
    ["rendez-vous-cric.html", "Rendez-vous", "calendar-days"],
    ["demandes-documents-cric.html", "Documents", "document-text"],
    ["echeances-cric.html", "Échéances", "calendar-days"],
    ["facturation-cric.html", "Facturation", "receipt-percent"],
    ["finances-cric.html", "Finances", "banknotes"],
    [
      "profil-professionnel-cric.html",
      "Mon profil professionnel",
      "identification",
    ],
  ];
  const nav = document.querySelector(".madic-unified-sidebar nav");
  if (nav) {
    nav.replaceChildren();
    for (const [href, label, icon] of entries) {
      const a = document.createElement("a");
      a.href = href;
      a.dataset.madicPage = href;
      if (href === "gestion-clients-cric.html")
        a.setAttribute("aria-current", "page");
      const span = document.createElement("span");
      span.setAttribute("aria-hidden", "true");
      const img = document.createElement("img");
      img.className = "madic-heroicon";
      img.alt = "";
      img.src =
        "https://raw.githubusercontent.com/tailwindlabs/heroicons/v2.2.0/optimized/24/outline/" +
        icon +
        ".svg";
      span.append(img);
      a.append(span, document.createTextNode(label));
      nav.append(a);
    }
  }
  const monogram = document.querySelector(".madic-unified-monogram");
  if (monogram) {
    const img = document.createElement("img");
    img.src = "img/logo-madic.svg";
    img.alt = "MADIC";
    monogram.replaceChildren(img);
  }
  const translations = {
    "Détail du client": "Client details",
    "Créer un dossier": "Create a case",
    "Dossiers existants et statuts": "Existing cases and statuses",
    Référence: "Reference",
    Client: "Client",
    Catégorie: "Category",
    Statut: "Status",
    Actions: "Actions",
    Actualiser: "Refresh",
    Déconnexion: "Sign out",
    "Retour à la gestion des clients": "Back to client management",
    "Espace professionnel": "Professional workspace",
    "Vue d’ensemble": "Overview",
    Clients: "Clients",
    "Outils CRIC": "RCIC tools",
    Messagerie: "Messaging",
    "Rendez-vous": "Appointments",
    Documents: "Documents",
    Échéances: "Deadlines",
    Facturation: "Billing",
    Finances: "Finances",
    "Mon profil professionnel": "My professional profile",
    NAVIGATION: "NAVIGATION",
    "Espace sécurisé MADIC": "Secure MADIC workspace",
    "Gestion des clients": "Client management",
    "Espace CRIC": "RCIC workspace",
    "Créer le dossier": "Create case",
    "En attente": "Pending",
    Actif: "Active",
    Fermé: "Closed",
    "Sélectionner une catégorie": "Select a category",
    "Nouvelle catégorie": "New category",
    "Référence automatique": "Automatic reference",
    "Attribuée à la création": "Assigned on creation",
    "Chargement du client…": "Loading client…",
    "ESPACE PROFESSIONNEL CRIC": "RCIC PROFESSIONAL WORKSPACE",
    "Mon espace": "My space",
  };
  const nodes = [...document.querySelectorAll("body *")].filter(
    (el) => !["SCRIPT", "STYLE", "OPTION"].includes(el.tagName),
  );
  const original = new Map();
  for (const el of nodes) {
    for (const n of el.childNodes)
      if (n.nodeType === 3 && n.textContent.trim())
        original.set(n, n.textContent);
  }
  function apply(lang) {
    lang = lang === "en" ? "en" : "fr";
    document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
    for (const [node, raw] of original) {
      if (!node.isConnected) continue;
      const trimmed = raw.trim();
      const translated =
        translations[trimmed] || translations[trimmed.replace(/^←\s*/, "")];
      node.textContent =
        lang === "en" && translated
          ? raw.replace(
              trimmed,
              trimmed.startsWith("←") ? "← " + translated : translated,
            )
          : raw;
    }
    document.querySelectorAll("[data-fr][data-en]").forEach((el) => {
      if (!el.children.length) el.textContent = el.getAttribute("data-" + lang);
    });
    document.querySelectorAll("[data-lang]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
  }
  let lang = "fr";
  try {
    lang = localStorage.getItem("madic-lang") || "fr";
  } catch (e) {}
  document.querySelectorAll("[data-lang]").forEach((b) =>
    b.addEventListener("click", () => {
      lang = b.dataset.lang;
      try {
        localStorage.setItem("madic-lang", lang);
      } catch (e) {}
      apply(lang);
    }),
  );
  apply(lang);
})();

function setupGuestAccess(db, spaceId, clientId) {
  const el = (id) => document.getElementById("cricGuest" + id);
  const form = el("Form"),
    revoke = el("Revoke"),
    invite = el("Invite");
  const args = { p_space: spaceId, p_client: clientId };
  const english = () => document.documentElement.lang.startsWith("en");
  const tr = (fr, en) => (english() ? en : fr);
  let current,
    busy = false,
    notice = [];
  const states = {
    pending: ["Invitation en attente", "Invitation pending"],
    active: ["Accès actif", "Access active"],
    expired: ["Invitation expirée", "Invitation expired"],
    revoked: ["Accès révoqué", "Access revoked"],
  };
  function render() {
    const exclusive = current && ["pending", "active"].includes(current.status);
    form.hidden = current === undefined || Boolean(exclusive);
    revoke.hidden = !exclusive;
    invite.disabled = revoke.disabled = busy;
    let status = current
      ? current.email + " · " + tr(...states[current.status])
      : current === null
        ? tr("Aucun accès invité.", "No guest access.")
        : "";
    if (current?.status === "pending") {
      status +=
        " · " +
        new Date(current.expires).toLocaleString(english() ? "en-CA" : "fr-CA");
    }
    el("Current").textContent = status;
    el("Status").textContent = notice.length ? tr(...notice) : "";
  }
  async function load(revokeId) {
    const { data, error } = await db.rpc(
      "madic_guest_manage",
      revokeId ? { ...args, p_revoke: revokeId } : args,
    );
    if (error) throw error;
    current = data;
  }
  async function perform(action) {
    if (busy) return;
    busy = true;
    notice = [];
    render();
    try {
      await action();
    } catch {
      notice = [
        "Opération impossible. Actualisez la fiche et réessayez.",
        "Unable to complete the action. Refresh this page and try again.",
      ];
    } finally {
      busy = false;
      render();
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    perform(async () => {
      const { data, error } = await db.functions.invoke(
        "madic-send-client-invitation",
        {
          body: {
            action: "guest_invite",
            space_id: spaceId,
            client_id: clientId,
            email: el("Email").value.trim(),
          },
        },
      );
      if (error || !data?.invitation_url) {
        await load();
        throw error || Error("Missing invitation URL");
      }
      el("Link").value = data.invitation_url;
      el("LinkBox").hidden = false;
      notice = data.email_sent
        ? ["Invitation envoyée.", "Invitation sent."]
        : [
            "Invitation créée. Copiez le lien personnel pour le transmettre.",
            "Invitation created. Copy the personal link to share it.",
          ];
      form.reset();
      await load();
    });
  });
  revoke.addEventListener("click", () => {
    if (
      busy ||
      !current ||
      !window.confirm(
        tr(
          "Révoquer cet accès ou cette invitation ?",
          "Revoke this access or invitation?",
        ),
      )
    )
      return;
    perform(async () => {
      await load(current.id);
      el("LinkBox").hidden = true;
      el("Link").value = "";
      notice =
        current?.status === "revoked"
          ? ["Accès révoqué.", "Access revoked."]
          : [
              "L’état a changé. Vérifiez l’accès affiché.",
              "The status changed. Check the displayed access.",
            ];
    });
  });
  el("Copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(el("Link").value);
      notice = ["Lien copié.", "Link copied."];
    } catch {
      el("Link").select();
      notice = ["Sélectionnez et copiez le lien.", "Select and copy the link."];
    }
    render();
  });
  new MutationObserver(render).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  perform(() => load());
}

function setupClientRevocation(db, spaceId, clientId) {
  const button = document.getElementById("revokeClientPortal");
  const status = document.getElementById("revokeClientPortalStatus");
  const tr = (fr, en) =>
    document.documentElement.lang.startsWith("en") ? en : fr;
  button.addEventListener("click", async () => {
    if (
      button.disabled ||
      !window.confirm(
        tr(
          "Révoquer l’accès de ce client et de ses invités à votre cabinet? Pour redonner l’accès au client, envoyez une nouvelle invitation.",
          "Revoke access to your firm for this client and their guests? To restore the client’s access, send a new invitation.",
        ),
      )
    )
      return;
    button.disabled = true;
    status.textContent = "";
    try {
      if (!(await window.madicRequireMfa(db))) return;
      const { error } = await db.rpc("madic_revoke_cric_client", {
        p_space_id: spaceId,
        p_client_id: clientId,
      });
      if (error) throw error;
      location.replace("gestion-clients-cric.html?acces=revoque");
    } catch {
      status.textContent = tr(
        "La révocation a échoué. Actualisez la fiche et réessayez.",
        "Unable to revoke access. Refresh the page and try again.",
      );
    } finally {
      button.disabled = false;
    }
  });
}
