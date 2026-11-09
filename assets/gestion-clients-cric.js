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
