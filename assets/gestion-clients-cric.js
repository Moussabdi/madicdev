/* ===== gestion-clients-cric(3).js ===== */
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
  const legacyClientId = new URLSearchParams(location.search).get("client");
  if (page === "clients" && legacyClientId) {
    location.replace(
      "gestion-client-cric-detail.html?client=" +
        encodeURIComponent(legacyClientId),
    );
    return;
  }
  const db = window.getMadicSupabase();
  $("logout").addEventListener("click", async () => {
    await db.auth.signOut();
    location.replace("connexion-cric.html");
  });
  let space,
    clients = [],
    dossiers = [],
    contracts = [],
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
    const totalClients = $("madicTotalClients");
    const totalDossiers = $("madicTotalDossiers");
    if (totalClients) totalClients.textContent = String(clients.length);
    if (totalDossiers) totalDossiers.textContent = String(dossiers.length);
  }
  function renderClients() {
    const body = $("clientsBody");
    body.replaceChildren();
    const q = $("search").value.toLocaleLowerCase("fr").trim();
    const filtered = clients.filter((c) =>
      [name(c), c.email, c.phone].join(" ").toLocaleLowerCase("fr").includes(q),
    );
    $("clientCount").textContent = `(${filtered.length})`;
    const visible = $("madicVisibleClients");
    if (visible) visible.textContent = String(filtered.length);
    for (const c of filtered) {
      const r = body.insertRow();
      const nameCell = cell(r, name(c));
      nameCell.classList.add("madic-client-name");
      cell(r, c.email);
      cell(r, c.phone);
      cell(r, String(dossiers.filter((d) => d.client_id === c.id).length));
      r.insertCell().append(
        button("Factures", () => {
          location.href =
            "facturation-cric.html?client=" + encodeURIComponent(c.id);
        }),
      );
      r.insertCell().append(
        button("Consulter", () => {
          location.href =
            "gestion-client-cric-detail.html?client=" +
            encodeURIComponent(c.id);
        }),
      );
    }
    if (!filtered.length) {
      const r = body.insertRow();
      r.insertCell().colSpan = 6;
      r.cells[0].textContent = q ? "Aucun client ne correspond à votre recherche." : "Aucun client associé pour le moment.";
      r.cells[0].className = "madic-clients-empty";
    }
  }
  function renderDossiers() {
    const body = $("dossiersBody");
    if (!body) return;
    body.replaceChildren();
    const filter = new URLSearchParams(location.search).get("client");
    const list = dossiers.filter((d) => !filter || d.client_id === filter);
    if (page === "dossiers") $("dossierCount").textContent = `(${list.length})`;
    for (const d of list) {
      const r = body.insertRow();
      cell(r, d.reference);
      cell(r, nameById.get(d.client_id) || "Client");
      cell(r, d.category);
      if (page === "clients") {
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
        const a = r.insertCell();
        a.append(
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
          button("Documents", () => showDocuments(d)),
        );
      } else {
        cell(r, d.status);
        cell(r, date(d.created_at));
        r.insertCell().append(button("Documents", () => showDocuments(d)));
      }
    }
    if (!list.length) {
      const r = body.insertRow();
      r.insertCell().colSpan = page === "clients" ? 5 : 6;
      r.cells[0].textContent = "Aucun dossier.";
    }
  }
  async function showDocuments(d) {
    $("documentsPanel").hidden = false;
    $("documentsTitle").textContent = "Documents - " + d.reference;
    $("documentsMessage").textContent = "Chargement…";
    const body = $("documentsBody");
    body.replaceChildren();
    const { data, error } = await db
      .from("documents")
      .select(
        "id,original_name,created_at,review_status,review_reason,storage_path",
      )
      .eq("dossier_id", d.id)
      .eq("client_id", d.client_id)
      .order("created_at", { ascending: false });
    if (error) {
      $("documentsMessage").textContent = error.message;
      return;
    }
    $("documentsMessage").textContent = (data || []).length + " document(s)";
    for (const doc of data || []) {
      const r = body.insertRow();
      cell(r, doc.original_name);
      cell(r, date(doc.created_at));
      cell(
        r,
        { accepte: "Accepté", refuse: "Refusé", en_attente: "En attente" }[
          doc.review_status
        ] || doc.review_status,
      );
      cell(r, doc.review_reason);
      r.insertCell().append(
        button("Télécharger", async () => {
          const { data: signed, error: se } = await db.storage
            .from("madic-documents")
            .createSignedUrl(doc.storage_path, 60);
          if (se || !signed?.signedUrl)
            return msg(
              "Téléchargement impossible : " +
                (se?.message || "Lien indisponible"),
              true,
            );
          const a = document.createElement("a");
          a.href = signed.signedUrl;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.click();
        }),
      );
    }
  }
  async function reload() {
    if (page === "clients") {
      await fetchData();
      renderClients();
    }
  }
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
    $("spaceName").textContent = "Espace professionnel : " + space.name;
    await reload();
    $("workspace").hidden = false;
    msg("Espace chargé. Les données sont soumises aux autorisations Supabase.");
    if (page === "clients") {
      $("search")?.addEventListener("input", renderClients);
      $("refresh")?.addEventListener("click", async () => {
        try {
          await reload();
          msg("Dossiers actualisés.");
        } catch (e) {
          msg(e.message, true);
        }
      });
      const inviteForm = $("cricInviteForm");
      if (inviteForm) {
        const gate = $("cricProfileGate");
        const inviteButton = inviteForm.querySelector('button[type="submit"]');
        inviteButton.disabled = true;
        const profileFields = [
          "first_name",
          "last_name",
          "business_name",
          "professional_title",
          "license_number",
          "phone",
          "business_address",
          "logo_path",
        ];
        const { data: professional, error: professionalError } = await db
          .from("madic_cric_professional_profiles")
          .select(profileFields.join(","))
          .eq("space_id", space.id)
          .maybeSingle();
        const complete =
          !professionalError &&
          !!professional &&
          profileFields.every(
            (k) => String(professional[k] ?? "").trim().length > 0,
          );
        window.MADIC_CRIC_PROFILE_READY = complete;
        if (!complete) {
          gate.replaceChildren();
          gate.append(
            document.createTextNode(
              professionalError
                ? "Impossible de vérifier le profil professionnel : " +
                    professionalError.message +
                    ". "
                : "Avant d'inviter un client, remplissez votre profil professionnel (entreprise, adresse, titre, numéro de permis, téléphone et logo). ",
            ),
          );
          const link = document.createElement("a");
          link.href = "profil-professionnel-cric.html";
          link.textContent = "Compléter mon profil professionnel →";
          gate.append(link);
        } else {
          gate.textContent =
            "Profil professionnel complet : invitations disponibles.";
          inviteButton.disabled = false;
        }
        window.dispatchEvent(
          new CustomEvent("madic:cric-profile-gate", { detail: { complete } }),
        );

        const emailInput = $("cricInviteEmail");
        const inviteMessage = $("cricInviteMessage");
        const inviteLink = $("cricInviteLink");
        const submitBtn = inviteForm.querySelector('button[type="submit"]');
        emailInput.addEventListener("input", () => {
          inviteLink.value = "";
          inviteMessage.textContent = "";
        });
        inviteForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (!complete) {
            inviteMessage.textContent =
              "Complétez d’abord votre profil professionnel.";
            return;
          }
          const email = emailInput.value.trim();
          if (!emailInput.reportValidity()) return;
          submitBtn.disabled = true;
          inviteMessage.textContent = "Envoi de l’invitation en cours…";
          inviteLink.value = "";
          try {
            const { data, error } = await db.functions.invoke(
              "madic-send-client-invitation",
              {
                body: { space_id: space.id, email },
              },
            );
            if (data?.invitation_url) inviteLink.value = data.invitation_url;
            if (error || data?.success !== true) {
              let detail = data?.error;
              if (!detail && error?.context?.json) {
                try {
                  const body = await error.context.json();
                  detail = body?.error;
                } catch (_e) {}
              }
              inviteMessage.textContent =
                detail ||
                error?.message ||
                "Envoi non confirmé. Vérifiez avant de recommencer.";
              return;
            }
            inviteMessage.textContent =
              "Invitation envoyée à " +
              email +
              ". Le client dispose de 7 jours pour l’accepter.";
          } catch (err) {
            inviteMessage.textContent =
              "Envoi non confirmé : " + (err?.message || String(err));
          } finally {
            submitBtn.disabled = !complete;
          }
        });
        $("cricInviteCopy").addEventListener("click", async () => {
          if (!inviteLink.value) return;
          try {
            await navigator.clipboard.writeText(inviteLink.value);
            inviteMessage.textContent = "Lien copié.";
          } catch (_e) {
            inviteLink.select();
            inviteMessage.textContent = "Sélectionnez et copiez le lien.";
          }
        });
      }
    }
  } catch (e) {
    msg(
      "Impossible de charger les données : " + (e.message || String(e)),
      true,
    );
  }
})();


