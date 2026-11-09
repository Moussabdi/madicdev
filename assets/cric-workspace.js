/* Consultation CRIC en lecture seule. Les politiques RLS Supabase restent la protection principale. */
(async () => {
  "use strict";
  const el = (id) => document.getElementById(id);
  const cfg = window.MADIC_CONFIG;
  const notice = (msg) => {
    el("cricWorkMessage").textContent = msg;
  };
  const view = document.body.dataset.cricView;
  if (!cfg?.url || !cfg?.anonKey || !window.supabase)
    return notice("Configuration Supabase manquante.");
  const db = window.getMadicSupabase();
  const cell = (row, value) => {
    const td = row.insertCell();
    td.textContent = value ?? "-";
    return td;
  };
  const date = (value) =>
    value ? new Date(value).toLocaleDateString("fr-CA") : "-";
  let space,
    clients = [],
    dossiers = [],
    current = [];
  const search = el("cricSearch");
  el("cricLogout").addEventListener("click", async () => {
    await db.auth.signOut();
    location.replace("connexion.html");
  });
  function makeButton(label, handler) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cric-link";
    b.textContent = label;
    b.addEventListener("click", handler);
    return b;
  }
  async function documentsFor(d) {
    el("cricDocumentsPanel").hidden = false;
    el("cricDocumentsTitle").textContent = "Documents - " + d.reference;
    el("cricDocumentsMessage").textContent = "Chargement…";
    const body = el("cricDocumentsBody");
    body.replaceChildren();
    const { data, error } = await db
      .from("documents")
      .select("id,original_name,storage_path,status,created_at")
      .eq("dossier_id", d.id)
      .eq("client_id", d.client_id)
      .order("created_at", { ascending: false });
    if (error) {
      el("cricDocumentsMessage").textContent = "Erreur : " + error.message;
      return;
    }
    el("cricDocumentsMessage").textContent = data.length
      ? `${data.length} document(s)`
      : "Aucun document pour ce dossier.";
    for (const doc of data) {
      const row = body.insertRow();
      cell(row, doc.original_name);
      cell(row, doc.status);
      cell(row, date(doc.created_at));
      const action = row.insertCell();
      const button = makeButton("Télécharger", async () => {
        button.disabled = true;
        try {
          const { data: signed, error: e } = await db.storage
            .from("madic-documents")
            .createSignedUrl(doc.storage_path, 60);
          if (e || !signed?.signedUrl)
            throw e || new Error("Lien indisponible");
          const a = document.createElement("a");
          a.href = signed.signedUrl;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.click();
        } catch (err) {
          el("cricDocumentsMessage").textContent =
            "Téléchargement impossible : " + err.message;
        } finally {
          button.disabled = false;
        }
      });
      action.append(button);
    }
  }
  function render() {
    const q = search.value.trim().toLocaleLowerCase("fr");
    const rows = current.filter((x) => x._search.includes(q));
    el("cricCount").textContent = `${rows.length} résultat(s)`;
    const body = el("cricTableBody");
    body.replaceChildren();
    for (const item of rows) {
      const row = body.insertRow();
      if (view === "clients") {
        cell(row, item._name);
        cell(row, item.email);
        cell(row, item.phone);
        const n = dossiers.filter((d) => d.client_id === item.id).length;
        cell(row, String(n));
        const action = row.insertCell();
        action.append(
          makeButton("Voir les dossiers", () => {
            location.href =
              "gestion-dossiers-cric.html?client=" +
              encodeURIComponent(item.id);
          }),
        );
      } else {
        cell(row, item.reference);
        cell(row, item._client);
        cell(row, item.category);
        cell(row, item.status);
        cell(row, date(item.created_at));
        row
          .insertCell()
          .append(makeButton("Documents", () => documentsFor(item)));
      }
    }
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
    if (app?.status !== "approved")
      return notice("Accès réservé aux consultants CRIC approuvés.");
    const { data: spaces, error: spaceError } = await db
      .from("madic_cric_spaces")
      .select("id,name,access_status")
      .eq("owner_user_id", uid)
      .limit(1);
    if (spaceError) throw spaceError;
    space = spaces?.[0];
    if (!space || space.access_status !== "active")
      return notice("Votre espace CRIC est absent ou suspendu.");
    const { data: allowed, error: allowError } = await db.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: space.id },
    );
    if (allowError || allowed !== true)
      return notice("Accès professionnel non autorisé.");
    el("cricSpaceName").textContent = "Espace professionnel : " + space.name;
    const { data: associations, error: assocError } = await db
      .from("madic_cric_clients")
      .select("client_id")
      .eq("space_id", space.id);
    if (assocError) throw assocError;
    const ids = (associations || []).map((x) => x.client_id);
    if (ids.length) {
      const { data: profiles, error: profileError } = await db
        .from("profiles")
        .select("id,first_name,last_name,email,phone")
        .in("id", ids);
      if (profileError) throw profileError;
      clients = profiles || [];
    }
    const { data: ds, error: dsError } = await db
      .from("dossiers")
      .select("id,client_id,reference,category,status,created_at")
      .eq("space_id", space.id)
      .order("created_at", { ascending: false });
    if (dsError) throw dsError;
    dossiers = ds || [];
    const names = new Map(
      clients.map((c) => [
        c.id,
        [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
          c.email ||
          c.id,
      ]),
    );
    const head = el("cricTableHead");
    head.replaceChildren();
    const tr = head.insertRow();
    const headers =
      view === "clients"
        ? ["Client", "Courriel", "Téléphone", "Dossiers", "Action"]
        : ["Référence", "Client", "Catégorie", "Statut", "Créé le", "Action"];
    headers.forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      tr.append(th);
    });
    if (view === "clients")
      current = clients.map((c) => ({
        ...c,
        _name: names.get(c.id),
        _search: [names.get(c.id), c.email, c.phone]
          .join(" ")
          .toLocaleLowerCase("fr"),
      }));
    else {
      const filter = new URLSearchParams(location.search).get("client");
      current = dossiers
        .filter((d) => !filter || d.client_id === filter)
        .map((d) => ({
          ...d,
          _client: names.get(d.client_id) || "Client",
          _search: [d.reference, names.get(d.client_id), d.category, d.status]
            .join(" ")
            .toLocaleLowerCase("fr"),
        }));
    }
    search.addEventListener("input", render);
    el("cricWorkPanel").hidden = false;
    notice("Consultation en lecture seule.");
    render();
  } catch (err) {
    notice(
      "Impossible de charger les données : " + (err.message || String(err)),
    );
  }
})();
