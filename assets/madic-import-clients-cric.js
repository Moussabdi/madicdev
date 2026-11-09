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
        `Envoyer ${pending.length} invitation(s) individuelles ? Les clients devront accepter leur invitation.`,
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