;

/* ===== madic-import-clients-cric(3).js ===== */
/* MADIC module 12: previsualisation CSV/Excel et invitations, aucune insertion directe dans profiles. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    file = $("madicImportFile"),
    status = $("madicImportStatus"),
    body = $("madicImportRows"),
    start = $("madicImportStart"),
    cancel = $("madicImportCancel");
  if (!file || !status || !body || !start || !cancel) return;
  let rows = [],
    running = false,
    profileReady = false;
  const profileGate = $("madicImportProfileGate");
  const profileFields = [
    "first_name",
    "last_name",
    "business_name",
    "professional_title",
    "license_number",
    "phone",
    "business_address",
    "logo_path",
  ];
  const setProfileGate = (complete, detail = "") => {
    profileReady = complete === true;
    if (profileGate) {
      profileGate.replaceChildren();
      profileGate.append(
        document.createTextNode(
          profileReady
            ? "Profil professionnel complet : invitations par importation disponibles."
            : "Avant d'envoyer des invitations, remplissez votre profil professionnel. " +
                detail +
                " ",
        ),
      );
      if (!profileReady) {
        const link = document.createElement("a");
        link.href = "profil-professionnel-cric.html";
        link.textContent = "Compléter mon profil professionnel →";
        profileGate.append(link);
      }
    }
    render();
  };
  window.addEventListener("madic:cric-profile-gate", (e) =>
    setProfileGate(e.detail?.complete),
  );
  async function verifyProfile(db, spaceId) {
    const { data, error } = await db
      .from("madic_cric_professional_profiles")
      .select(profileFields.join(","))
      .eq("space_id", spaceId)
      .maybeSingle();
    if (error)
      throw Error("Vérification du profil impossible : " + error.message);
    const complete =
      !!data && profileFields.every((k) => String(data[k] ?? "").trim());
    setProfileGate(complete);
    if (!complete)
      throw Error(
        "Profil professionnel incomplet. Veuillez le compléter avant d'inviter des clients.",
      );
  }
  // La vérification est faite au chargement et de nouveau avant tout envoi.
  (async () => {
    try {
      const db = window.getMadicSupabase?.();
      if (!db) return;
      const { data: auth, error: ae } = await db.auth.getUser();
      if (ae || !auth?.user) return;
      const { data: spaces, error: se } = await db
        .from("madic_cric_spaces")
        .select("id,access_status")
        .eq("owner_user_id", auth.user.id)
        .limit(1);
      if (se || !spaces?.[0] || spaces[0].access_status !== "active") return;
      const { data: allowed, error: pe } = await db.rpc(
        "madic_can_manage_cric_space",
        { p_space_id: spaces[0].id },
      );
      if (pe || allowed !== true) return;
      await verifyProfile(db, spaces[0].id);
    } catch (e) {
      setProfileGate(false, e.message || String(e));
    }
  })();
  const setStatus = (s) => {
    status.textContent = s;
  };
  const td = (tr, s) => {
    const c = tr.insertCell();
    c.textContent = s;
    return c;
  };
  const clean = (s) =>
    String(s ?? "")
      .trim()
      .toLowerCase();
  const valid = (s) =>
    s.length <= 254 &&
    /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(
      s,
    ) &&
    !s.includes("..");
  function csv(text) {
    const out = [];
    let row = [],
      value = "",
      quoted = false;
    text = String(text).replace(/^\uFEFF/, "");
    const first = text.split(/\r?\n/, 1)[0] || "";
    const sep =
      (first.match(/;/g) || []).length > (first.match(/,/g) || []).length
        ? ";"
        : ",";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (quoted && text[i + 1] === '"') {
          value += '"';
          i++;
        } else quoted = !quoted;
      } else if (!quoted && (ch === sep || ch === "\n" || ch === "\r")) {
        row.push(value);
        value = "";
        if (ch === sep) continue;
        if (ch === "\r" && text[i + 1] === "\n") i++;
        out.push(row);
        row = [];
      } else value += ch;
    }
    if (quoted) throw Error("CSV invalide : guillemets non fermés.");
    if (value || row.length) {
      row.push(value);
      out.push(row);
    }
    return out;
  }
  function loadXlsx() {
    return new Promise((resolve, reject) => {
      if (window.XLSX) return resolve(window.XLSX);
      const s = document.createElement("script");
      s.src =
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = () =>
        window.XLSX
          ? resolve(window.XLSX)
          : reject(Error("Lecteur Excel indisponible."));
      s.onerror = () =>
        reject(
          Error("Impossible de charger le lecteur Excel. Utilisez un CSV."),
        );
      document.head.append(s);
    });
  }
  function render() {
    body.replaceChildren();
    for (const r of rows) {
      const tr = body.insertRow();
      td(tr, r.email || "(vide)");
      td(tr, r.state);
      td(tr, r.result || "-");
    }
    start.disabled =
      running || !profileReady || !rows.some((r) => r.state === "Prêt");
  }
  function reset() {
    if (running) return;
    rows = [];
    file.value = "";
    render();
    setStatus("Importation annulée.");
  }
  async function parseFile() {
    if (running) return;
    rows = [];
    render();
    const f = file.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setStatus("Fichier trop volumineux (maximum 5 Mo).");
      return;
    }
    try {
      let data;
      const ext = f.name.split(".").pop().toLowerCase();
      if (ext === "csv") data = csv(await f.text());
      else if (ext === "xlsx" || ext === "xls") {
        const XLSX = await loadXlsx();
        const workbook = XLSX.read(await f.arrayBuffer(), { type: "array" });
        data = XLSX.utils.sheet_to_json(
          workbook.Sheets[workbook.SheetNames[0]],
          { header: 1, defval: "" },
        );
      } else throw Error("Format non accepté.");
      if (data.length < 2)
        throw Error("Fichier vide ou sans lignes de clients.");
      if (data.length > 501) throw Error("Maximum 500 clients par fichier.");
      const headers = data[0].map((x) =>
        clean(x)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""),
      );
      const index = headers.findIndex((x) =>
        [
          "courriel",
          "email",
          "e-mail",
          "adresse courriel",
          "adresse email",
          "mail",
        ].includes(x),
      );
      if (index < 0)
        throw Error(
          "Colonne « courriel » ou « email » introuvable dans la première ligne.",
        );
      const seen = new Set();
      rows = data
        .slice(1)
        .filter((r) => r.some((x) => String(x).trim()))
        .map((r) => {
          const email = clean(r[index]);
          let state = "Prêt";
          if (!valid(email)) state = "Courriel invalide";
          else if (seen.has(email)) state = "Doublon dans le fichier";
          else seen.add(email);
          return { email, state, result: "" };
        });
      setStatus(
        `${rows.length} ligne(s) analysée(s), ${rows.filter((r) => r.state === "Prêt").length} invitation(s) prête(s). Vérifiez avant de confirmer.`,
      );
      render();
    } catch (e) {
      setStatus("Importation impossible : " + (e.message || e));
    }
  }
  file.addEventListener("change", parseFile);
  cancel.addEventListener("click", reset);
  start.addEventListener("click", async () => {
    if (running) return;
    if (!profileReady) {
      setStatus(
        "Complétez d’abord votre profil professionnel avant d’envoyer des invitations.",
      );
      return;
    }
    const pending = rows.filter((r) => r.state === "Prêt");
    if (!pending.length) return;
    if (
      !window.confirm(
        (window.MadicCricLanguage?.get?.() === "en"
          ? `Send ${pending.length} individual invitation(s)? Clients must accept their invitations.`
          : `Envoyer ${pending.length} invitation(s) individuelles ? Les clients devront accepter leur invitation.`),
      )
    )
      return;
    running = true;
    render();
    let sent = 0,
      failed = 0,
      existing = 0;
    try {
      const db = window.getMadicSupabase?.();
      if (!db) throw Error("Connexion Supabase indisponible.");
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth?.user) throw Error("Session expirée.");
      const uid = auth.user.id;
      const { data: app, error: appError } = await db
        .from("madic_cric_applications")
        .select("status")
        .eq("user_id", uid)
        .maybeSingle();
      if (appError || app?.status !== "approved")
        throw Error("Compte CRIC non approuvé.");
      const { data: spaces, error: spaceError } = await db
        .from("madic_cric_spaces")
        .select("id,access_status")
        .eq("owner_user_id", uid)
        .limit(1);
      if (spaceError || !spaces?.[0] || spaces[0].access_status !== "active")
        throw Error("Espace CRIC inactif.");
      const spaceId = spaces[0].id;
      await verifyProfile(db, spaceId);
      const { data: allowed, error: allowedError } = await db.rpc(
        "madic_can_manage_cric_space",
        { p_space_id: spaceId },
      );
      if (allowedError || allowed !== true) throw Error("Accès non autorisé.");
      const { data: links, error: linksError } = await db
        .from("madic_cric_clients")
        .select("client_id")
        .eq("space_id", spaceId);
      if (linksError) throw linksError;
      const ids = [...new Set((links || []).map((x) => x.client_id))];
      let existingEmails = new Set();
      for (let i = 0; i < ids.length; i += 100) {
        const { data: profiles, error: pe } = await db
          .from("profiles")
          .select("email")
          .in("id", ids.slice(i, i + 100));
        if (pe) throw pe;
        for (const p of profiles || []) existingEmails.add(clean(p.email));
      }
      for (const r of pending) {
        if (existingEmails.has(r.email)) {
          r.state = "Déjà associé";
          r.result = "Invitation non envoyée";
          existing++;
          render();
          continue;
        }
        r.state = "En cours";
        render();
        try {
          const { data, error } = await db.functions.invoke(
            "madic-send-client-invitation",
            { body: { space_id: spaceId, email: r.email } },
          );
          if (error || data?.success !== true) {
            r.state = "Échec";
            r.result = data?.error || error?.message || "Envoi non confirmé";
            failed++;
          } else {
            r.state = "Invitation envoyée";
            r.result = "En attente d’acceptation";
            sent++;
          }
        } catch (e) {
          r.state = "Échec";
          r.result = e?.message || String(e);
          failed++;
        }
        render();
        setStatus(
          `Traitement : ${sent} envoyée(s), ${existing} déjà associé(s), ${failed} échec(s).`,
        );
      }
    } catch (e) {
      setStatus("Envoi interrompu : " + (e.message || e));
    } finally {
      running = false;
      render();
      setStatus(
        status.textContent +
          ` Terminé : ${sent} invitation(s) envoyée(s), ${existing} déjà associé(s), ${failed} échec(s).`,
      );
    }
  });
})();


;

/* ===== madic-datahubz-unified(20261110-212852).js ===== */
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


;

/* ===== madic-i18n-cric(4).js ===== */
/* MADIC bilingual RCIC workspace. UI-only: no Supabase calls, no mutation of business data. */
(() => {
  'use strict';
  const dictionary = {"Espace professionnel":"Professional workspace","NAVIGATION":"NAVIGATION","Vue d’ensemble":"Overview","Clients":"Clients","Outils CRIC":"RCIC tools","Messagerie":"Messages","Rendez-vous":"Appointments","Documents":"Documents","Échéances":"Deadlines","Facturation":"Invoicing","Finances":"Finances","Mon profil professionnel":"My professional profile","Espace sécurisé MADIC":"Secure MADIC workspace","Mon espace":"My space","Aller au contenu principal":"Skip to main content","Gestion des clients CRIC":"RCIC client management","Demandes de documents →":"Document requests →","Vérification de votre espace…":"Checking your workspace…","← Retour à mon espace CRIC":"← Back to my RCIC workspace","Déconnexion":"Sign out","Clients associés":"Associated clients","Dans votre espace professionnel":"In your professional workspace","Dossiers associés":"Associated cases","Pour les clients autorisés":"For authorized clients","Résultats de recherche":"Search results","Clients affichés ci-dessous":"Clients shown below","Répertoire des clients":"Client directory","Inviter un client":"Invite a client","Importer une liste":"Import a list","Dossiers CRIC":"RCIC cases","RÉPERTOIRE CLIENTS":"CLIENT DIRECTORY","Uniquement les clients autorisés dans votre espace CRIC.":"Only clients authorized in your RCIC workspace.","Nom":"Name","Courriel":"Email","Téléphone":"Phone","Dossiers":"Cases","Factures":"Invoices","Action":"Action","Actions":"Actions","INVITATIONS INDIVIDUELLES":"INDIVIDUAL INVITATIONS","Inviter un client dans votre cabinet":"Invite a client to your practice","Une invitation privée lie le client exclusivement à votre espace CRIC.":"A private invitation links the client exclusively to your RCIC workspace.","Vérification du profil professionnel…":"Checking professional profile…","Courriel du client":"Client email","Envoyer l’invitation par courriel":"Send invitation by email","Lien personnel (copie de secours)":"Personal link (backup copy)","Copier le lien":"Copy link","Le courriel est envoyé automatiquement par MADIC PORTAIL. L’invitation est personnelle et valable pendant 7 jours.":"The email is sent automatically by MADIC PORTAIL. The personal invitation is valid for 7 days.","IMPORTATION GROUPÉE":"BULK IMPORT","Importer des invitations clients (CSV / Excel)":"Import client invitations (CSV / Excel)","Modèle Excel MADIC :":"MADIC Excel template:","Télécharger le modèle Excel à remplir (.xlsx)":"Download the Excel template (.xlsx)","Fichier de clients (colonne courriel ou email obligatoire)":"Client file (email column required)","Seuls les courriels sont utilisés pour les invitations. Les autres colonnes ne sont pas transmises.":"Only email addresses are used for invitations. Other columns are not transmitted.","Vérification du profil professionnel avant les invitations…":"Checking professional profile before invitations…","Vérification":"Verification","Résultat":"Result","Confirmer et envoyer les invitations":"Confirm and send invitations","Annuler / effacer":"Cancel / clear","Outils professionnels CRIC":"Professional RCIC tools","ESPACE PROFESSIONNEL CRIC":"RCIC PROFESSIONAL WORKSPACE","Préparez vos formulaires, contrats et analyses à partir des dossiers autorisés de votre cabinet.":"Prepare forms, contracts and analyses using authorized cases in your practice.","CENTRE DE TRAVAIL · CRIC":"RCIC WORKSPACE","Vos dossiers. Vos outils. Un seul espace.":"Your cases. Your tools. One workspace.","Sélectionnez un client, puis son dossier pour préparer les documents et les analyses professionnelles.":"Select a client and their case to prepare professional documents and analyses.","Clients autorisés":"Authorized clients","Associés à votre cabinet":"Associated with your practice","Dossiers accessibles":"Accessible cases","Dans votre espace CRIC":"In your RCIC workspace","Dossier sélectionné":"Selected case","Aucun":"None","Pour préparer les outils":"To prepare tools","Formulaires IRCC":"IRCC forms","Contrats":"Contracts","Analyse préliminaire":"Preliminary analysis","Suivi Kanban des dossiers":"Kanban case tracking","Centre des outils professionnels":"Professional tools center","Sélectionnez un client et son dossier pour préparer vos documents de travail. Les résultats doivent être vérifiés et approuvés par le consultant avant toute utilisation.":"Select a client and case to prepare working documents. The consultant must review and approve results before use.","Client associé au cabinet":"Client associated with the practice","Sélectionner un client":"Select a client","Dossier":"Case","Sélectionner un dossier":"Select a case","1. Formulaires IRCC automatisés":"1. Automated IRCC forms","Préparation des renseignements à partir du profil du client. Les PDF officiels ne sont pas générés à ce stade.":"Prepare information from the client profile. Official PDFs are not generated at this stage.","Formulaire IRCC":"IRCC form","Autre formulaire-à définir":"Other form—to be determined","Préparer la fiche de renseignements":"Prepare information sheet","OUTILS CRIC · GESTION CONTRACTUELLE":"RCIC TOOLS · CONTRACT MANAGEMENT","2. Contrats":"2. Contracts","Choisissez le contrat adapté à votre mandat. Les informations du client et du dossier sélectionnés seront transmises à la page de préparation.":"Choose the contract for your mandate. The selected client and case information will be passed to the preparation page.","PREMIÈRE CONSULTATION":"INITIAL CONSULTATION","Contrat de consultation initiale":"Initial consultation agreement","Encadrez la première consultation, son objet, les honoraires et les conditions de prestation.":"Set out the initial consultation, its purpose, fees and terms of service.","Préparer le contrat":"Prepare contract","MANDAT DE REPRÉSENTATION":"REPRESENTATION MANDATE","Contrat de services professionnels":"Professional services agreement","Définissez les services convenus, les responsabilités, les honoraires et les modalités du mandat.":"Define agreed services, responsibilities, fees and mandate terms.","Sélectionnez un client et un dossier ci-dessus avant d’ouvrir un contrat.":"Select a client and case above before opening a contract.","Les clauses, les honoraires et les signatures doivent être vérifiés et validés avant transmission au client.":"Clauses, fees and signatures must be checked and approved before sending to the client.","3. Résultat de l’analyse préliminaire":"3. Preliminary analysis results","Rédigez une évaluation professionnelle provisoire, sans décision automatique d’admissibilité.":"Draft a provisional professional assessment, without an automatic eligibility decision.","Programme ou voie d’immigration":"Immigration program or pathway","Appréciation préliminaire":"Preliminary assessment","Analyse à compléter":"Analysis pending","Éléments favorables à vérifier":"Favorable factors to verify","Renseignements supplémentaires requis":"Additional information required","Critères potentiellement non satisfaits":"Potentially unmet criteria","Constats et critères examinés":"Findings and criteria reviewed","Documents manquants et prochaines étapes":"Missing documents and next steps","Préparer le compte rendu":"Prepare report","Messagerie sécurisée":"Secure messaging","Échangez avec vos clients et retrouvez vos conversations et pièces jointes dans un espace sécurisé.":"Communicate with clients and access conversations and attachments in a secure workspace.","Vérification des autorisations…":"Checking permissions…","Conversations":"Conversations","Client du cabinet":"Practice client","Choisir un client…":"Choose a client…","Objet":"Subject","Nouvelle conversation":"New conversation","Actualiser":"Refresh","Sélectionnez une conversation":"Select a conversation","Votre message":"Your message","Envoyer":"Send","Rendez-vous et consultations":"Appointments and consultations","Gérez vos créneaux et les demandes de vos clients.":"Manage your availability and client requests.","Gestion des clients →":"Client management →","Vérification des accès…":"Checking access…","Publier une disponibilité":"Publish availability","Date de début (heure de Montréal)":"Start date (Montreal time)","Heure de début (heure de Montréal)":"Start time (Montreal time)","Choisir une heure":"Choose a time","Durée de consultation":"Consultation duration","1 heure":"1 hour","2 heures":"2 hours","3 heures":"3 hours","4 heures":"4 hours","5 heures":"5 hours","6 heures":"6 hours","7 heures":"7 hours","8 heures":"8 hours","Fin calculée automatiquement (heure de Montréal)":"Automatically calculated end (Montreal time)","Type de consultation":"Consultation type","Visioconférence":"Video call","En personne":"In person","Lieu ou lien (facultatif)":"Location or link (optional)","Publier le créneau":"Publish time slot","AGENDA PROFESSIONNEL":"PROFESSIONAL CALENDAR","Calendrier des consultations":"Consultation calendar","Visualisez les créneaux et les réservations, puis sélectionnez une journée pour publier une disponibilité.":"View time slots and bookings, then select a day to publish availability.","Aujourd'hui":"Today","Disponible":"Available","Demandé":"Requested","Confirmé":"Confirmed","Fermé":"Closed","Lun":"Mon","Mar":"Tue","Mer":"Wed","Jeu":"Thu","Ven":"Fri","Sam":"Sat","Dim":"Sun","Mes disponibilités":"My availability","Les nouveaux créneaux commencent à l’heure juste. Les anciens rendez-vous conservent leurs horaires.":"New slots start on the hour. Existing appointments retain their scheduled times.","Début":"Start","Fin":"End","Type":"Type","État":"State","Réservations et demandes":"Bookings and requests","Client":"Client","Statut":"Status","Gestion documentaire du client":"Client document management","← Retour à la gestion des clients":"← Back to client management","Choisissez un dossier, examinez les pièces reçues et suivez les documents demandés.":"Choose a case, review received files and track requested documents.","Chargement…":"Loading…","Étape 1 · Dossier":"Step 1 · Case","Choisir le client et le dossier":"Choose client and case","+ Demander une nouvelle pièce au client":"+ Request a new document from the client","Cette demande apparaîtra dans l'espace du client.":"This request will appear in the client's workspace.","Document demandé":"Requested document","Instructions":"Instructions","Date limite (facultatif)":"Due date (optional)","Envoyer la demande":"Send request","+ Envoyer un document au client":"+ Send a document to the client","Fichier à transmettre (PDF, JPG ou PNG, 10 Mo maximum)":"File to send (PDF, JPG or PNG, 10 MB maximum)","Nom du document (facultatif)":"Document name (optional)","Envoyer le document":"Send document","Étape 2 · Vérification":"Step 2 · Review","Documents reçus":"Received documents","Téléchargez et évaluez chaque document. En cas de refus, précisez le motif qui sera visible par le client.":"Download and review each document. If rejected, provide a reason visible to the client.","Fichier":"File","Reçu le":"Received on","Évaluation":"Assessment","Motif du refus":"Reason for rejection","Étape 3 · Suivi":"Step 3 · Tracking","Demandes envoyées":"Sent requests","Demandes concernant uniquement le dossier sélectionné. Le statut d'une demande est distinct de l'évaluation d'un fichier.":"Requests for the selected case only. Request status is separate from file assessment.","Pièce demandée":"Requested item","Date limite":"Due date","Mettre à jour":"Update","Échéances de mon cabinet":"Practice deadlines","← Mon espace CRIC":"← My RCIC workspace","Échéances et rappels":"Deadlines and reminders","Suivez les dates importantes de vos dossiers et les actions à réaliser.":"Track important case dates and required actions.","Vérification de votre cabinet…":"Checking your practice…","Ajouter une échéance":"Add a deadline","Dossier *":"Case *","Description de l’échéance *":"Deadline description *","Date limite *":"Due date *","Enregistrer l'échéance":"Save deadline","Mes échéances":"My deadlines","Description":"Description","Date":"Date","Situation":"Status","Les échéances sont affichées dans votre espace CRIC. Vérifiez régulièrement vos dates limites et les notifications applicables.":"Deadlines are shown in your RCIC workspace. Regularly check due dates and relevant notifications.","Facturation de mon cabinet":"Practice invoicing","Vérification de votre accès…":"Checking your access…","Paiements Stripe Connect":"Stripe Connect payments","Connectez le compte Stripe de votre cabinet pour recevoir directement les paiements de vos clients.":"Connect your practice's Stripe account to receive client payments directly.","Vérification de la connexion Stripe…":"Checking Stripe connection…","Connecter mon compte Stripe":"Connect my Stripe account","Créer une facture":"Create an invoice","Client *":"Client *","Dossier (facultatif)":"Case (optional)","Aucun dossier":"No cases","Nom du cabinet *":"Practice name *","Adresse du cabinet":"Practice address","Numéros de taxes (si applicables)":"Tax numbers (if applicable)","Logo du cabinet (PNG ou JPG, max. 100 Ko)":"Practice logo (PNG or JPG, max. 100 KB)","Lignes de facturation":"Invoice line items","Quantité":"Quantity","Prix unitaire (CAD)":"Unit price (CAD)","Montant":"Amount","+ Ajouter une ligne":"+ Add a line","Sous-total : 0,00 $":"Subtotal: $0.00","Taux total de taxes applicable (%)":"Total applicable tax rate (%)","Date d'échéance":"Due date","Notes":"Notes","Créer la facture":"Create invoice","Mes factures":"My invoices","Numéro":"Number","Émission":"Issued","Total":"Total","Payé":"Paid","Gestion financière CRIC":"RCIC financial management","Gestion financière du cabinet CRIC":"RCIC practice financial management","Temps et honoraires · Facturation · Paiements · Fidéicommis · Comptabilité · Rapports":"Time and fees · Invoicing · Payments · Trust accounts · Accounting · Reports","Cabinet :":"Practice:","Non sélectionné":"Not selected","Initialisation…":"Initializing…","Retour à mon espace professionnel CRIC":"Back to my RCIC professional workspace","Temps et honoraires":"Time and fees","Ces renseignements identifient votre cabinet dans les invitations à vos clients.":"This information identifies your practice in client invitations.","Renseignements du cabinet":"Practice information","Les champs marqués d’un astérisque sont obligatoires. Vos informations sont enregistrées dans votre espace professionnel.":"Fields marked with an asterisk are required. Your information is saved in your professional workspace.","Nom déclaré à l’inscription CRIC":"Name provided during RCIC registration","Courriel professionnel déclaré à l’inscription":"Professional email provided during registration","Prénom *":"First name *","Nom *":"Last name *","Titre professionnel *":"Professional title *","Numéro de permis CRIC *":"RCIC licence number *","Nom de l’entreprise *":"Business name *","Site Web de l’entreprise (facultatif)":"Business website (optional)","Téléphone professionnel *":"Business phone *","Adresse professionnelle du cabinet":"Professional practice address","Numéro civique *":"Street number *","Rue *":"Street *","Bureau, suite ou local (facultatif)":"Office, suite or unit (optional)","Ville *":"City *","Province, État ou district *":"Province, state or district *","Code postal (facultatif)":"Postal code (optional)","Pays *":"Country *","Sélectionner un pays":"Select a country","Enregistrer":"Save","Annuler":"Cancel","Fermer":"Close","Continuer":"Continue","Confirmer":"Confirm","Refuser":"Decline","Supprimer":"Delete","Modifier":"Edit","Voir":"View","Télécharger":"Download","En attente":"Pending","Annulé":"Cancelled","Annulée":"Cancelled","Accepté":"Accepted","Acceptée":"Accepted","Rejeté":"Rejected","Rejetée":"Rejected","Validé":"Approved","Validée":"Approved","Approuvé":"Approved","Approuvée":"Approved","Oui":"Yes","Non":"No","Aucun résultat":"No results","Aucune donnée":"No data","Aucun client":"No clients","Aucun rendez-vous":"No appointments","En cours":"In progress","Terminé":"Completed","Terminée":"Completed","Envoyé":"Sent","Envoyée":"Sent","Brouillon":"Draft","Enregistrer les modifications":"Save changes","Profil mis à jour":"Profile updated","© MAD Immigration Canadienne · Portail sécurisé":"© MAD Immigration Canadienne · Secure portal","© MADIC · Plateforme professionnelle":"© MADIC · Professional platform","Île de l’Ascension":"Ascension Island","Andorre":"Andorra","Émirats arabes unis":"United Arab Emirates","Afghanistan":"Afghanistan","Antigua-et-Barbuda":"Antigua & Barbuda","Anguilla":"Anguilla","Albanie":"Albania","Arménie":"Armenia","Angola":"Angola","Antarctique":"Antarctica","Argentine":"Argentina","Samoa américaines":"American Samoa","Autriche":"Austria","Australie":"Australia","Aruba":"Aruba","Îles Åland":"Åland Islands","Azerbaïdjan":"Azerbaijan","Bosnie-Herzégovine":"Bosnia & Herzegovina","Barbade":"Barbados","Bangladesh":"Bangladesh","Belgique":"Belgium","Burkina Faso":"Burkina Faso","Bulgarie":"Bulgaria","Bahreïn":"Bahrain","Burundi":"Burundi","Bénin":"Benin","Saint-Barthélemy":"St. Barthélemy","Bermudes":"Bermuda","Brunei":"Brunei","Bolivie":"Bolivia","Pays-Bas caribéens":"Caribbean Netherlands","Brésil":"Brazil","Bahamas":"Bahamas","Bhoutan":"Bhutan","Île Bouvet":"Bouvet Island","Botswana":"Botswana","Biélorussie":"Belarus","Belize":"Belize","Canada":"Canada","Îles Cocos":"Cocos (Keeling) Islands","Congo-Kinshasa":"Congo - Kinshasa","République centrafricaine":"Central African Republic","Congo-Brazzaville":"Congo - Brazzaville","Suisse":"Switzerland","Côte d’Ivoire":"Côte d’Ivoire","Îles Cook":"Cook Islands","Chili":"Chile","Cameroun":"Cameroon","Chine":"China","Colombie":"Colombia","Île Clipperton":"Clipperton Island","Costa Rica":"Costa Rica","Cuba":"Cuba","Cap-Vert":"Cape Verde","Curaçao":"Curaçao","Île Christmas":"Christmas Island","Chypre":"Cyprus","Tchéquie":"Czechia","Allemagne":"Germany","Diego Garcia":"Diego Garcia","Djibouti":"Djibouti","Danemark":"Denmark","Dominique":"Dominica","République dominicaine":"Dominican Republic","Algérie":"Algeria","Ceuta et Melilla":"Ceuta & Melilla","Équateur":"Ecuador","Estonie":"Estonia","Égypte":"Egypt","Sahara occidental":"Western Sahara","Érythrée":"Eritrea","Espagne":"Spain","Éthiopie":"Ethiopia","Union européenne":"European Union","zone euro":"Eurozone","Finlande":"Finland","Fidji":"Fiji","Îles Malouines":"Falkland Islands","Micronésie":"Micronesia","Îles Féroé":"Faroe Islands","France":"France","Gabon":"Gabon","Royaume-Uni":"United Kingdom","Grenade":"Grenada","Géorgie":"Georgia","Guyane française":"French Guiana","Guernesey":"Guernsey","Ghana":"Ghana","Gibraltar":"Gibraltar","Groenland":"Greenland","Gambie":"Gambia","Guinée":"Guinea","Guadeloupe":"Guadeloupe","Guinée équatoriale":"Equatorial Guinea","Grèce":"Greece","Géorgie du Sud-et-les Îles Sandwich du Sud":"South Georgia & South Sandwich Islands","Guatemala":"Guatemala","Guam":"Guam","Guinée-Bissau":"Guinea-Bissau","Guyana":"Guyana","R.A.S. chinoise de Hong Kong":"Hong Kong SAR China","Îles Heard-et-MacDonald":"Heard & McDonald Islands","Honduras":"Honduras","Croatie":"Croatia","Haïti":"Haiti","Hongrie":"Hungary","Îles Canaries":"Canary Islands","Indonésie":"Indonesia","Irlande":"Ireland","Israël":"Israel","Île de Man":"Isle of Man","Inde":"India","Territoire britannique de l’océan Indien":"British Indian Ocean Territory","Irak":"Iraq","Iran":"Iran","Islande":"Iceland","Italie":"Italy","Jersey":"Jersey","Jamaïque":"Jamaica","Jordanie":"Jordan","Japon":"Japan","Kenya":"Kenya","Kirghizstan":"Kyrgyzstan","Cambodge":"Cambodia","Kiribati":"Kiribati","Comores":"Comoros","Saint-Christophe-et-Niévès":"St. Kitts & Nevis","Corée du Nord":"North Korea","Corée du Sud":"South Korea","Koweït":"Kuwait","Îles Caïmans":"Cayman Islands","Kazakhstan":"Kazakhstan","Laos":"Laos","Liban":"Lebanon","Sainte-Lucie":"St. Lucia","Liechtenstein":"Liechtenstein","Sri Lanka":"Sri Lanka","Liberia":"Liberia","Lesotho":"Lesotho","Lituanie":"Lithuania","Luxembourg":"Luxembourg","Lettonie":"Latvia","Libye":"Libya","Maroc":"Morocco","Monaco":"Monaco","Moldavie":"Moldova","Monténégro":"Montenegro","Saint-Martin":"St. Martin","Madagascar":"Madagascar","Îles Marshall":"Marshall Islands","Macédoine du Nord":"North Macedonia","Mali":"Mali","Myanmar (Birmanie)":"Myanmar (Burma)","Mongolie":"Mongolia","R.A.S. chinoise de Macao":"Macao SAR China","Îles Mariannes du Nord":"Northern Mariana Islands","Martinique":"Martinique","Mauritanie":"Mauritania","Montserrat":"Montserrat","Malte":"Malta","Maurice":"Mauritius","Maldives":"Maldives","Malawi":"Malawi","Mexique":"Mexico","Malaisie":"Malaysia","Mozambique":"Mozambique","Namibie":"Namibia","Nouvelle-Calédonie":"New Caledonia","Niger":"Niger","Île Norfolk":"Norfolk Island","Nigeria":"Nigeria","Nicaragua":"Nicaragua","Pays-Bas":"Netherlands","Norvège":"Norway","Népal":"Nepal","Nauru":"Nauru","Niue":"Niue","Nouvelle-Zélande":"New Zealand","Oman":"Oman","Panama":"Panama","Pérou":"Peru","Polynésie française":"French Polynesia","Papouasie-Nouvelle-Guinée":"Papua New Guinea","Philippines":"Philippines","Pakistan":"Pakistan","Pologne":"Poland","Saint-Pierre-et-Miquelon":"St. Pierre & Miquelon","Îles Pitcairn":"Pitcairn Islands","Porto Rico":"Puerto Rico","Territoires palestiniens":"Palestinian Territories","Portugal":"Portugal","Palaos":"Palau","Paraguay":"Paraguay","Qatar":"Qatar","régions éloignées de l’Océanie":"Outlying Oceania","La Réunion":"Réunion","Roumanie":"Romania","Serbie":"Serbia","Russie":"Russia","Rwanda":"Rwanda","Arabie saoudite":"Saudi Arabia","Îles Salomon":"Solomon Islands","Seychelles":"Seychelles","Soudan":"Sudan","Suède":"Sweden","Singapour":"Singapore","Sainte-Hélène":"St. Helena","Slovénie":"Slovenia","Svalbard et Jan Mayen":"Svalbard & Jan Mayen","Slovaquie":"Slovakia","Sierra Leone":"Sierra Leone","Saint-Marin":"San Marino","Sénégal":"Senegal","Somalie":"Somalia","Suriname":"Suriname","Soudan du Sud":"South Sudan","Sao Tomé-et-Principe":"São Tomé & Príncipe","Salvador":"El Salvador","Saint-Martin (partie néerlandaise)":"Sint Maarten","Syrie":"Syria","Eswatini":"Eswatini","Tristan da Cunha":"Tristan da Cunha","Îles Turques-et-Caïques":"Turks & Caicos Islands","Tchad":"Chad","Terres australes françaises":"French Southern Territories","Togo":"Togo","Thaïlande":"Thailand","Tadjikistan":"Tajikistan","Tokelau":"Tokelau","Timor oriental":"Timor-Leste","Turkménistan":"Turkmenistan","Tunisie":"Tunisia","Tonga":"Tonga","Turquie":"Türkiye","Trinité-et-Tobago":"Trinidad & Tobago","Tuvalu":"Tuvalu","Taïwan":"Taiwan","Tanzanie":"Tanzania","Ukraine":"Ukraine","Ouganda":"Uganda","Îles mineures éloignées des États-Unis":"U.S. Outlying Islands","Nations Unies":"United Nations","États-Unis":"United States","Uruguay":"Uruguay","Ouzbékistan":"Uzbekistan","État de la Cité du Vatican":"Vatican City","Saint-Vincent-et-les Grenadines":"St. Vincent & Grenadines","Venezuela":"Venezuela","Îles Vierges britanniques":"British Virgin Islands","Îles Vierges des États-Unis":"U.S. Virgin Islands","Viêt Nam":"Vietnam","Vanuatu":"Vanuatu","Wallis-et-Futuna":"Wallis & Futuna","Samoa":"Samoa","pseudo-accents":"Pseudo-Accents","pseudo-bidi":"Pseudo-Bidi","Kosovo":"Kosovo","Yémen":"Yemen","Mayotte":"Mayotte","Afrique du Sud":"South Africa","Zambie":"Zambia","Zimbabwe":"Zimbabwe","région indéterminée":"Unknown Region","Le fichier sera accessible dans l’espace du client, sous « Historique et évaluations de mes documents », pour le dossier sélectionné ci-dessus.":"The file will be available in the client workspace under “History and assessments of my documents” for the selected case.","La fin est calculée automatiquement à partir du début et de la durée choisie. Le lien ou lieu est communiqué au client après confirmation. Aucun lien Teams n'est créé automatiquement.":"The end time is calculated automatically from the start and selected duration. The link or location is shared with the client after confirmation. No Teams link is created automatically.","Le logo est enregistré dans chaque nouvelle facture. Sélectionnez-le de nouveau pour les factures suivantes.":"The logo is saved in each new invoice. Select it again for subsequent invoices.","Saisissez le taux applicable à votre situation. MADIC ne détermine pas les obligations fiscales de votre cabinet.":"Enter the rate applicable to your situation. MADIC does not determine your practice’s tax obligations.","Modèles 1 et 2 disponibles dans Fidéicommis. Les paramètres du modèle et les comptes peuvent être enregistrés. Les écritures financières restent en lecture seule. Les rapports et paiements affichent des données de consultation, sans rapprochement bancaire.":"Models 1 and 2 are available under Trust accounts. Model settings and accounts can be saved. Financial entries remain read-only. Reports and payments display information for review, without bank reconciliation.","Le nom complet et le courriel proviennent de votre inscription CRIC. Vérifiez la répartition prénom/nom lors du premier remplissage.":"Your full name and email come from your RCIC registration. Check the first and last name fields when completing this form for the first time.","Renseignez les champs ci-dessous. L’ancienne adresse est conservée jusqu’à votre premier enregistrement.":"Complete the fields below. The previous address is retained until you save for the first time.","Préparez des invitations à partir d'un fichier CSV, XLSX ou XLS. Aucun client n'est créé automatiquement : chaque personne doit accepter son invitation personnelle.":"Prepare invitations from a CSV, XLSX or XLS file. No client is created automatically: each person must accept their personal invitation.",". Remplissez l’onglet « Clients » avec les courriels des personnes à inviter, puis importez le fichier ci-dessous. Seuls les courriels servent à envoyer les invitations.":". Fill in the “Clients” sheet with the email addresses of people to invite, then import the file below. Only email addresses are used to send invitations.","IMM 5476-Recours aux services d’un représentant":"IMM 5476 – Use of a Representative","IMM 0008-Demande générique pour le Canada":"IMM 0008 – Generic Application Form for Canada","IMM 5406-Renseignements additionnels sur la famille":"IMM 5406 – Additional Family Information","IMM 5669-Antécédents / Déclaration":"IMM 5669 – Schedule A: Background / Declaration","Gestion financière CRIC | MADIC":"RCIC financial management | MADIC","Échéances de mon cabinet | MADIC":"My practice deadlines | MADIC","Les modifications de votre profil professionnel ont été enregistrées avec succès.":"Changes to your professional profile have been saved successfully.","Le paiement par Portail MADIC n'est pas encore activé : cette option ne déclenche aucun encaissement.":"Payments through MADIC Portail are not yet enabled: this option does not collect payments.","Recevez un virement par courriel ou téléphone":"Receive an e-transfer by email or phone","Choisissez les moyens de paiement acceptés par votre cabinet. Ils seront repris automatiquement dans vos contrats.":"Choose the payment methods accepted by your practice. They will automatically appear in your contracts.","Courriel ou numéro pour recevoir les virements":"Email address or phone number for e-transfers","Lors d’une modification, le logo déjà enregistré est conservé si vous ne sélectionnez pas de nouveau fichier.":"When editing, the saved logo is retained unless you select a new file.","Adresse complète (générée automatiquement)":"Full address (generated automatically)","Vos modifications ne sont enregistrées qu’après confirmation.":"Your changes are only saved after confirmation."};
  Object.assign(dictionary, {
    "Espace chargé. Les données sont soumises aux autorisations Supabase.": "Workspace loaded. Data is subject to Supabase permissions.",
    "Outils de préparation disponibles. Aucun document n’est automatiquement enregistré.": "Preparation tools available. No document is saved automatically.",
    "Messagerie du cabinet chargée.": "Practice messaging loaded.",
    "Dernière vérification automatique": "Last automatic check",
    "Rechercher une conversation": "Search conversations",
    "Nom du client ou objet...": "Client name or subject...",
    "Conversation générale": "General conversation",
    "Disponibilités et réservations actualisées.": "Availability and bookings updated.",
    "Notifications de rendez-vous": "Appointment notifications",
    "Aucune notification non lue.": "No unread notifications.",
    "Nouvelle demande de rendez-vous": "New appointment request",
    "Demandes chargées.": "Requests loaded.",
    "Choisissez un dossier, examinez les pièces reçues et suivez les documents demandés.": "Choose a case, review received files and track requested documents.",
    "Téléchargez et évaluez chaque document. En cas de refus, précisez le motif qui sera visible par le client.": "Download and review each document. If rejected, provide a reason visible to the client.",
    "Documents du dossier": "Case documents",
    "document(s) reçu(s).": "document(s) received.",
    "Ex. Date limite de transmission": "E.g. submission deadline",
    "Compte Stripe créé. Configuration ou vérification en attente.": "Stripe account created. Setup or verification pending.",
    "Continuer la configuration Stripe": "Continue Stripe setup",
    "Aucune donnée enregistrée pour ce cabinet.": "No data recorded for this practice.",
    "Profil enregistré. Vous pouvez le modifier.": "Profile saved. You can edit it.",
    "Ces renseignements identifient votre cabinet dans les invitations à vos clients.": "This information identifies your practice in invitations to clients.",
    "Le nom complet et le courriel proviennent de votre inscription CRIC. Vérifiez la répartition prénom/nom lors du premier remplissage.": "Your full name and email come from your RCIC registration. Check the first and last name fields when filling out the form for the first time.",
    "Choisir un fichier": "Choose a file",
    "Aucun fichier choisi": "No file selected",
    "Fidéicommis": "Trust accounting",
    "Comptabilité": "Accounting",
    "Rapports": "Reports",
    "Paiements": "Payments",
    "Cabinet": "Practice",
    "Temps et honoraires": "Time and fees",
    "Aucune donnée enregistrée pour ce cabinet.": "No data recorded for this practice."
  });
  Object.assign(dictionary, {"Profil professionnel complet : invitations disponibles.":"Professional profile complete: invitations available.","Profil professionnel complet : invitations par importation disponibles.":"Professional profile complete: bulk invitations available.","Compléter mon profil professionnel →":"Complete my professional profile →","Aucun client ne correspond à votre recherche.":"No clients match your search.","Aucun client associé pour le moment.":"No clients associated yet.","Statut enregistré.":"Status saved.","Dossiers actualisés.":"Cases refreshed.","Compte CRIC non approuvé.":"RCIC account not approved.","Accès à cet espace non autorisé.":"Access to this workspace is not authorized.","Espace CRIC absent ou suspendu.":"RCIC workspace missing or suspended.","Espace CRIC inactif.":"RCIC workspace inactive.","Accès non autorisé.":"Access denied.","Aucun dossier.":"No cases.","Aucun changement.":"No changes.","En attente":"Pending","Actif":"Active","Fermé":"Closed","Accepté":"Accepted","Refusé":"Rejected","Enregistrer":"Save","Consulter":"View","Télécharger":"Download","Lien copié.":"Link copied.","Sélectionnez et copiez le lien.":"Select and copy the link.","Complétez d’abord votre profil professionnel.":"Complete your professional profile first.","Envoi de l’invitation en cours…":"Sending invitation…","Envoi non confirmé. Vérifiez avant de recommencer.":"Sending not confirmed. Please check before trying again.","Importation annulée.":"Import cancelled.","Fichier trop volumineux (maximum 5 Mo).":"File too large (maximum 5 MB).","Format non accepté.":"Unsupported file format.","Fichier vide ou sans lignes de clients.":"Empty file or no client rows.","Maximum 500 clients par fichier.":"Maximum 500 clients per file.","Colonne « courriel » ou « email » introuvable dans la première ligne.":"No “courriel” or “email” column found in the first row.","Courriel invalide":"Invalid email","Doublon dans le fichier":"Duplicate in file","Prêt":"Ready","Importation impossible :":"Import failed:","En cours":"In progress","En attente d’acceptation":"Awaiting acceptance","Déjà associé":"Already associated","Invitation non envoyée":"Invitation not sent","Invitation envoyée":"Invitation sent","Échec":"Failed","Envoi non confirmé":"Sending not confirmed","Session expirée.":"Session expired.","Connexion Supabase indisponible.":"Supabase connection unavailable.","Envoi interrompu :":"Sending interrupted:","CSV invalide : guillemets non fermés.":"Invalid CSV: unclosed quotation marks.","Lecteur Excel indisponible.":"Excel reader unavailable.","Impossible de charger le lecteur Excel. Utilisez un CSV.":"Unable to load Excel reader. Use a CSV file.","Profil professionnel incomplet. Veuillez le compléter avant d'inviter des clients.":"Professional profile incomplete. Please complete it before inviting clients.","Complétez d’abord votre profil professionnel avant d’envoyer des invitations.":"Complete your professional profile before sending invitations.","Veuillez vérifier votre profil professionnel.":"Please verify your professional profile.","Configuration Supabase manquante.":"Supabase configuration missing.","Chargement…":"Loading…","MADIC PORTAIL / ESPACE PROFESSIONNEL":"MADIC PORTAL / PROFESSIONAL WORKSPACE","Nom, courriel ou téléphone":"Name, email or phone","Rechercher un client":"Search for a client","Navigation du portail":"Portal navigation","Navigation du compte":"Account navigation","Accès aux actions clients":"Client actions","Aperçu du cabinet":"Practice overview","Liste des clients associés":"List of associated clients","Lien d'invitation généré":"Generated invitation link","Prévisualisation des invitations à importer":"Preview of invitations to import","Liens du pied de page":"Footer links","Pied de page MADIC / MADIC footer":"MADIC footer","Veuillez sélectionner un fichier.":"Please select a file.","Vérification du profil professionnel avant les invitations…":"Checking professional profile before invitations…"});
  const key = 'madic_ui_language';
  let lang = 'fr';
  try { lang = localStorage.getItem(key) === 'en' ? 'en' : 'fr'; } catch (_) {}
  const normalized = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const reverse = new Map();
  Object.entries(dictionary).forEach(([fr, en]) => {
    if (fr !== en && !reverse.has(normalized(en))) reverse.set(normalized(en), fr);
  });
  const originals = new WeakMap();
  const rendered = new WeakMap();
  const originalAttrs = new WeakMap();
  const renderedAttrs = new WeakMap();
  const attrs = ['placeholder', 'title', 'aria-label'];
  const ignored = node => !!node.parentElement?.closest('script,style,code,pre,textarea,[contenteditable="true"],.madic-lang-controls');
  const patterns = [
    [/^Profil professionnel complet\s*:\s*invitations disponibles\.$/i, 'Professional profile complete: invitations available.'],
    [/^Profil professionnel complet\s*:\s*invitations par importation disponibles\.$/i, 'Professional profile complete: bulk invitations available.'],
    [/^Espace chargé\. Les données sont soumises aux autorisations Supabase\.$/i, 'Workspace loaded. Data access is subject to Supabase permissions.'],
    [/^Invitation envoyée à (.+)\. Le client dispose de 7 jours pour l’accepter\.$/i, (_,email) => `Invitation sent to ${email}. The client has 7 days to accept it.`],
    [/^(\d+) ligne\(s\) analysée\(s\), (\d+) invitation\(s\) prête\(s\)\. Vérifiez avant de confirmer\.$/i, (_,total,ready) => `${total} row(s) analyzed, ${ready} invitation(s) ready. Review before confirming.`],
    [/^Traitement\s*:\s*(\d+) envoyée\(s\), (\d+) déjà associé\(s\), (\d+) échec\(s\)\.$/i, (_,sent,existing,failed) => `Processing: ${sent} sent, ${existing} already associated, ${failed} failed.`],
    [/^Terminé\s*:\s*(\d+) invitation\(s\) envoyée\(s\), (\d+) déjà associé\(s\), (\d+) échec\(s\)\.$/i, (_,sent,existing,failed) => `Completed: ${sent} invitation(s) sent, ${existing} already associated, ${failed} failed.`],
    [/\s+Terminé\s*:\s*(\d+) invitation\(s\) envoyée\(s\), (\d+) déjà associé\(s\), (\d+) échec\(s\)\.$/i, (_,sent,existing,failed) => ` Completed: ${sent} invitation(s) sent, ${existing} already associated, ${failed} failed.`],
    [/^Envoyer (\d+) invitation\(s\) individuelles \? Les clients devront accepter leur invitation\.$/i, (_,n) => `Send ${n} individual invitation(s)? Clients must accept their invitations.`],
    [/^Espace professionnel\s*:\s*/i, 'Professional workspace: '],
    [/^Impossible de (?:charger les données|vérifier le profil professionnel)\s*:/i, text => text.replace('charger les données','load data').replace('vérifier le profil professionnel','verify professional profile').replace('Impossible de','Unable to')],
    [/^Avant d'inviter un client, remplissez votre profil professionnel \(entreprise, adresse, titre, numéro de permis, téléphone et logo\)\./i, 'Before inviting a client, complete your professional profile (business name, address, title, licence number, phone and logo).'],
    [/^Avant d'envoyer des invitations, remplissez votre profil professionnel\./i, 'Before sending invitations, complete your professional profile.'],
    [/^Envoi non confirmé\s*:/i, 'Sending not confirmed:'],
    [/^Envoi interrompu\s*:/i, 'Sending interrupted:'],
    [/^Importation impossible\s*:/i, 'Import failed:'],
    [/^Invitation envoyée à /i, 'Invitation sent to '],
    [/^Mise à jour impossible\s*:/i, 'Update failed:'],
    [/^Téléchargement impossible\s*:/i, 'Download failed:'],
    [/^Vérification du profil impossible\s*:/i, 'Unable to verify profile:'],
    [/^\d+ document\(s\)$/i, s => s.replace('document(s)','document(s)')],
    [/^Nouvelle demande de rendez-vous\s*-\s*/i, 'New appointment request - '],
    [/^Dernière vérification automatique\s*:/i, 'Last automatic check:'],
    [/^Documents du dossier\s*:/i, 'Case documents:'],
    [/^Espace professionnel\s*:/i, 'Professional workspace:'],
    [/^Espace de facturation du cabinet\s*:/i, 'Practice invoicing workspace:'],
    [/^Cabinet\s*:/i, 'Practice:'],
    [/^\d+\s+document\(s\) reçu\(s\)\./i, s => s.replace('document(s) reçu(s)', 'document(s) received')],
    [/^\d+\s+échéances?\s*·/i, s => s.replace(/échéances?/, 'deadlines').replace(/dépassée?s?/, 'overdue').replace(/à traiter dans les/, 'due within the').replace(/prochains jours/, 'next days')],
    [/^\d+\s+ligne\(s\) affichée\(s\)\./i, s => s.replace('ligne(s) affichée(s)', 'row(s) displayed')],
    [/^Consultation\s*-\s*\d+\s+ligne\(s\) affichée\(s\)/i, s => s.replace('ligne(s) affichée(s)', 'row(s) displayed')]
  ];
  function toFrench(value) {
    const text = normalized(value);
    return reverse.get(text) || value;
  }
  function toEnglish(value) {
    const text = normalized(value);
    if (Object.prototype.hasOwnProperty.call(dictionary, text)) return dictionary[text];
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(text)) return text.replace(pattern, replacement);
    }
    // Mixed status text is assembled from multiple messages by the import workflow.
    const compound = text.match(/^(.*?)(?:\s+)Terminé\s*:\s*(\d+) invitation\(s\) envoyée\(s\), (\d+) déjà associé\(s\), (\d+) échec\(s\)\.$/i);
    if (compound) {
      const prefix = toEnglish(compound[1]);
      return `${prefix} Completed: ${compound[2]} invitation(s) sent, ${compound[3]} already associated, ${compound[4]} failed.`;
    }
    return value;
  }
  function localized(original) {
    const trimmed = normalized(original);
    const output = lang === 'en' ? toEnglish(trimmed) : toFrench(trimmed);
    if (output === trimmed) return original;
    const start = original.indexOf(trimmed);
    return start < 0 ? output : original.slice(0, start) + output + original.slice(start + trimmed.length);
  }
  function translateText(node) {
    if (!node?.parentElement || ignored(node)) return;
    const current = node.nodeValue;
    if (!normalized(current)) return;
    if (!originals.has(node) || rendered.get(node) !== current) originals.set(node, current);
    const next = localized(originals.get(node));
    if (next !== current) node.nodeValue = next;
    rendered.set(node, next);
  }
  function translateElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.matches('.madic-lang-controls button[data-lang]')) {
      el.disabled = false;
      el.removeAttribute('aria-disabled');
      el.setAttribute('aria-pressed', String(el.dataset.lang === lang));
      el.classList.toggle('madic-lang-active', el.dataset.lang === lang);
      el.setAttribute('aria-label', el.dataset.lang === 'fr' ? 'Français' : 'English');
      el.title = el.dataset.lang === 'fr' ? 'Français' : 'English';
      return;
    }
    if (ignored({parentElement:el})) return;
    let source = originalAttrs.get(el);
    let previous = renderedAttrs.get(el);
    if (!source) { source = {}; originalAttrs.set(el, source); }
    if (!previous) { previous = {}; renderedAttrs.set(el, previous); }
    if (el.hasAttribute('data-en') && el.hasAttribute('data-fr')) {
      const explicit = el.getAttribute(lang === 'en' ? 'data-en' : 'data-fr');
      // Only leaf elements: avoid replacing nested links, controls or icons.
      if (el.children.length === 0 && el.textContent !== explicit) el.textContent = explicit;
    }
    for (const attr of attrs) {
      if (!el.hasAttribute(attr)) continue;
      const current = el.getAttribute(attr);
      if (!(attr in source) || previous[attr] !== current) source[attr] = current;
      const next = localized(source[attr]);
      if (next !== current) el.setAttribute(attr, next);
      previous[attr] = next;
    }
  }
  let observer;
  let scheduled = false;
  function render() {
    if (observer) observer.disconnect();
    document.documentElement.lang = lang === 'en' ? 'en-CA' : 'fr-CA';
    const pageTitle = document.querySelector('title[data-fr][data-en]');
    if (pageTitle) document.title = pageTitle.getAttribute(lang === 'en' ? 'data-en' : 'data-fr');
    const root = document.body;
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateText(node);
      else translateElement(node);
    }
    document.querySelectorAll('.madic-lang-controls button[data-lang]').forEach(translateElement);
    if (observer) observer.observe(root, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrs});
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; render(); });
  }
  function selectLanguage(next) {
    if (next !== 'fr' && next !== 'en') return;
    lang = next;
    try { localStorage.setItem(key, lang); } catch (_) {}
    render();
    document.dispatchEvent(new CustomEvent('madic:languagechange', {detail:{lang}}));
  }
  function init() {
    document.addEventListener('click', event => {
      const button = event.target.closest?.('.madic-lang-controls button[data-lang]');
      if (!button) return;
      event.preventDefault();
      selectLanguage(button.dataset.lang);
    }, true);
    observer = new MutationObserver(schedule);
    render();
    window.MadicCricLanguage = {set:selectLanguage, get:()=>lang, refresh:render};
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();

